// Demand forecasting, daily: Holt's linear trend (damped) + 28-day weighted
// moving average, combined, with the safety stock that goes on top. Adapts
// docs/Internal-Calculation.md from weeks to days.
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
export type SupplyOrderRow = Pick<
  PurchaseOrder,
  "item_id" | "order_date" | "qty_ordered" | "expected_receipt_date" | "actual_receipt_date" | "qty_received" | "status"
>;

export const DEFAULT_ALPHA = 0.4;
export const DEFAULT_BETA = 0.05;
export const TREND_DAMPING = 0.95;
export const DEFAULT_COVER_DAYS = 30;
const Z_CRITICAL = 2.05; // 98% service level
const Z_STANDARD = 1.65; // 95% service level
const MIN_DAYS_FOR_METHODS = 28;
const MIN_DAYS_FOR_TUNING = 84;
const MIN_ERRORS_FOR_SCORING = 56;
const WMA_DAYS = 28;
const MIN_WEIGHT = 0.25;
const MAX_WEIGHT = 0.75;
const MAX_INTERPOLATED_GAP_DAYS = 14;
const FALLBACK_LEAD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DemandPoint = { date: string; demand: number };

export type DemandForecast = {
  itemId: number;
  forecastDate: string;
  historyDays: number;
  alpha: number | null;
  beta: number | null;
  phi: number;
  holtLevel: number | null;
  holtTrend: number | null;
  wmaQty: number | null;
  holtWeight: number | null;
  usagePerDay: number;
  scoredDays: number;
  holtMae: number | null;
  wmaMae: number | null;
  naiveMae: number | null;
  sigma: number;
  sigmaSource: "forecast-errors" | "demand";
  z: number;
  leadDays: number;
  stockLeft: number;
  stockAsOf: string;
  safetyStock: number;
  reorderPoint: number;
  coverDays: number;
  buyQty: number;
};

export type UsageCurve = Pick<DemandForecast, "phi" | "holtLevel" | "holtTrend" | "wmaQty" | "holtWeight" | "usagePerDay">;
export type UsageOnDay = (day: number) => number;

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

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

// Demand series: issued + unmet demand per day, oldest first. Gaps of up to
// 14 days are filled by linear interpolation; a longer gap restarts the
// series, so only the days after the last long gap are returned.
export function buildDailyDemandSeries(rows: DailyStockRow[]): DemandPoint[] {
  const sorted = [...rows].sort((a, b) => a.inventory_date.localeCompare(b.inventory_date));
  let series: DemandPoint[] = [];
  for (const row of sorted) {
    const point = { date: row.inventory_date.slice(0, 10), demand: row.issued_qty + (row.unmet_demand_qty ?? 0) };
    const prev = series[series.length - 1];
    if (prev) {
      const missing = dayNumber(point.date) - dayNumber(prev.date) - 1;
      if (missing > MAX_INTERPOLATED_GAP_DAYS) {
        series = [];
      } else {
        for (let k = 1; k <= missing; k++) {
          series.push({
            date: addDays(prev.date, k),
            demand: prev.demand + ((point.demand - prev.demand) * k) / (missing + 1),
          });
        }
      }
    }
    series.push(point);
  }
  return series;
}

type HoltState = { forecasts: (number | undefined)[]; level: number; trend: number };

// Method A, damped. result.forecasts[i] is the one-day-ahead forecast made
// after day i, so the last entry is the forecast for tomorrow.
function runHolt(y: number[], alpha: number, beta: number, phi: number): HoltState {
  const forecasts: (number | undefined)[] = [undefined];
  if (y.length < 2) return { forecasts, level: y[0] ?? 0, trend: 0 };
  let level = y[1];
  let trend = y[1] - y[0];
  forecasts.push(Math.max(level + phi * trend, 0));
  for (let i = 2; i < y.length; i++) {
    const prevLevel = level;
    level = alpha * y[i] + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
    forecasts.push(Math.max(level + phi * trend, 0));
  }
  return { forecasts, level, trend };
}

// Method B: the newest of the last 28 days counts 28 times, the oldest once.
export function wmaDaily(y: number[]): number {
  const last = y.slice(-WMA_DAYS);
  let sum = 0;
  let weights = 0;
  last.forEach((v, i) => {
    sum += v * (i + 1);
    weights += i + 1;
  });
  return weights ? sum / weights : 0;
}

// Picks alpha (0.1 to 0.9) and beta (0.01 to 0.1) by lowest mean absolute
// error on rolling one-day-ahead forecasts. Defaults below 84 days.
export function tuneHolt(y: number[], phi = TREND_DAMPING): { alpha: number; beta: number } {
  let best = { alpha: DEFAULT_ALPHA, beta: DEFAULT_BETA };
  if (y.length < MIN_DAYS_FOR_TUNING) return best;
  let bestMae = Infinity;
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 10; b++) {
      const alpha = a / 10;
      const beta = b / 100;
      const { forecasts } = runHolt(y, alpha, beta, phi);
      const errors: number[] = [];
      for (let t = 2; t < y.length; t++) errors.push(Math.abs((forecasts[t - 1] as number) - y[t]));
      const err = mean(errors);
      if (err < bestMae) {
        bestMae = err;
        best = { alpha, beta };
      }
    }
  }
  return best;
}

type Backtest = { actual: number[]; holt: number[]; wma: number[]; naive: number[] };

function backtest(y: number[], holtForecasts: (number | undefined)[]): Backtest {
  const result: Backtest = { actual: [], holt: [], wma: [], naive: [] };
  for (let t = MIN_DAYS_FOR_METHODS; t < y.length; t++) {
    result.actual.push(y[t]);
    result.holt.push(holtForecasts[t - 1] as number);
    result.wma.push(wmaDaily(y.slice(0, t)));
    result.naive.push(y[t - 1]);
  }
  return result;
}

function mae(forecasts: number[], actual: number[]): number {
  return mean(forecasts.map((f, i) => Math.abs(f - actual[i])));
}

function holtWeightFromErrors(holtMae: number, wmaMae: number): number {
  if (holtMae === 0 && wmaMae === 0) return 0.5;
  const raw = wmaMae / (holtMae + wmaMae);
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, raw));
}

// Mean days from order to receipt over the item's delivered orders.
export function measureLeadDays(
  purchaseOrders: SupplyOrderRow[],
  supplier: Pick<Supplier, "lead_time_days"> | undefined,
): number {
  const leadDays = purchaseOrders
    .filter((po) => po.status === "Delivered" && po.actual_receipt_date)
    .map((po) => dayNumber(po.actual_receipt_date as string) - dayNumber(po.order_date));
  const lead = leadDays.length ? mean(leadDays) : (supplier?.lead_time_days ?? FALLBACK_LEAD_DAYS);
  return Math.max(0, lead);
}

// Forecast usage on day h after the last actual (h = 1 is tomorrow). The
// damped trend keeps changing usage over the horizon, which bends the
// projected stock line; damping stops it running away over long horizons.
export function usageOnDay(forecast: UsageCurve, h: number): number {
  if (forecast.holtLevel === null || forecast.holtTrend === null || forecast.wmaQty === null) {
    return forecast.usagePerDay;
  }
  const phi = forecast.phi;
  const trendSteps = phi === 1 ? h : (phi * (1 - phi ** h)) / (1 - phi);
  const holtPart = Math.max(forecast.holtLevel + forecast.holtTrend * trendSteps, 0);
  const weight = forecast.holtWeight ?? 0.5;
  return Math.max(weight * holtPart + (1 - weight) * forecast.wmaQty, 0);
}

export function sumUsage(usage: UsageOnDay, days: number): number {
  const wholeDays = Math.floor(days);
  let total = 0;
  for (let h = 1; h <= wholeDays; h++) total += usage(h);
  return total + (days - wholeDays) * usage(wholeDays + 1);
}

export function usageOverDays(forecast: UsageCurve, days: number): number {
  return sumUsage((h) => usageOnDay(forecast, h), days);
}

// One item's daily demand forecast from the day after its last count.
// Buy amount = usage over the cover days + safety stock (z * sigma * sqrt(lead days)).
// Reorder point = usage over the lead time + safety stock: the stock level that
// just lasts until a new order arrives.
// Returns null when the item has no usable history.
export function forecastItem(input: {
  item: Pick<Item, "item_id" | "is_critical"> & { cover_days?: number | null };
  dailyRows: DailyStockRow[];
  purchaseOrders: SupplyOrderRow[];
  supplier?: Pick<Supplier, "lead_time_days">;
}): DemandForecast | null {
  const series = buildDailyDemandSeries(input.dailyRows);
  const latestRow = [...input.dailyRows].sort((a, b) => a.inventory_date.localeCompare(b.inventory_date)).pop();
  if (series.length === 0 || !latestRow) return null;
  const y = series.map((p) => p.demand);
  const z = input.item.is_critical === 1 ? Z_CRITICAL : Z_STANDARD;
  const phi = TREND_DAMPING;

  let alpha: number | null = null;
  let beta: number | null = null;
  let holtLevel: number | null = null;
  let holtTrend: number | null = null;
  let wmaQty: number | null = null;
  let holtWeight: number | null = null;
  let holtMae: number | null = null;
  let wmaMae: number | null = null;
  let naiveMae: number | null = null;
  let scoredDays = 0;
  let usagePerDay = mean(y);
  let sigma = sampleStdDev(y);
  let sigmaSource: DemandForecast["sigmaSource"] = "demand";

  if (y.length >= MIN_DAYS_FOR_METHODS) {
    ({ alpha, beta } = tuneHolt(y, phi));
    const holt = runHolt(y, alpha, beta, phi);
    holtLevel = holt.level;
    holtTrend = holt.trend;
    wmaQty = wmaDaily(y);
    holtWeight = 0.5;

    const scored = backtest(y, holt.forecasts);
    scoredDays = scored.actual.length;
    if (scoredDays > 0) {
      holtMae = mae(scored.holt, scored.actual);
      wmaMae = mae(scored.wma, scored.actual);
      naiveMae = mae(scored.naive, scored.actual);
    }
    if (scoredDays >= MIN_ERRORS_FOR_SCORING && holtMae !== null && wmaMae !== null) {
      const weight = holtWeightFromErrors(holtMae, wmaMae);
      holtWeight = weight;
      const combinedErrors = scored.actual.map(
        (actual, i) => weight * scored.holt[i] + (1 - weight) * scored.wma[i] - actual,
      );
      sigma = sampleStdDev(combinedErrors);
      sigmaSource = "forecast-errors";
    }
    usagePerDay = usageOnDay({ phi, holtLevel, holtTrend, wmaQty, holtWeight, usagePerDay }, 1);
  }

  const curve = { phi, holtLevel, holtTrend, wmaQty, holtWeight, usagePerDay };
  const leadDays = measureLeadDays(input.purchaseOrders, input.supplier);
  const safetyStock = z * sigma * Math.sqrt(leadDays);
  const coverDays = input.item.cover_days ?? DEFAULT_COVER_DAYS;
  const stockAsOf = latestRow.inventory_date.slice(0, 10);

  return {
    itemId: input.item.item_id,
    forecastDate: addDays(stockAsOf, 1),
    historyDays: y.length,
    alpha,
    beta,
    ...curve,
    scoredDays,
    holtMae,
    wmaMae,
    naiveMae,
    sigma,
    sigmaSource,
    z,
    leadDays,
    stockLeft: latestRow.closing_stock,
    stockAsOf,
    safetyStock,
    reorderPoint: usageOverDays(curve, leadDays) + safetyStock,
    coverDays,
    buyQty: usageOverDays(curve, coverDays) + safetyStock,
  };
}
