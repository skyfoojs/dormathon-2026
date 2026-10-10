import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";
import { generateForecastsForFacility } from "@/lib/forecast/generateForecasts";

const querySchema = z.object({
  facility_id: z.coerce.number().int().min(1),
});

// Reads stored forecasts for a facility, generating them first if none
// exist yet (lazy backfill; see generateForecastsForFacility). A fresh
// weekly_inventory load should re-run generation, which this also supports
// via the force=1 query flag.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { facility_id } = querySchema.parse({ facility_id: searchParams.get("facility_id") ?? undefined });
    const force = searchParams.get("force") === "1";

    const db = getDb();
    if (force) {
      await generateForecastsForFacility(facility_id, new Date().toISOString().slice(0, 10));
    } else {
      const { count, error: countError } = await db
        .from("demand_forecast_backtests")
        .select("forecast_id", { count: "exact", head: true })
        .eq("facility_id", facility_id);
      if (countError) throw countError;
      if (!count) {
        await generateForecastsForFacility(facility_id, new Date().toISOString().slice(0, 10));
      }
    }

    const { data, error } = await db
      .from("demand_forecast_backtests")
      .select("*")
      .eq("facility_id", facility_id)
      .order("target_week_start", { ascending: true });
    if (error) throw error;
    return ok(data ?? []);
  } catch (err) {
    return errorResponse(err);
  }
}
