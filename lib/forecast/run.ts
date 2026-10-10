import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  buildDailyDemandSeries,
  forecastItem,
  usageOnDay,
  type DailyStockRow,
  type DemandForecast,
  type SupplyOrderRow,
} from "@/lib/forecast/demand";
import { projectStock, type StockProjection } from "@/lib/forecast/runout";
import {
  findDailyStockRows,
  findForecastItems,
  findForecastSuppliers,
  findSupplyOrders,
  type ForecastItem,
  type ForecastSupplier,
} from "@/lib/queries/forecastInputs";

export type ForecastInputs = {
  items: ForecastItem[];
  suppliers: ForecastSupplier[];
  dailyByItem: Map<number, DailyStockRow[]>;
  purchaseOrdersByItem: Map<number, SupplyOrderRow[]>;
};

export type ItemForecast = { item: ForecastItem; forecast: DemandForecast; projection: StockProjection };

export type ForecastRunResult = { saved: number; skipped: number; actualsFilled: number };

const openForecastRowSchema = z.object({ forecast_id: z.number(), item_id: z.number(), forecast_date: z.string() });
const savedForecastRowSchema = z.object({ item_id: z.number(), forecast_date: z.string() });

export async function loadForecastInputs(itemId?: number): Promise<ForecastInputs> {
  const [items, suppliers, daily, purchaseOrders] = await Promise.all([
    findForecastItems(),
    findForecastSuppliers(),
    findDailyStockRows(itemId),
    findSupplyOrders(itemId),
  ]);
  return {
    items: itemId ? items.filter((item) => item.item_id === itemId) : items,
    suppliers,
    dailyByItem: groupByItem(daily),
    purchaseOrdersByItem: groupByItem(purchaseOrders),
  };
}

export function computeItemForecasts(inputs: ForecastInputs): ItemForecast[] {
  const supplierById = new Map(inputs.suppliers.map((s) => [s.supplier_id, s]));
  return inputs.items.flatMap((item) => {
    const dailyRows = inputs.dailyByItem.get(item.item_id) ?? [];
    const purchaseOrders = inputs.purchaseOrdersByItem.get(item.item_id) ?? [];
    const forecast = forecastItem({
      item,
      dailyRows,
      purchaseOrders,
      supplier: supplierById.get(item.primary_supplier_id),
    });
    const projection = forecast
      ? projectStock({
          dailyRows,
          purchaseOrders,
          usage: (h) => usageOnDay(forecast, h),
          threshold: item.reorder_level ?? forecast.reorderPoint,
        })
      : null;
    return forecast && projection ? [{ item, forecast, projection }] : [];
  });
}

// The forecast run: score forecasts whose day has passed, then save the new
// ones. Scoring goes first so a forecast is never scored by its own run.
export async function runForecasts(): Promise<ForecastRunResult> {
  const inputs = await loadForecastInputs();
  const actualsFilled = await fillActuals(inputs.dailyByItem);
  const forecasts = computeItemForecasts(inputs);
  const saved = await insertNewForecasts(forecasts);
  return { saved, skipped: forecasts.length - saved, actualsFilled };
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

// Sets actual_qty on saved forecasts whose forecast day now has demand data.
async function fillActuals(dailyByItem: Map<number, DailyStockRow[]>): Promise<number> {
  const db = getDb();
  const { data, error } = await db
    .from("demand_forecasts")
    .select("forecast_id, item_id, forecast_date")
    .is("actual_qty", null);
  if (error) throw error;

  const demandByItem = new Map<number, Map<string, number>>();
  const scored: { forecastId: number; actualQty: number }[] = [];
  for (const row of z.array(openForecastRowSchema).parse(data)) {
    let demand = demandByItem.get(row.item_id);
    if (!demand) {
      const series = buildDailyDemandSeries(dailyByItem.get(row.item_id) ?? []);
      demand = new Map(series.map((p) => [p.date, p.demand]));
      demandByItem.set(row.item_id, demand);
    }
    const actual = demand.get(row.forecast_date);
    if (actual !== undefined) scored.push({ forecastId: row.forecast_id, actualQty: Math.round(actual) });
  }

  await Promise.all(
    scored.map(async ({ forecastId, actualQty }) => {
      const { error: updateError } = await db
        .from("demand_forecasts")
        .update({ actual_qty: actualQty })
        .eq("forecast_id", forecastId);
      if (updateError) throw updateError;
    }),
  );
  return scored.length;
}

// Saves one row per item, skipping items already saved today for the same
// forecast day so a rerun on the same day is harmless.
async function insertNewForecasts(forecasts: ItemForecast[]): Promise<number> {
  if (forecasts.length === 0) return 0;
  const db = getDb();
  const startOfToday = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
  const { data, error } = await db
    .from("demand_forecasts")
    .select("item_id, forecast_date")
    .in("forecast_date", [...new Set(forecasts.map((f) => f.forecast.forecastDate))])
    .gte("created_at", startOfToday);
  if (error) throw error;

  const alreadySaved = new Set(
    z
      .array(savedForecastRowSchema)
      .parse(data)
      .map((r) => `${r.item_id}:${r.forecast_date}`),
  );
  const rows = forecasts
    .filter((f) => !alreadySaved.has(`${f.item.item_id}:${f.forecast.forecastDate}`))
    .map(toForecastRow);
  if (rows.length === 0) return 0;

  const { error: insertError } = await db.from("demand_forecasts").insert(rows);
  if (insertError) throw insertError;
  return rows.length;
}

function toForecastRow({ forecast: f, projection: p }: ItemForecast) {
  return {
    item_id: f.itemId,
    forecast_date: f.forecastDate,
    history_days: f.historyDays,
    alpha: f.alpha,
    beta: f.beta,
    phi: f.phi,
    holt_level: f.holtLevel,
    holt_trend: f.holtTrend,
    wma_qty: f.wmaQty,
    holt_weight: f.holtWeight,
    usage_per_day: f.usagePerDay,
    sigma: f.sigma,
    z: f.z,
    lead_days: f.leadDays,
    safety_stock: f.safetyStock,
    stock_left: f.stockLeft,
    stock_as_of: f.stockAsOf,
    threshold: p.threshold,
    threshold_date: p.trigger?.date ?? null,
    stockout_date: p.stockoutDate,
    triggered: p.trigger?.alreadyReached ?? false,
    cover_days: f.coverDays,
    buy_qty: f.buyQty,
  };
}
