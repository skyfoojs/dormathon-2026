import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";

const FORECAST_LOOKBACK_ROWS = 2000;

const forecastRowSchema = z.object({
  forecast_id: z.number(),
  item_id: z.number(),
  created_at: z.string(),
  target_week_start: z.string(),
  forecast_qty: z.number().nullable(),
  safety_stock: z.number().nullable(),
});

const inventoryDateRowSchema = z.object({ inventory_date: z.string() });

export type ForecastRow = z.infer<typeof forecastRowSchema>;

export async function findLatestForecasts(): Promise<Map<number, ForecastRow>> {
  const { data, error } = await getDb()
    .from("demand_forecasts")
    .select("forecast_id, item_id, created_at, target_week_start, forecast_qty, safety_stock")
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
