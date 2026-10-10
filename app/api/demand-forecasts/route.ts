import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";
import type { DemandForecast } from "@/lib/db/types";

const querySchema = z.object({
  facility_id: z.coerce.number().int().min(1),
});

const forecastRowSchema = z.object({
  item_id: z.number(),
  forecast_date: z.string(),
  usage_per_day: z.number(),
  actual_qty: z.number().nullable(),
});

const usageRowSchema = z.object({
  item_id: z.number(),
  inventory_date: z.string(),
  issued_qty: z.number().nullable(),
  unmet_demand_qty: z.number().nullable(),
});

// Stored forecasts come from public.demand_forecasts. A forecast's own
// actual_qty is filled in later (or not at all), so where it is still null
// the real usage for that day is looked up in daily_inventory, if that day
// has been recorded by now. Days with no recorded usage stay unscored.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { facility_id } = querySchema.parse({ facility_id: searchParams.get("facility_id") ?? undefined });

    const db = getDb();
    const { data, error } = await db
      .from("demand_forecasts")
      .select("item_id, forecast_date, usage_per_day, actual_qty")
      .order("forecast_date", { ascending: true });
    if (error) throw error;
    const forecasts = z.array(forecastRowSchema).parse(data);

    const missing = forecasts.filter((f) => f.actual_qty === null);
    const usage = new Map<string, number>();
    if (missing.length > 0) {
      const { data: usageData, error: usageError } = await db
        .from("daily_inventory")
        .select("item_id, inventory_date, issued_qty, unmet_demand_qty")
        .eq("facility_id", facility_id)
        .in("item_id", [...new Set(missing.map((f) => f.item_id))])
        .in("inventory_date", [...new Set(missing.map((f) => f.forecast_date))]);
      if (usageError) throw usageError;
      for (const row of z.array(usageRowSchema).parse(usageData)) {
        usage.set(`${row.item_id}|${row.inventory_date}`, (row.issued_qty ?? 0) + (row.unmet_demand_qty ?? 0));
      }
    }

    const rows: DemandForecast[] = forecasts.map((f) => ({
      item_id: f.item_id,
      forecast_date: f.forecast_date,
      expected_qty: f.usage_per_day,
      actual_qty: f.actual_qty ?? usage.get(`${f.item_id}|${f.forecast_date}`) ?? null,
    }));
    return ok(rows);
  } catch (err) {
    return errorResponse(err);
  }
}
