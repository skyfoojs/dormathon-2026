// Demand forecasting, daily: Holt's linear trend (damped) + 56-day weighted
// moving average, combined, with the safety stock that goes on top. Adapts
// docs/Internal-Calculation.md from weeks to days.
// Pure functions only, so the same code runs in a route handler or a script.
//
// Both methods run on usage with the day-of-week pattern divided out, so a
// busy weekday at the end of the history does not inflate the forecast. The
// forecast is therefore usage on an average day: right over a week or more,
// and smoother than any single day.
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
const WMA_DAYS = 56;
// Holt is tuned, and the two methods weighted, on how well they predict the
// total of the next 7 days: the forecast is used for a week or more of
// usage, not for tomorrow alone.
const SCORING_HORIZON_DAYS = 7;
const TUNING_ALPHAS = [0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const TUNING_BETAS = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1];
const WEEKDAY_FACTOR_DAYS = 182;
// Each weekday's factor is pulled towards 1 as if by this many extra average
// days, so a weekday seen only a few times cannot swing the forecast.
const WEEKDAY_FACTOR_SHRINK = 4;
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
  // The three errors below are on 7-day totals, over scoredDays forecasts.
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

// Day-of-week factors, Monday first: each weekday's usage relative to an
// average day over the last half year. startDay is the day number of y[0].
function weekdayFactors(y: number[], startDay: number): number[] {
  const from = Math.max(0, y.length - WEEKDAY_FACTOR_DAYS);
  const sums = new Array<number>(7).fill(0);
  const counts = new Array<number>(7).fill(0);
  for (let i = from; i < y.length; i++) {
    // Day 0 (1 Jan 1970) was a Thursday, so (day + 3) % 7 is days since Monday.
    const weekday = (startDay + i + 3) % 7;
    sums[weekday] += y[i];
    counts[weekday] += 1;
  }
  const overall = sums.reduce((a, b) => a + b, 0) / (y.length - from);
  if (overall === 0) return new Array<number>(7).fill(1);
  return sums.map((sum, d) => (sum / overall + WEEKDAY_FACTOR_SHRINK) / (counts[d] + WEEKDAY_FACTOR_SHRINK));
}

// How much of the trend forecast day h carries: phi + phi^2 + ... + phi^h.
function trendSteps(phi: number, h: number): number {
  return phi === 1 ? h : (phi * (1 - phi ** h)) / (1 - phi);
}

// levels[i] and trends[i] are Holt's state after day i, valid from i = 1.
type HoltState = { levels: number[]; trends: number[] };

// Method A, damped.
function runHolt(y: number[], alpha: number, beta: number, phi: number): HoltState {
  const levels = [y[0] ?? 0];
  const trends = [0];
  if (y.length < 2) return { levels, trends };
  levels.push(y[1]);
  trends.push(y[1] - y[0]);
  for (let i = 2; i < y.length; i++) {
    const level = alpha * y[i] + (1 - alpha) * (levels[i - 1] + phi * trends[i - 1]);
    levels.push(level);
    trends.push(beta * (level - levels[i - 1]) + (1 - beta) * phi * trends[i - 1]);
  }
  return { levels, trends };
}

// Holt's forecast, made after day i, for the total of the next `days` days.
function holtTotal(holt: HoltState, i: number, days: number, steps: number[]): number {
  let total = 0;
  for (let h = 0; h < days; h++) total += Math.max(holt.levels[i] + holt.trends[i] * steps[h], 0);
  return total;
}

// Method B over the days before `end`: the newest of the last 56 days counts
// 56 times, the oldest once.
function wmaBefore(y: number[], end: number): number {
  const start = Math.max(0, end - WMA_DAYS);
  let sum = 0;
  let weights = 0;
  for (let i = start; i < end; i++) {
    sum += y[i] * (i - start + 1);
    weights += i - start + 1;
  }
  return weights ? sum / weights : 0;
}

export function wmaDaily(y: number[]): number {
  return wmaBefore(y, y.length);
}

// totals[i] is the actual total of the SCORING_HORIZON_DAYS days after day i.
function horizonTotals(y: number[]): number[] {
  const prefix = [0];
  for (const value of y) prefix.push(prefix[prefix.length - 1] + value);
  const totals: number[] = [];
  for (let i = 0; i + SCORING_HORIZON_DAYS < y.length; i++) {
    totals.push(prefix[i + 1 + SCORING_HORIZON_DAYS] - prefix[i + 1]);
  }
  return totals;
}

// Picks alpha (0.02 to 0.9) and beta (0.01 to 0.1) by lowest mean absolute
// error on rolling forecasts of the next 7 days' total. Defaults below 84 days.
export function tuneHolt(y: number[], phi = TREND_DAMPING): { alpha: number; beta: number } {
  let best = { alpha: DEFAULT_ALPHA, beta: DEFAULT_BETA };
  if (y.length < MIN_DAYS_FOR_TUNING) return best;
  const totals = horizonTotals(y);
  const steps = Array.from({ length: SCORING_HORIZON_DAYS }, (_, h) => trendSteps(phi, h + 1));
  let bestError = Infinity;
  for (const alpha of TUNING_ALPHAS) {
    for (const beta of TUNING_BETAS) {
      const holt = runHolt(y, alpha, beta, phi);
      let error = 0;
      for (let i = 1; i < totals.length; i++) error += Math.abs(holtTotal(holt, i, SCORING_HORIZON_DAYS, steps) - totals[i]);
      if (error < bestError) {
        bestError = error;
        best = { alpha, beta };
      }
    }
  }
  return best;
}

// Each method's forecast of the next 7 days' total, made after every day
// from the 28th on, beside what was actually used.
type Backtest = { actual: number[]; holt: number[]; wma: number[]; naive: number[] };

function backtest(y: number[], holt: HoltState, phi: number): Backtest {
  const result: Backtest = { actual: [], holt: [], wma: [], naive: [] };
  const totals = horizonTotals(y);
  const steps = Array.from({ length: SCORING_HORIZON_DAYS }, (_, h) => trendSteps(phi, h + 1));
  for (let i = MIN_DAYS_FOR_METHODS - 1; i < totals.length; i++) {
    result.actual.push(totals[i]);
    result.holt.push(holtTotal(holt, i, SCORING_HORIZON_DAYS, steps));
    result.wma.push(wmaBefore(y, i + 1) * SCORING_HORIZON_DAYS);
    result.naive.push(totals[i - SCORING_HORIZON_DAYS]);
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

// How far the forecast for an average day was from each day's real usage,
// one day ahead, from the 28th day on. Real usage keeps its day-of-week
// pattern, so the safety stock built on this still covers the busy weekdays.
function dailyForecastErrors(usage: number[], smoothed: number[], holt: HoltState, weight: number, phi: number): number[] {
  const errors: number[] = [];
  for (let t = MIN_DAYS_FOR_METHODS; t < usage.length; t++) {
    const holtDay = Math.max(holt.levels[t - 1] + phi * holt.trends[t - 1], 0);
    errors.push(weight * holtDay + (1 - weight) * wmaBefore(smoothed, t) - usage[t]);
  }
  return errors;
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
  const holtPart = holtOnDay(forecast, h);
  if (holtPart === null || forecast.wmaQty === null) return forecast.usagePerDay;
  const weight = forecast.holtWeight ?? 0.5;
  return Math.max(weight * holtPart + (1 - weight) * forecast.wmaQty, 0);
}

export function holtOnDay(forecast: UsageCurve, h: number): number | null {
  if (forecast.holtLevel === null || forecast.holtTrend === null) return null;
  return Math.max(forecast.holtLevel + forecast.holtTrend * trendSteps(forecast.phi, h), 0);
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
    const startDay = dayNumber(series[0].date);
    const factors = weekdayFactors(y, startDay);
    const smoothed = y.map((value, i) => value / factors[(startDay + i + 3) % 7]);

    ({ alpha, beta } = tuneHolt(smoothed, phi));
    const holt = runHolt(smoothed, alpha, beta, phi);
    holtLevel = holt.levels[smoothed.length - 1];
    holtTrend = holt.trends[smoothed.length - 1];
    wmaQty = wmaDaily(smoothed);
    holtWeight = 0.5;

    const scored = backtest(smoothed, holt, phi);
    scoredDays = scored.actual.length;
    if (scoredDays > 0) {
      holtMae = mae(scored.holt, scored.actual);
      wmaMae = mae(scored.wma, scored.actual);
      naiveMae = mae(scored.naive, scored.actual);
    }
    if (scoredDays >= MIN_ERRORS_FOR_SCORING && holtMae !== null && wmaMae !== null) {
      holtWeight = holtWeightFromErrors(holtMae, wmaMae);
      sigma = sampleStdDev(dailyForecastErrors(y, smoothed, holt, holtWeight, phi));
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
