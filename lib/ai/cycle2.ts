import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { runCouncil, type Persona } from "@/lib/ai/council";
import { findLatestForecasts, findLatestInventoryDate, type ForecastRow } from "@/lib/ai/internal";
import { PAST_NEWS_WINDOW_DAYS, ageInDays, findRecentNews, type RecentNews } from "@/lib/ai/news";

const CYCLE2_PERSONAS: readonly Persona[] = [
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
    brief: "Neutral. Judge the internal forecast against current stock and how the validated news changes expected consumption.",
  },
  {
    name: "Supply analyst",
    brief: "Neutral. Judge supply-side risk: open orders, shelf life and whether the news threatens availability.",
  },
];

const CYCLE2_TASK = [
  "For every item in items, decide whether the validated news means demand should be higher than, lower than or the same as the internal weekly demand forecast (internal.forecast_qty).",
  "direction: increase, decrease or keep. Never give quantities.",
  "confidence: 0 to 1.",
  "reasoning: why, including why the internal forecast is sufficient or not.",
  "news has the latest council verdict per article and its age in days; older news usually matters less.",
  "Only use item_id values from items. Return exactly one suggestion per item.",
].join("\n");

const suggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      item_id: z.number().int(),
      direction: z.enum(["increase", "decrease", "keep"]),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
  ),
});

const itemRowSchema = z.object({
  item_id: z.number(),
  item_name: z.string().nullable(),
  category: z.string().nullable(),
  unit: z.string().nullable(),
  is_critical: z.number().nullable(),
  shelf_life_months: z.number().nullable(),
  cover_days: z.number().nullable(),
});

const stockRowSchema = z.object({ item_id: z.number(), closing_stock: z.number().nullable() });
const openOrderRowSchema = z.object({
  item_id: z.number().nullable(),
  qty_ordered: z.number().nullable(),
  expected_receipt_date: z.string().nullable(),
});

type ItemRow = z.infer<typeof itemRowSchema>;
type OpenOrderRow = z.infer<typeof openOrderRowSchema>;
type Suggestion = z.infer<typeof suggestionsSchema>["suggestions"][number];
type Stock = { asOf: string | null; byItem: Map<number, number | null> };

const OPEN_ORDER_STATUS = "In transit";

export type Cycle2Result = { councilRunId: number; suggestions: number; stockAsOf: string | null };

export async function runCycle2(syncRunId: number): Promise<Cycle2Result> {
  const [items, forecasts, stock, openOrders, news] = await Promise.all([
    findItems(),
    findLatestForecasts(),
    findLatestStock(),
    findOpenOrders(),
    findRecentNews(),
  ]);
  const forecastable = items.filter((item) => forecasts.has(item.item_id));
  if (forecastable.length === 0) {
    throw new Error("Cycle 2: no internal forecasts found in demand_forecasts");
  }

  const { councilRunId, decision } = await runCouncil({
    syncRunId,
    cycle: 2,
    task: CYCLE2_TASK,
    data: {
      today: new Date().toISOString().slice(0, 10),
      stock_as_of: stock.asOf,
      past_news_window_days: PAST_NEWS_WINDOW_DAYS,
      news: news.filter(isValidated).map(toNewsInput),
      items: forecastable.map((item) => toItemInput(item, forecasts, stock, openOrders)),
    },
    personas: CYCLE2_PERSONAS,
    opinionSchema: suggestionsSchema,
    decisionSchema: suggestionsSchema,
  });

  const suggestions = keepKnownItems(decision.suggestions, forecasts);
  await insertSuggestions(syncRunId, councilRunId, suggestions, forecasts);
  return { councilRunId, suggestions: suggestions.length, stockAsOf: stock.asOf };
}

async function findItems(): Promise<ItemRow[]> {
  const { data, error } = await getDb()
    .from("items")
    .select("item_id, item_name, category, unit, is_critical, shelf_life_months, cover_days")
    .order("item_id");
  if (error) throw error;
  return z.array(itemRowSchema).parse(data);
}

async function findLatestStock(): Promise<Stock> {
  const asOf = await findLatestInventoryDate();
  if (!asOf) return { asOf: null, byItem: new Map() };
  const { data, error } = await getDb()
    .from("daily_inventory")
    .select("item_id, closing_stock")
    .eq("inventory_date", asOf);
  if (error) throw error;
  const rows = z.array(stockRowSchema).parse(data);
  return { asOf, byItem: new Map(rows.map((row) => [row.item_id, row.closing_stock])) };
}

async function findOpenOrders(): Promise<OpenOrderRow[]> {
  const { data, error } = await getDb()
    .from("purchase_orders")
    .select("item_id, qty_ordered, expected_receipt_date")
    .eq("status", OPEN_ORDER_STATUS);
  if (error) throw error;
  return z.array(openOrderRowSchema).parse(data);
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

function toItemInput(item: ItemRow, forecasts: Map<number, ForecastRow>, stock: Stock, openOrders: OpenOrderRow[]) {
  const forecast = forecasts.get(item.item_id);
  return {
    item_id: item.item_id,
    name: item.item_name,
    category: item.category,
    unit: item.unit,
    is_critical: item.is_critical === 1,
    shelf_life_months: item.shelf_life_months,
    cover_days: item.cover_days,
    stock_on_hand: stock.byItem.get(item.item_id) ?? null,
    open_orders: openOrders
      .filter((order) => order.item_id === item.item_id)
      .map((order) => ({ qty: order.qty_ordered, expected_receipt_date: order.expected_receipt_date })),
    internal: forecast
      ? {
          forecast_qty: forecast.forecast_qty,
          safety_stock: forecast.safety_stock,
          target_week_start: forecast.target_week_start,
          forecast_made_at: forecast.created_at,
        }
      : null,
  };
}

function keepKnownItems(suggestions: Suggestion[], forecasts: Map<number, ForecastRow>): Suggestion[] {
  const seen = new Set<number>();
  return suggestions.filter((suggestion) => {
    if (!forecasts.has(suggestion.item_id) || seen.has(suggestion.item_id)) return false;
    seen.add(suggestion.item_id);
    return true;
  });
}

async function insertSuggestions(
  syncRunId: number,
  councilRunId: number,
  suggestions: Suggestion[],
  forecasts: Map<number, ForecastRow>,
): Promise<void> {
  if (suggestions.length === 0) return;
  const rows = suggestions.flatMap((suggestion) => {
    const forecast = forecasts.get(suggestion.item_id);
    if (!forecast) return [];
    return [
      {
        sync_run_id: syncRunId,
        item_id: suggestion.item_id,
        forecast_id: forecast.forecast_id,
        council_run_id: councilRunId,
        direction: suggestion.direction,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
      },
    ];
  });
  const { error } = await getDb().from("ai_suggestions").insert(rows);
  if (error) throw error;
}
