import "server-only";
import { getDb } from "@/lib/db";
import { forecastNext } from "@/lib/forecast/holtWma";
import type { DemandForecast, WeeklyInventory } from "@/lib/db/types";

const ALPHA = 0.4;
const BETA = 0.2;
const FORECAST_WEEKS_AHEAD = 4;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Rolling one-week-ahead backtest over the item's real weekly_inventory
// history, plus a flat 4-week-ahead forecast from the latest week, exactly
// per docs/Internal-Calculation.md. Demand = issued_qty + unmet_demand_qty.
export function buildForecastRows(
  facilityId: number,
  itemId: number,
  weeklyRows: WeeklyInventory[],
  madeOn: string,
): Omit<DemandForecast, "forecast_id">[] {
  const rows = [...weeklyRows].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const demand = rows.map((r) => r.issued_qty + r.unmet_demand_qty);
  const weeks = rows.map((r) => r.week_start);
  const out: Omit<DemandForecast, "forecast_id">[] = [];

  for (let i = 4; i < demand.length; i++) {
    const history = demand.slice(0, i);
    const { holtQty, wmaQty, avgQty } = forecastNext(history, ALPHA, BETA);
    out.push({
      facility_id: facilityId,
      item_id: itemId,
      made_on: weeks[i - 1],
      target_week_start: weeks[i],
      history_weeks: history.length,
      alpha: ALPHA,
      beta: BETA,
      holt_qty: holtQty,
      wma_qty: wmaQty,
      avg_qty: avgQty,
      actual_qty: demand[i],
    });
  }

  if (demand.length >= 4) {
    const { holtQty, wmaQty, avgQty } = forecastNext(demand, ALPHA, BETA);
    const lastWeek = weeks[weeks.length - 1];
    for (let k = 1; k <= FORECAST_WEEKS_AHEAD; k++) {
      out.push({
        facility_id: facilityId,
        item_id: itemId,
        made_on: madeOn,
        target_week_start: addDays(lastWeek, 7 * k),
        history_weeks: demand.length,
        alpha: ALPHA,
        beta: BETA,
        holt_qty: holtQty,
        wma_qty: wmaQty,
        avg_qty: avgQty, // held flat over the horizon, per the doc
        actual_qty: null,
      });
    }
  }

  return out;
}

export async function generateForecastsForFacility(facilityId: number, madeOn: string): Promise<number> {
  const db = getDb();
  const { data: weekly, error } = await db
    .from("weekly_inventory")
    .select("record_id, facility_id, item_id, week_start, issued_qty, unmet_demand_qty")
    .eq("facility_id", facilityId);
  if (error) throw error;

  const byItem = new Map<number, WeeklyInventory[]>();
  for (const r of (weekly ?? []) as WeeklyInventory[]) {
    const list = byItem.get(r.item_id) ?? [];
    list.push(r);
    byItem.set(r.item_id, list);
  }

  const allRows: Omit<DemandForecast, "forecast_id">[] = [];
  for (const [itemId, rows] of byItem) {
    allRows.push(...buildForecastRows(facilityId, itemId, rows, madeOn));
  }
  if (allRows.length === 0) return 0;

  const { error: upsertError } = await db
    .from("demand_forecast_backtests")
    .upsert(allRows, { onConflict: "facility_id,item_id,target_week_start,made_on" });
  if (upsertError) throw upsertError;
  return allRows.length;
}
