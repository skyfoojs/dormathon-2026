import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { coversAll, runCouncil, type Persona } from "@/lib/ai/council";
import { deriveAiForecastFields } from "@/lib/ai/aiForecasts";
import { findLatestForecasts, findLatestInventoryDate, toForecastBasis, type ForecastRow } from "@/lib/ai/algorithmic";
import { usageOnDay } from "@/lib/forecast/demand";
import { loadForecastInputs, type ForecastInputs } from "@/lib/forecast/run";
import type { ForecastItem } from "@/lib/queries/forecastInputs";
import { PAST_NEWS_WINDOW_DAYS, ageInDays, findRecentNews, type RecentNews } from "@/lib/ai/news";
import { findHazeSummary } from "@/lib/haze";

export const CYCLE2_PERSONAS: readonly Persona[] = [
  {
    name: "Hoarder",
    brief: "You fear stockouts above all. Argue for buying more when there is any credible risk, especially for critical items.",
  },
  {
    name: "Budget/waste controller",
    brief: "You fear overstock: wasted budget, expiry and storage cost. Argue against increases that the evidence does not justify.",
  },
  {
    name: "Demand analyst",
    brief: "Neutral. Judge the algorithmic daily usage forecast against current stock and how the validated news changes expected consumption.",
  },
  {
    name: "Supply analyst",
    brief: "Neutral. Judge supply-side risk: open orders, shelf life and whether the news threatens availability.",
  },
];

const CYCLE2_TASK = [
  "For every item in items, re-forecast expected daily usage given the validated news, starting from the algorithmic forecast (algorithmic.usage_by_day).",
  "usage_multiplier: scales the algorithmic usage curve. 1 = no change, 1.3 = 30% more, 0.7 = 30% less. No upper limit: a very serious event can justify a large multiplier.",
  "fade_days: if the effect is temporary, the number of days until usage returns to the algorithmic forecast; null if it lasts.",
  "Never give absolute quantities or dates; they are calculated from your multiplier.",
  "confidence: 0 to 1.",
  "reasoning: why, including why the algorithmic forecast is sufficient or not.",
  "news has the latest council verdict per article and its age in days; older news usually matters less.",
  "haze: air quality (US AQI) for Kuala Lumpur, as daily averages for the last 14 days and weekly averages for the last 8 weeks, with the change vs yesterday and vs last week. Higher haze usually raises respiratory demand (inhalers, nebules, masks, oxygen). It is null when no readings exist.",
  "Only use item_id values from items. Return exactly one forecast per item.",
].join("\n");

export const forecastsSchema = z.object({
  forecasts: z.array(
    z.object({
      item_id: z.number().int(),
      usage_multiplier: z.number().positive(),
      fade_days: z.number().int().positive().nullable(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
  ),
});

type AiForecast = z.infer<typeof forecastsSchema>["forecasts"][number];

const OPEN_ORDER_STATUS = "In transit";
const USAGE_REFERENCE_DAYS = [1, 7, 14, 30] as const;

export type Cycle2Result = { councilRunId: number; forecasts: number; stockAsOf: string | null };

export async function runCycle2(syncRunId: number): Promise<Cycle2Result> {
  const [inputs, forecasts, news, stockAsOf, haze] = await Promise.all([
    loadForecastInputs(),
    findLatestForecasts(),
    findRecentNews(),
    findLatestInventoryDate(),
    findHazeSummary(),
  ]);
  const forecastable = inputs.items.filter((item) => forecasts.has(item.item_id));
  if (forecastable.length === 0) {
    throw new Error("Cycle 2: no algorithmic forecasts found in demand_forecasts");
  }

  const { councilRunId, decision } = await runCouncil({
    syncRunId,
    cycle: 2,
    task: CYCLE2_TASK,
    data: {
      today: new Date().toISOString().slice(0, 10),
      stock_as_of: stockAsOf,
      past_news_window_days: PAST_NEWS_WINDOW_DAYS,
      news: news.filter(isValidated).map(toNewsInput),
      haze,
      items: forecastable.map((item) => toItemInput(item, forecasts, inputs)),
    },
    personas: CYCLE2_PERSONAS,
    opinionSchema: forecastsSchema,
    decisionSchema: forecastsSchema,
    isCompleteOpinion: (opinion) =>
      coversAll(
        opinion.forecasts.map((f) => f.item_id),
        forecastable.map((i) => i.item_id),
      ),
  });

  const aiForecasts = keepKnownItems(decision.forecasts, forecasts);
  const saved = await insertAiForecasts(syncRunId, councilRunId, aiForecasts, forecasts, inputs);
  return { councilRunId, forecasts: saved, stockAsOf };
}

function isValidated(article: RecentNews): boolean {
  return article.latestVerdict?.valid === true;
}

function toNewsInput(article: RecentNews) {
  return {
    article_id: article.articleId,
    source: article.sourceName,
    age_days: ageInDays(article.publishedAt),
    title: article.title,
    summary: article.summary,
    verdict: article.latestVerdict,
  };
}

function toItemInput(item: ForecastItem, forecasts: Map<number, ForecastRow>, inputs: ForecastInputs) {
  const forecast = forecasts.get(item.item_id);
  const dailyRows = inputs.dailyByItem.get(item.item_id) ?? [];
  const latestRow = dailyRows.reduce<(typeof dailyRows)[number] | null>(
    (latest, row) => (!latest || row.inventory_date > latest.inventory_date ? row : latest),
    null,
  );
  return {
    item_id: item.item_id,
    name: item.item_name,
    category: item.category,
    unit: item.unit,
    is_critical: item.is_critical === 1,
    shelf_life_months: item.shelf_life_months,
    stock_on_hand: latestRow?.closing_stock ?? null,
    open_orders: (inputs.purchaseOrdersByItem.get(item.item_id) ?? [])
      .filter((order) => order.status === OPEN_ORDER_STATUS)
      .map((order) => ({ qty: order.qty_ordered, expected_receipt_date: order.expected_receipt_date })),
    algorithmic: forecast ? toAlgorithmicInput(forecast) : null,
  };
}

function toAlgorithmicInput(forecast: ForecastRow) {
  const basis = toForecastBasis(forecast);
  return {
    usage_by_day: Object.fromEntries(
      USAGE_REFERENCE_DAYS.map((day) => [`day_${day}`, Math.round(usageOnDay(basis, day) * 100) / 100]),
    ),
    forecast_from: forecast.forecast_date,
    restock_threshold: forecast.threshold,
    threshold_date: forecast.threshold_date,
    stockout_date: forecast.stockout_date,
    at_or_below_threshold: forecast.triggered,
    cover_days: forecast.cover_days,
    buy_qty: forecast.buy_qty,
    safety_stock: forecast.safety_stock,
    forecast_made_at: forecast.created_at,
  };
}

function keepKnownItems(aiForecasts: AiForecast[], forecasts: Map<number, ForecastRow>): AiForecast[] {
  const seen = new Set<number>();
  return aiForecasts.filter((aiForecast) => {
    if (!forecasts.has(aiForecast.item_id) || seen.has(aiForecast.item_id)) return false;
    seen.add(aiForecast.item_id);
    return true;
  });
}

async function insertAiForecasts(
  syncRunId: number,
  councilRunId: number,
  aiForecasts: AiForecast[],
  forecasts: Map<number, ForecastRow>,
  inputs: ForecastInputs,
): Promise<number> {
  const rows = aiForecasts.flatMap((aiForecast) => {
    const forecast = forecasts.get(aiForecast.item_id);
    if (!forecast) return [];
    const derived = deriveAiForecastFields(inputs, aiForecast.item_id, toForecastBasis(forecast), {
      usageMultiplier: aiForecast.usage_multiplier,
      fadeDays: aiForecast.fade_days,
      elapsedDays: 0,
    });
    if (!derived) return [];
    return [
      {
        sync_run_id: syncRunId,
        item_id: aiForecast.item_id,
        forecast_id: forecast.forecast_id,
        council_run_id: councilRunId,
        usage_multiplier: aiForecast.usage_multiplier,
        fade_days: aiForecast.fade_days,
        confidence: aiForecast.confidence,
        reasoning: aiForecast.reasoning,
        ...derived,
      },
    ];
  });
  if (rows.length === 0) return 0;
  const { error } = await getDb().from("ai_forecasts").insert(rows);
  if (error) throw error;
  return rows.length;
}
