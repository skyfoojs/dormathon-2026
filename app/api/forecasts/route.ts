import { getDb } from "@/lib/db";
import { created, errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";
import {
  buildDemandSeries,
  forecastItem,
  type DemandForecast,
  toWeeklyDemandRows,
  type DailyStockRow,
  type SupplyOrderRow,
} from "@/lib/forecast/demand";
import {
  findForecastItems,
  findForecastSuppliers,
  findSupplyOrders,
  findDailyStockRows,
  type ForecastSupplier,
} from "@/lib/queries/forecastInputs";
import type { Item } from "@/lib/db/types";

type ForecastInputs = {
  items: Item[];
  suppliers: ForecastSupplier[];
  dailyByItem: Map<number, DailyStockRow[]>;
  purchaseOrdersByItem: Map<number, SupplyOrderRow[]>;
};

// Computes the forecast for every item from live data. Nothing is saved.
export async function GET(req: Request) {
  try {
    const pagination = parsePagination(new URL(req.url).searchParams);
    const inputs = await loadForecastInputs();
    const rows = computeForecasts(inputs).map((f) => toForecastDto(f, inputs.items));
    const [from, to] = toRange(pagination);
    return ok(rows.slice(from, to + 1), { ...pagination, total: rows.length });
  } catch (err) {
    return errorResponse(err);
  }
}

// The weekly run: score forecasts whose week has closed, then save the new
// ones. Scoring goes first so a forecast is never scored by its own run.
export async function POST() {
  try {
    const inputs = await loadForecastInputs();
    const actualsFilled = await fillActuals(inputs.dailyByItem);
    const forecasts = computeForecasts(inputs);
    const saved = await insertNewForecasts(forecasts);
    return created({ saved, skipped: forecasts.length - saved, actualsFilled });
  } catch (err) {
    return errorResponse(err);
  }
}

async function loadForecastInputs(): Promise<ForecastInputs> {
  const [items, suppliers, daily, purchaseOrders] = await Promise.all([
    findForecastItems(),
    findForecastSuppliers(),
    findDailyStockRows(),
    findSupplyOrders(),
  ]);
  return {
    items,
    suppliers,
    dailyByItem: groupByItem(daily),
    purchaseOrdersByItem: groupByItem(purchaseOrders),
  };
}

function groupByItem<T extends { item_id: number }>(rows: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const list = groups.get(row.item_id);
    if (list) list.push(row);
    else groups.set(row.item_id, [row]);
  }
  return groups;
}

function computeForecasts(inputs: ForecastInputs): DemandForecast[] {
  const supplierById = new Map(inputs.suppliers.map((s) => [s.supplier_id, s]));
  const forecasts: DemandForecast[] = [];
  for (const item of inputs.items) {
    const forecast = forecastItem({
      item,
      dailyRows: inputs.dailyByItem.get(item.item_id) ?? [],
      purchaseOrders: inputs.purchaseOrdersByItem.get(item.item_id) ?? [],
      supplier: supplierById.get(item.primary_supplier_id),
    });
    if (forecast) forecasts.push(forecast);
  }
  return forecasts;
}

function toForecastDto(forecast: DemandForecast, items: Item[]) {
  const item = items.find((i) => i.item_id === forecast.itemId);
  return {
    ...forecast,
    itemName: item?.item_name ?? "",
    unit: item?.unit ?? "",
    isCritical: item?.is_critical === 1,
  };
}

// Sets actual_qty on saved forecasts whose target week now has demand data.
async function fillActuals(dailyByItem: Map<number, DailyStockRow[]>): Promise<number> {
  const db = getDb();
  const { data: open, error } = await db
    .from("demand_forecasts")
    .select("forecast_id, item_id, target_week_start")
    .is("actual_qty", null);
  if (error) throw error;

  const demandByItem = new Map<number, Map<string, number>>();
  const scored = [];
  for (const row of open ?? []) {
    let demand = demandByItem.get(row.item_id);
    if (!demand) {
      const series = buildDemandSeries(toWeeklyDemandRows(dailyByItem.get(row.item_id) ?? []));
      demand = new Map(series.map((p) => [p.weekStart, p.demand]));
      demandByItem.set(row.item_id, demand);
    }
    const actual = demand.get(row.target_week_start);
    if (actual !== undefined) scored.push({ ...row, actual_qty: Math.round(actual) });
  }
  if (scored.length === 0) return 0;

  // One statement for all rows: every forecast_id already exists, so the
  // upsert only ever takes its update branch.
  const { error: updateError } = await db.from("demand_forecasts").upsert(scored, { onConflict: "forecast_id" });
  if (updateError) throw updateError;
  return scored.length;
}

// Saves one row per item, skipping items already saved today for the same
// target week so a rerun on the same day is harmless.
async function insertNewForecasts(forecasts: DemandForecast[]): Promise<number> {
  if (forecasts.length === 0) return 0;
  const db = getDb();
  const startOfToday = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
  const { data: existing, error } = await db
    .from("demand_forecasts")
    .select("item_id, target_week_start")
    .in("target_week_start", [...new Set(forecasts.map((f) => f.targetWeekStart))])
    .gte("created_at", startOfToday);
  if (error) throw error;

  const alreadySaved = new Set((existing ?? []).map((r) => `${r.item_id}:${r.target_week_start}`));
  const rows = forecasts
    .filter((f) => !alreadySaved.has(`${f.itemId}:${f.targetWeekStart}`))
    .map(toForecastRow);
  if (rows.length === 0) return 0;

  const { error: insertError } = await db.from("demand_forecasts").insert(rows);
  if (insertError) throw insertError;
  return rows.length;
}

function toForecastRow(f: DemandForecast) {
  return {
    item_id: f.itemId,
    target_week_start: f.targetWeekStart,
    history_weeks: f.historyWeeks,
    alpha: f.alpha,
    beta: f.beta,
    holt_qty: f.holtQty,
    wma_qty: f.wmaQty,
    forecast_qty: f.forecastQty,
    sigma: f.sigma,
    z: f.z,
    review_weeks: f.reviewWeeks,
    lead_weeks: f.leadWeeks,
    fill_rate: f.fillRate,
    on_hand: f.onHand,
    on_order: f.onOrder,
    safety_stock: f.safetyStock,
  };
}
