import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { dayNumber } from "@/lib/forecast/demand";
import { buildAiForecast, type UsageAdjustment, type ForecastBasis } from "@/lib/forecast/aiForecast";
import type { ForecastInputs } from "@/lib/forecast/run";

const AI_FORECAST_LOOKBACK_ROWS = 2000;

const latestRowSchema = z.object({
  ai_forecast_id: z.number(),
  item_id: z.number(),
  sync_run_id: z.number(),
  council_run_id: z.number().nullable(),
  source_ai_forecast_id: z.number().nullable(),
  threshold: z.number().nullable(),
  buy_qty: z.number().nullable(),
});

const originalRowSchema = z.object({
  ai_forecast_id: z.number(),
  usage_multiplier: z.number(),
  fade_days: z.number().nullable(),
  confidence: z.number().nullable(),
  reasoning: z.string().nullable(),
  demand_forecasts: z.object({ forecast_date: z.string() }),
});

export type LatestAiForecast = {
  aiForecastId: number;
  originalAiForecastId: number;
  syncRunId: number;
  reused: boolean;
  usageMultiplier: number;
  fadeDays: number | null;
  confidence: number | null;
  reasoning: string | null;
  basedOnForecastDate: string;
  threshold: number | null;
  buyQty: number | null;
};

export type AiForecastFields = {
  threshold: number;
  threshold_date: string | null;
  stockout_date: string | null;
  triggered: boolean;
  buy_qty: number;
};

export function toUsageAdjustment(adjustment: LatestAiForecast, forecastDate: string): UsageAdjustment {
  return {
    usageMultiplier: adjustment.usageMultiplier,
    fadeDays: adjustment.fadeDays,
    elapsedDays: Math.max(0, dayNumber(forecastDate) - dayNumber(adjustment.basedOnForecastDate)),
  };
}

export function deriveAiForecastFields(
  inputs: ForecastInputs,
  itemId: number,
  basis: ForecastBasis,
  adjustment: UsageAdjustment,
): AiForecastFields | null {
  const item = inputs.items.find((i) => i.item_id === itemId);
  const aiForecast = buildAiForecast({
    basis,
    adjustment,
    reorderLevel: item?.reorder_level ?? null,
    dailyRows: inputs.dailyByItem.get(itemId) ?? [],
    purchaseOrders: inputs.purchaseOrdersByItem.get(itemId) ?? [],
  });
  if (!aiForecast) return null;
  const { projection, buyQty } = aiForecast;
  return {
    threshold: projection.threshold,
    threshold_date: projection.trigger?.date ?? null,
    stockout_date: projection.stockoutDate,
    triggered: projection.trigger?.alreadyReached ?? false,
    buy_qty: buyQty,
  };
}

export async function findLatestAiForecasts(itemId?: number): Promise<Map<number, LatestAiForecast>> {
  const latest = await findLatestAiForecastPerItem(itemId);
  const originalIds = [...new Set(latest.map(originalIdOf))];
  if (originalIds.length === 0) return new Map();
  const originals = await findOriginals(originalIds);

  const adjustments = new Map<number, LatestAiForecast>();
  for (const row of latest) {
    const original = originals.get(originalIdOf(row));
    if (!original) continue;
    adjustments.set(row.item_id, {
      aiForecastId: row.ai_forecast_id,
      originalAiForecastId: original.ai_forecast_id,
      syncRunId: row.sync_run_id,
      reused: row.council_run_id === null,
      usageMultiplier: original.usage_multiplier,
      fadeDays: original.fade_days,
      confidence: original.confidence,
      reasoning: original.reasoning,
      basedOnForecastDate: original.demand_forecasts.forecast_date,
      threshold: row.threshold,
      buyQty: row.buy_qty,
    });
  }
  return adjustments;
}

function originalIdOf(row: z.infer<typeof latestRowSchema>): number {
  return row.source_ai_forecast_id ?? row.ai_forecast_id;
}

async function findLatestAiForecastPerItem(itemId?: number): Promise<z.infer<typeof latestRowSchema>[]> {
  let query = getDb()
    .from("ai_forecasts")
    .select("ai_forecast_id, item_id, sync_run_id, council_run_id, source_ai_forecast_id, threshold, buy_qty");
  if (itemId) query = query.eq("item_id", itemId);
  const { data, error } = await query.order("ai_forecast_id", { ascending: false }).limit(AI_FORECAST_LOOKBACK_ROWS);
  if (error) throw error;
  const latest = new Map<number, z.infer<typeof latestRowSchema>>();
  for (const row of z.array(latestRowSchema).parse(data)) {
    if (!latest.has(row.item_id)) latest.set(row.item_id, row);
  }
  return [...latest.values()];
}

async function findOriginals(ids: number[]): Promise<Map<number, z.infer<typeof originalRowSchema>>> {
  const { data, error } = await getDb()
    .from("ai_forecasts")
    .select("ai_forecast_id, usage_multiplier, fade_days, confidence, reasoning, demand_forecasts(forecast_date)")
    .in("ai_forecast_id", ids);
  if (error) throw error;
  return new Map(z.array(originalRowSchema).parse(data).map((row) => [row.ai_forecast_id, row]));
}
