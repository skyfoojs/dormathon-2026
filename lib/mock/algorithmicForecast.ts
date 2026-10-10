import { addDays, format } from "date-fns";
import type { RunChangeRow, RunSourceRow } from "@/lib/mock/predictionDetail";

// Synthetic data for the Algorithmic Forecast view: fixed sample series and a
// self-contained Holt + weighted moving average, so the panel renders the same
// on the server and the client. The live equivalent is lib/forecast/demand.ts.

export const HISTORY_WEEKS = 14;
export const FORECAST_WEEKS = 4;
const WEEKS_PER_MONTH = 4.3;
const TODAY = new Date(2026, 9, 10);
const FIRST_WEEK = new Date(2026, 3, 13);

export const WMA_WINDOWS = [
  { days: 30, weeks: 4 },
  { days: 60, weeks: 9 },
  { days: 90, weeks: 13 },
] as const;
export type WmaWindowDays = (typeof WMA_WINDOWS)[number]["days"];

export function wmaWeeks(days: WmaWindowDays): number {
  return WMA_WINDOWS.find((w) => w.days === days)!.weeks;
}

type AlgoItem = {
  name: string;
  onHand: number;
  weeklyBase: number;
  openOrder: string;
  orderLate: boolean;
  // Share the invented series drifts over the 14 weeks.
  drift: number;
  // Fixed weekly issue rows; items without one get an invented series.
  series?: number[];
};

export const ALGO_ITEMS: AlgoItem[] = [
  { name: "Salbutamol 100mcg MDI inhaler", onHand: 94, weeklyBase: 65, openOrder: "PO-1042 · 300 · 2 days late", orderLate: true, drift: 0, series: [56, 63, 55, 69, 75, 70, 53, 63, 70, 37, 78, 70, 65, 77] },
  { name: "Amoxicillin-clavulanate 625mg", onHand: 1150, weeklyBase: 410, openOrder: "None", orderLate: false, drift: 0.02 },
  { name: "Dexamethasone 4mg/mL injection", onHand: 230, weeklyBase: 70, openOrder: "None", orderLate: false, drift: 0 },
  { name: "N95 respirator", onHand: 5200, weeklyBase: 900, openOrder: "None", orderLate: false, drift: 0.08 },
  { name: "Prednisolone 5mg tablet", onHand: 3400, weeklyBase: 800, openOrder: "None", orderLate: false, drift: -0.03 },
  { name: "Oseltamivir 75mg capsule", onHand: 520, weeklyBase: 150, openOrder: "PO-1044 · 400 · due 16 Oct", orderLate: false, drift: 0.2 },
  { name: "Ipratropium 0.5mg nebule", onHand: 7, weeklyBase: 70, openOrder: "PO-1043 · 600 · due today", orderLate: false, drift: 0.05 },
  { name: "Surgical mask, 3-ply", onHand: 12000, weeklyBase: 2500, openOrder: "None", orderLate: false, drift: 0.03 },
];

// Small seeded generator (mulberry32) so the invented series never change.
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function itemSeries(index: number): number[] {
  const item = ALGO_ITEMS[index];
  if (item.series) return item.series;
  const random = seededRandom(1000 + index);
  return Array.from({ length: HISTORY_WEEKS }, (_, k) =>
    Math.round(item.weeklyBase * (1 + (item.drift * (k - 6.5)) / 13) * (1 + 0.08 * (random() * 2 - 1))),
  );
}

type HoltFit = { levels: number[]; level: number; trend: number; sse: number; alpha: number; beta: number };

function runHolt(y: number[], alpha: number, beta: number): HoltFit {
  let level = y[0];
  let trend = y[1] - y[0];
  const levels = [level];
  let sse = 0;
  for (let k = 1; k < y.length; k++) {
    const forecast = level + trend;
    sse += (y[k] - forecast) ** 2;
    const nextLevel = alpha * y[k] + (1 - alpha) * forecast;
    trend = beta * (nextLevel - level) + (1 - beta) * trend;
    level = nextLevel;
    levels.push(level);
  }
  return { levels, level, trend, sse, alpha, beta };
}

// Level and trend weights (0.1 to 0.9) with the lowest one-step squared error.
function bestHolt(y: number[]): HoltFit {
  let best: HoltFit | null = null;
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      const fit = runHolt(y, a / 10, b / 10);
      if (!best || fit.sse < best.sse) best = fit;
    }
  }
  return best as HoltFit;
}

// Weighted moving average at each week: the newest week counts the most.
function wmaSeries(y: number[], window: number): number[] {
  return y.map((_, k) => {
    const n = Math.min(window, k + 1);
    let weighted = 0;
    let weights = 0;
    for (let q = 0; q < n; q++) {
      weighted += (q + 1) * y[k - n + 1 + q];
      weights += q + 1;
    }
    return weighted / weights;
  });
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function weekLabel(weekIndex: number): string {
  return format(addDays(FIRST_WEEK, 7 * weekIndex), "d MMM");
}

export type AlgoChartPoint = { week: string; actual?: number; holt: number; wma: number; average: number };

export type AlgoItemForecast = {
  itemName: string;
  points: AlgoChartPoint[];
  alpha: number;
  beta: number;
  trend: number;
  holtWeekly: number;
  wmaWeekly: number;
  planningWeekly: number;
  // Gap between the two methods as a share of their mean.
  methodGap: number;
  usesSampleRows: boolean;
};

export function forecastAlgoItem(index: number, windowDays: WmaWindowDays): AlgoItemForecast {
  const y = itemSeries(index);
  const fit = bestHolt(y);
  const wma = wmaSeries(y, wmaWeeks(windowDays));
  const lastWma = wma[wma.length - 1];
  const holtAll = [...fit.levels, ...Array.from({ length: FORECAST_WEEKS }, (_, q) => fit.level + (q + 1) * fit.trend)];
  const wmaAll = [...wma, ...Array.from({ length: FORECAST_WEEKS }, () => lastWma)];
  const holtWeekly = mean(holtAll.slice(HISTORY_WEEKS));
  const wmaWeekly = lastWma;

  return {
    itemName: ALGO_ITEMS[index].name,
    points: holtAll.map((holt, k) => ({
      week: weekLabel(k),
      actual: k < HISTORY_WEEKS ? y[k] : undefined,
      holt: Math.round(holt),
      wma: Math.round(wmaAll[k]),
      average: Math.round((holt + wmaAll[k]) / 2),
    })),
    alpha: fit.alpha,
    beta: fit.beta,
    trend: fit.trend,
    holtWeekly,
    wmaWeekly,
    planningWeekly: (holtWeekly + wmaWeekly) / 2,
    methodGap: Math.abs(holtWeekly - wmaWeekly) / Math.max(1, (holtWeekly + wmaWeekly) / 2),
    usesSampleRows: ALGO_ITEMS[index].series !== undefined,
  };
}

export type AlgoTier = "High" | "Medium" | "Low";
const TIERS: AlgoTier[] = ["Low", "Medium", "High"];

export type AlgoTierRow = {
  itemName: string;
  onHand: number;
  weekly: number;
  coverWeeks: number;
  openOrder: string;
  tier: AlgoTier;
  nextMonth: number;
  runsOutLabel: string;
};

// Tier rule: under 1 week of cover is High, under 2 weeks is Medium,
// otherwise Low, raised one level if an open order is late.
export function buildTierRows(windowDays: WmaWindowDays): AlgoTierRow[] {
  return ALGO_ITEMS.map((item, index) => {
    const weekly = Math.max(1, Math.round(forecastAlgoItem(index, windowDays).planningWeekly));
    const coverWeeks = item.onHand / weekly;
    let level = coverWeeks < 1 ? 2 : coverWeeks < 2 ? 1 : 0;
    if (item.orderLate) level = Math.min(2, level + 1);
    return {
      itemName: item.name,
      onHand: item.onHand,
      weekly,
      coverWeeks,
      openOrder: item.openOrder,
      tier: TIERS[level],
      nextMonth: Math.round(weekly * WEEKS_PER_MONTH),
      runsOutLabel: format(addDays(TODAY, Math.round(coverWeeks * 7)), "d MMM"),
    };
  }).sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier));
}

export const ALGO_SOURCES: RunSourceRow[] = [
  { name: "Weekly stock rows", note: "14 weekly rows: closing stock, receipts and issues.", provenance: "database", status: "Read" },
  { name: "Purchase orders", note: "3 open orders read for incoming stock.", provenance: "database", status: "Read" },
];

export const ALGO_CHANGES: RunChangeRow[] = [{ type: "No change", text: "Tiers match the previous run." }];
