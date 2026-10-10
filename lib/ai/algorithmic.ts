import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { DEFAULT_COVER_DAYS, TREND_DAMPING } from "@/lib/forecast/demand";
import type { ForecastBasis } from "@/lib/forecast/aiForecast";

const FORECAST_LOOKBACK_ROWS = 2000;

const FORECAST_COLUMNS =
  "forecast_id, item_id, created_at, forecast_date, usage_per_day, phi, holt_level, holt_trend, wma_qty, holt_weight, safety_stock, lead_days, cover_days, threshold, threshold_date, stockout_date, triggered, buy_qty";

const forecastRowSchema = z.object({
  forecast_id: z.number(),
  item_id: z.number(),
  created_at: z.string(),
  forecast_date: z.string(),
  usage_per_day: z.number(),
  phi: z.number().nullable(),
  holt_level: z.number().nullable(),
  holt_trend: z.number().nullable(),
  wma_qty: z.number().nullable(),
  holt_weight: z.number().nullable(),
  safety_stock: z.number().nullable(),
  lead_days: z.number().nullable(),
  threshold: z.number().nullable(),
  threshold_date: z.string().nullable(),
  stockout_date: z.string().nullable(),
  triggered: z.boolean(),
  cover_days: z.number().nullable(),
  buy_qty: z.number().nullable(),
});

const inventoryDateRowSchema = z.object({ inventory_date: z.string() });

export type ForecastRow = z.infer<typeof forecastRowSchema>;

export async function findLatestForecasts(itemId?: number): Promise<Map<number, ForecastRow>> {
  let query = getDb().from("demand_forecasts").select(FORECAST_COLUMNS);
  if (itemId) query = query.eq("item_id", itemId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("forecast_id", { ascending: false })
    .limit(FORECAST_LOOKBACK_ROWS);
  if (error) throw error;
  const latest = new Map<number, ForecastRow>();
  for (const row of z.array(forecastRowSchema).parse(data)) {
    if (!latest.has(row.item_id)) latest.set(row.item_id, row);
  }
  return latest;
}

export async function findLatestInventoryDate(): Promise<string | null> {
  const { data, error } = await getDb()
    .from("daily_inventory")
    .select("inventory_date")
    .order("inventory_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? inventoryDateRowSchema.parse(data).inventory_date : null;
}

export function toForecastBasis(row: ForecastRow): ForecastBasis {
  return {
    phi: row.phi ?? TREND_DAMPING,
    holtLevel: row.holt_level,
    holtTrend: row.holt_trend,
    wmaQty: row.wma_qty,
    holtWeight: row.holt_weight,
    usagePerDay: row.usage_per_day,
    safetyStock: row.safety_stock ?? 0,
    leadDays: row.lead_days ?? 0,
    coverDays: row.cover_days ?? DEFAULT_COVER_DAYS,
  };
}
