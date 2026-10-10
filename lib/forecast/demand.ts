// Demand forecasting: Holt's linear trend + 4-week weighted moving average,
// combined, with the safety stock that goes on top. Implements
// docs/Internal-Calculation.md; section names in comments refer to that doc.
// Pure functions only, so the same code runs in a route handler or a script.
//
// Nothing here is facility-aware: the database holds one facility, and the
// facilities table and facility_id columns are due to be dropped. Callers
// pass every row for an item, and the row types below leave facility_id out.

import type { Item, PurchaseOrder, Supplier } from "@/lib/db/types";

// One row of daily_inventory, the source for both demand and stock on hand.
export type DailyStockRow = {
  item_id: number;
  inventory_date: string;
  issued_qty: number;
  unmet_demand_qty: number | null;
  closing_stock: number;
};
type DemandWeekRow = { week_start: string; issued_qty: number; unmet_demand_qty: number };
export type SupplyOrderRow = Pick<
  PurchaseOrder,
  "item_id" | "order_date" | "qty_ordered" | "expected_receipt_date" | "actual_receipt_date" | "qty_received" | "status"
>;

export const DEFAULT_ALPHA = 0.4;
export const DEFAULT_BETA = 0.2;
const Z_CRITICAL = 2.05; // 98% service level
const Z_STANDARD = 1.65; // 95% service level
const MIN_WEEKS_FOR_METHODS = 4;
const MIN_WEEKS_FOR_TUNING = 12;
const MIN_ERRORS_FOR_SCORING = 8;
const MIN_WEIGHT = 0.25;
const MAX_WEIGHT = 0.75;
const MAX_INTERPOLATED_GAP_WEEKS = 2;
// Used only when an item has too few purchase orders to measure its own
// ordering rhythm. 3 weeks is the cadence observed in the doc's sample.
const FALLBACK_REVIEW_WEEKS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DemandPoint = { weekStart: string; demand: number };

export type DemandForecast = {
  itemId: number;
  targetWeekStart: string;
  historyWeeks: number;
  alpha: number | null;
  beta: number | null;
  holtQty: number | null;
  wmaQty: number | null;
  holtWeight: number | null;
  forecastQty: number;
  scoredWeeks: number;
  holtMae: number | null;
  wmaMae: number | null;
  naiveMae: number | null;
  sigma: number;
  sigmaSource: "forecast-errors" | "demand";
  z: number;
  reviewWeeks: number;
  leadWeeks: number;
  fillRate: number;
  onHand: number;
  onOrder: number;
  safetyStock: number;
  orderUpTo: number;
};

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// Sample (n - 1) standard deviation, which is what the doc's worked example
// uses (8.5 for 56, 63, 55, 69, 75).
function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

export function dayNumber(isoDate: string): number {
  return Math.round(Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) / MS_PER_DAY);
}

export function addDays(isoDate: string, days: number): string {
  return new Date((dayNumber(isoDate) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

// Sums daily rows into Monday-start weeks. Only complete weeks (7 daily
// rows) are kept, so a part-recorded week never reads as a drop in demand.
export function toWeeklyDemandRows(dailyRows: DailyStockRow[]): DemandWeekRow[] {
  const weeks = new Map<string, DemandWeekRow & { days: number }>();
  for (const row of dailyRows) {
    const day = dayNumber(row.inventory_date);
    // Day 0 (1 Jan 1970) was a Thursday, so (day + 3) % 7 is days since Monday.
    const weekStart = addDays(row.inventory_date, -((day + 3) % 7));
    const week = weeks.get(weekStart) ?? { week_start: weekStart, issued_qty: 0, unmet_demand_qty: 0, days: 0 };
    week.issued_qty += row.issued_qty;
    week.unmet_demand_qty += row.unmet_demand_qty ?? 0;
    week.days += 1;
    weeks.set(weekStart, week);
  }
  return [...weeks.values()]
    .filter((w) => w.days === 7)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}

// Demand series: issued + unmet demand per week, oldest first. Gaps of 1 or 2
// weeks are filled by linear interpolation; a longer gap restarts the series,
// so only the weeks after the last long gap are returned.
export function buildDemandSeries(rows: DemandWeekRow[]): DemandPoint[] {
  const sorted = [...rows].sort((a, b) => a.week_start.localeCompare(b.week_start));
  let series: DemandPoint[] = [];
  for (const row of sorted) {
    const point = { weekStart: row.week_start, demand: row.issued_qty + row.unmet_demand_qty };
    const prev = series[series.length - 1];
    if (prev) {
      const missing = Math.round((dayNumber(point.weekStart) - dayNumber(prev.weekStart)) / 7) - 1;
      if (missing > MAX_INTERPOLATED_GAP_WEEKS) {
        series = [];
      } else {
        for (let k = 1; k <= missing; k++) {
          series.push({
            weekStart: addDays(prev.weekStart, 7 * k),
            demand: prev.demand + ((point.demand - prev.demand) * k) / (missing + 1),
          });
        }
      }
    }
    series.push(point);
  }
  return series;
}

// Method A. Returns the one-week-ahead forecast made after each week, so
// result[i] is the forecast for week i + 1 (result[0] is undefined: one week
// cannot start a trend). The last entry is the forecast for the next week.
function holtOneStepForecasts(y: number[], alpha: number, beta: number): (number | undefined)[] {
  const forecasts: (number | undefined)[] = [undefined];
  if (y.length < 2) return forecasts;
  let level = y[1];
  let trend = y[1] - y[0];
  forecasts.push(Math.max(level + trend, 0));
  for (let i = 2; i < y.length; i++) {
    const prevLevel = level;
    level = alpha * y[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    forecasts.push(Math.max(level + trend, 0));
  }
  return forecasts;
}

export function holt(y: number[], alpha = DEFAULT_ALPHA, beta = DEFAULT_BETA): number {
  return holtOneStepForecasts(y, alpha, beta)[y.length - 1] ?? 0;
}

// Method B: the newest week counts 4 times and the oldest once.
export function wma4(y: number[]): number {
  const last = y.slice(-4);
  const weights = [1, 2, 3, 4].slice(-last.length);
  return last.reduce((sum, v, i) => sum + v * weights[i], 0) / weights.reduce((a, b) => a + b, 0);
}

// Picks alpha (0.1 to 0.9) and beta (0.05 to 0.5) by lowest mean absolute
// error on rolling one-week-ahead forecasts. Defaults below 12 weeks.
export function tuneHolt(y: number[]): { alpha: number; beta: number } {
  let best = { alpha: DEFAULT_ALPHA, beta: DEFAULT_BETA };
  if (y.length < MIN_WEEKS_FOR_TUNING) return best;
  let bestMae = Infinity;
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 10; b++) {
      const alpha = a / 10;
      const beta = b / 20;
      const forecasts = holtOneStepForecasts(y, alpha, beta);
      const errors: number[] = [];
      for (let t = 2; t < y.length; t++) errors.push(Math.abs((forecasts[t - 1] as number) - y[t]));
      const mae = mean(errors);
      if (mae < bestMae) {
        bestMae = mae;
        best = { alpha, beta };
      }
    }
  }
  return best;
}

type Backtest = { actual: number[]; holt: number[]; wma: number[]; naive: number[] };

// Rolling one-week-ahead backtest: each forecast uses only earlier weeks.
// Holt's alpha and beta are tuned on the same weeks, so its error here is
// slightly flattering; the 25% to 75% weight cap limits the effect.
function backtest(y: number[], alpha: number, beta: number): Backtest {
  const holtForecasts = holtOneStepForecasts(y, alpha, beta);
  const result: Backtest = { actual: [], holt: [], wma: [], naive: [] };
  for (let t = MIN_WEEKS_FOR_METHODS; t < y.length; t++) {
    result.actual.push(y[t]);
    result.holt.push(holtForecasts[t - 1] as number);
    result.wma.push(wma4(y.slice(0, t)));
    result.naive.push(y[t - 1]);
  }
  return result;
}

function mae(forecasts: number[], actual: number[]): number {
  return mean(forecasts.map((f, i) => Math.abs(f - actual[i])));
}

// Weights each method by 1 / MAE, capped so neither is switched off.
function holtWeightFromErrors(holtMae: number, wmaMae: number): number {
  if (holtMae === 0 && wmaMae === 0) return 0.5;
  const raw = wmaMae / (holtMae + wmaMae);
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, raw));
}

type SupplyParams = { reviewWeeks: number; leadWeeks: number; fillRate: number; onOrder: number };

function daysBetween(fromIso: string, toIso: string): number {
  return dayNumber(toIso) - dayNumber(fromIso);
}

// Review period, lead time, fill rate and stock on order, measured from the
// item's own purchase orders.
export function getSupplyParams(
  purchaseOrders: SupplyOrderRow[],
  supplier: Pick<Supplier, "lead_time_days"> | undefined,
): SupplyParams {
  const placed = purchaseOrders.filter((po) => po.status !== "Cancelled");
  const delivered = placed.filter(
    (po) => po.status === "Delivered" && po.actual_receipt_date && po.qty_received !== null,
  );

  const orderDays = [...new Set(placed.map((po) => dayNumber(po.order_date)))].sort((a, b) => a - b);
  const gaps = orderDays.slice(1).map((d, i) => d - orderDays[i]);
  const reviewWeeks = gaps.length ? mean(gaps) / 7 : FALLBACK_REVIEW_WEEKS;

  const leadDays = delivered.map((po) => daysBetween(po.order_date, po.actual_receipt_date as string));
  const leadWeeks = leadDays.length ? mean(leadDays) / 7 : (supplier?.lead_time_days ?? 7) / 7;

  const fills = delivered
    .filter((po) => po.qty_ordered > 0)
    .map((po) => Math.min(1, (po.qty_received as number) / po.qty_ordered));
  const fillRate = fills.length && mean(fills) > 0 ? mean(fills) : 1;

  const onOrder = placed
    .filter((po) => po.status === "In transit")
    .reduce((sum, po) => sum + po.qty_ordered, 0);

  return { reviewWeeks, leadWeeks: Math.max(0, leadWeeks), fillRate, onOrder };
}

// Combining and ordering: SS = z * sigma * sqrt(R + L), S = d * (R + L) + SS.
export function orderUpToLevel(input: {
  forecastQty: number;
  sigma: number;
  z: number;
  reviewWeeks: number;
  leadWeeks: number;
}): { safetyStock: number; orderUpTo: number } {
  const cover = input.reviewWeeks + input.leadWeeks;
  const safetyStock = input.z * input.sigma * Math.sqrt(cover);
  return { safetyStock, orderUpTo: input.forecastQty * cover + safetyStock };
}

// One item's demand forecast for the week after its last complete week. Returns null when the item has no usable history.
export function forecastItem(input: {
  item: Pick<Item, "item_id" | "is_critical">;
  dailyRows: DailyStockRow[];
  purchaseOrders: SupplyOrderRow[];
  supplier?: Pick<Supplier, "lead_time_days">;
}): DemandForecast | null {
  const series = buildDemandSeries(toWeeklyDemandRows(input.dailyRows));
  if (series.length === 0) return null;
  const y = series.map((p) => p.demand);
  const latestRow = [...input.dailyRows].sort((a, b) => a.inventory_date.localeCompare(b.inventory_date)).pop();
  const supply = getSupplyParams(input.purchaseOrders, input.supplier);
  const z = input.item.is_critical === 1 ? Z_CRITICAL : Z_STANDARD;

  let alpha: number | null = null;
  let beta: number | null = null;
  let holtQty: number | null = null;
  let wmaQty: number | null = null;
  let holtWeight: number | null = null;
  let holtMae: number | null = null;
  let wmaMae: number | null = null;
  let naiveMae: number | null = null;
  let scoredWeeks = 0;
  let forecastQty = mean(y);
  let sigma = sampleStdDev(y);
  let sigmaSource: DemandForecast["sigmaSource"] = "demand";

  if (y.length >= MIN_WEEKS_FOR_METHODS) {
    ({ alpha, beta } = tuneHolt(y));
    holtQty = holt(y, alpha, beta);
    wmaQty = wma4(y);
    holtWeight = 0.5;

    const scored = backtest(y, alpha, beta);
    scoredWeeks = scored.actual.length;
    if (scoredWeeks > 0) {
      holtMae = mae(scored.holt, scored.actual);
      wmaMae = mae(scored.wma, scored.actual);
      naiveMae = mae(scored.naive, scored.actual);
    }
    if (scoredWeeks >= MIN_ERRORS_FOR_SCORING && holtMae !== null && wmaMae !== null) {
      const weight = holtWeightFromErrors(holtMae, wmaMae);
      holtWeight = weight;
      const combinedErrors = scored.actual.map(
        (actual, i) => weight * scored.holt[i] + (1 - weight) * scored.wma[i] - actual,
      );
      sigma = sampleStdDev(combinedErrors);
      sigmaSource = "forecast-errors";
    }
    forecastQty = holtWeight * holtQty + (1 - holtWeight) * wmaQty;
  }

  const onHand = latestRow?.closing_stock ?? 0;
  const order = orderUpToLevel({ forecastQty, sigma, z, ...supply });

  return {
    itemId: input.item.item_id,
    targetWeekStart: addDays(series[series.length - 1].weekStart, 7),
    historyWeeks: y.length,
    alpha,
    beta,
    holtQty,
    wmaQty,
    holtWeight,
    forecastQty,
    scoredWeeks,
    holtMae,
    wmaMae,
    naiveMae,
    sigma,
    sigmaSource,
    z,
    ...supply,
    onHand,
    ...order,
  };
}
