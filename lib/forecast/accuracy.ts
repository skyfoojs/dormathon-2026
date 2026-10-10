// Prediction accuracy over time, one point per closed week.
//
// For most past weeks only the arithmetic forecast exists, so the point
// scores that alone (a rolling backtest: each week is forecast from only the
// days before it). Where a saved forecast run exists for the week, the prediction
// is what was actually saved, and if the AI adjusted it, the prediction is
// the average of the AI figure and the arithmetic figure.

import {
  addDays,
  buildDailyDemandSeries,
  dayNumber,
  forecastItem,
  usageOverDays,
  type DailyStockRow,
} from "@/lib/forecast/demand";

// A week is only forecast once this many days of history come before it,
// the same minimum the daily forecast needs to use both of its methods.
const MIN_HISTORY_DAYS = 28;

// A saved forecast run for one item: demand_forecasts joined to the latest
// ai_forecasts row that points at it, if any.
export type SavedForecast = {
  forecastDate: string;
  // The arithmetic forecast, as a daily rate.
  usagePerDay: number;
  // The adjustment the AI made to that rate. Null when no AI run used it.
  usageMultiplier: number | null;
};

export type AccuracySource = "arithmetic" | "ai+arithmetic";

export type AccuracyPoint = {
  weekStart: string;
  actualQty: number;
  arithmeticQty: number;
  aiQty: number | null;
  // What is scored: the arithmetic figure, or its average with the AI figure.
  predictedQty: number;
  // 100 minus the percentage error, floored at 0.
  accuracy: number;
  source: AccuracySource;
};

export type ItemAccuracy = {
  itemId: number;
  itemName: string;
  // Mean of the weekly accuracy values.
  accuracy: number;
  avgMissUnits: number;
  weeksWithin10Pct: number;
  weeksScored: number;
  // Weeks scored with the AI and arithmetic average.
  aiWeeksScored: number;
  // Saved AI runs whose week has not finished, so cannot be scored yet.
  aiWeeksPending: number;
  points: AccuracyPoint[];
};

function weekStartOf(isoDate: string): string {
  // Day 0 (1 Jan 1970) was a Thursday, so (day + 3) % 7 is days since Monday.
  return addDays(isoDate, -((dayNumber(isoDate) + 3) % 7));
}

// A week with no demand cannot have a percentage error; like the rest of the
// dashboard, it is scored as a hit.
function accuracyOf(predictedQty: number, actualQty: number): number {
  if (actualQty === 0) return 100;
  return Math.max(0, 100 - (Math.abs(predictedQty - actualQty) / actualQty) * 100);
}

type WeekActual = { weekStart: string; actualQty: number };

// Daily demand added up into Monday-start weeks. Only complete weeks (7
// days) are kept, so a part-recorded week never reads as a drop in demand.
function toWeeklyActuals(dailyRows: DailyStockRow[]): WeekActual[] {
  const weeks = new Map<string, { actualQty: number; days: number }>();
  for (const point of buildDailyDemandSeries(dailyRows)) {
    const weekStart = weekStartOf(point.date);
    const week = weeks.get(weekStart) ?? { actualQty: 0, days: 0 };
    week.actualQty += point.demand;
    week.days += 1;
    weeks.set(weekStart, week);
  }
  return [...weeks.entries()]
    .filter(([, week]) => week.days === 7)
    .map(([weekStart, week]) => ({ weekStart, actualQty: week.actualQty }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// What the daily forecast would have predicted for the week, given only the
// rows recorded before it. Null when there is too little history.
function forecastWeek(itemId: number, dailyRows: DailyStockRow[], weekStart: string): number | null {
  const before = dailyRows.filter((r) => r.inventory_date.slice(0, 10) < weekStart);
  if (before.length < MIN_HISTORY_DAYS) return null;
  const forecast = forecastItem({ item: { item_id: itemId, is_critical: 0 }, dailyRows: before, purchaseOrders: [] });
  return forecast ? usageOverDays(forecast, 7) : null;
}

export function buildItemAccuracy(input: {
  itemId: number;
  itemName: string;
  dailyRows: DailyStockRow[];
  savedForecasts: SavedForecast[];
}): ItemAccuracy {
  const weeks = toWeeklyActuals(input.dailyRows);
  const actualByWeek = new Map(weeks.map((w) => [w.weekStart, w.actualQty]));

  const pointByWeek = new Map<string, AccuracyPoint>();
  for (const week of weeks) {
    const forecastQty = forecastWeek(input.itemId, input.dailyRows, week.weekStart);
    if (forecastQty === null) continue;
    pointByWeek.set(week.weekStart, {
      weekStart: week.weekStart,
      actualQty: week.actualQty,
      arithmeticQty: forecastQty,
      aiQty: null,
      predictedQty: forecastQty,
      accuracy: accuracyOf(forecastQty, week.actualQty),
      source: "arithmetic",
    });
  }

  // A saved run replaces the backtest for its week: it is what was really
  // predicted at the time. Later runs for the same week win.
  let aiWeeksPending = 0;
  const saved = [...input.savedForecasts].sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));
  for (const run of saved) {
    const weekStart = weekStartOf(run.forecastDate);
    const actualQty = actualByWeek.get(weekStart);
    if (actualQty === undefined) {
      if (run.usageMultiplier !== null) aiWeeksPending += 1;
      continue;
    }
    const arithmeticQty = run.usagePerDay * 7;
    const aiQty = run.usageMultiplier === null ? null : arithmeticQty * run.usageMultiplier;
    const predictedQty = aiQty === null ? arithmeticQty : (aiQty + arithmeticQty) / 2;
    pointByWeek.set(weekStart, {
      weekStart,
      actualQty,
      arithmeticQty,
      aiQty,
      predictedQty,
      accuracy: accuracyOf(predictedQty, actualQty),
      source: aiQty === null ? "arithmetic" : "ai+arithmetic",
    });
  }

  const points = [...pointByWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const count = points.length;
  return {
    itemId: input.itemId,
    itemName: input.itemName,
    accuracy: count ? points.reduce((sum, p) => sum + p.accuracy, 0) / count : 0,
    avgMissUnits: count ? points.reduce((sum, p) => sum + Math.abs(p.predictedQty - p.actualQty), 0) / count : 0,
    weeksWithin10Pct: points.filter((p) => p.accuracy >= 90).length,
    weeksScored: count,
    aiWeeksScored: points.filter((p) => p.source === "ai+arithmetic").length,
    aiWeeksPending,
    points,
  };
}

export type OverallAccuracyPoint = {
  weekStart: string;
  // Mean of the per-item accuracy for the week. Averaging the scores, rather
  // than scoring the totals, stops one item's over-forecast hiding another's
  // under-forecast.
  accuracy: number;
  // Total units across the items scored that week.
  predictedQty: number;
  actualQty: number;
  itemsScored: number;
  // Items whose prediction that week is the AI and arithmetic average.
  aiItems: number;
};

export type OverallAccuracy = {
  accuracy: number;
  weeksWithin10Pct: number;
  weeksScored: number;
  itemsScored: number;
  aiWeeksScored: number;
  aiWeeksPending: number;
  points: OverallAccuracyPoint[];
};

// Rolls every item's weekly points into one series for all items together.
export function buildOverallAccuracy(items: ItemAccuracy[]): OverallAccuracy {
  const byWeek = new Map<string, AccuracyPoint[]>();
  for (const item of items) {
    for (const point of item.points) {
      const list = byWeek.get(point.weekStart);
      if (list) list.push(point);
      else byWeek.set(point.weekStart, [point]);
    }
  }

  const points = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weekPoints]) => ({
      weekStart,
      accuracy: weekPoints.reduce((sum, p) => sum + p.accuracy, 0) / weekPoints.length,
      predictedQty: weekPoints.reduce((sum, p) => sum + p.predictedQty, 0),
      actualQty: weekPoints.reduce((sum, p) => sum + p.actualQty, 0),
      itemsScored: weekPoints.length,
      aiItems: weekPoints.filter((p) => p.source === "ai+arithmetic").length,
    }));

  return {
    accuracy: points.length ? points.reduce((sum, p) => sum + p.accuracy, 0) / points.length : 0,
    weeksWithin10Pct: points.filter((p) => p.accuracy >= 90).length,
    weeksScored: points.length,
    itemsScored: items.filter((i) => i.weeksScored > 0).length,
    aiWeeksScored: points.filter((p) => p.aiItems > 0).length,
    // Every item is forecast in the same run, so the longest wait is the count.
    aiWeeksPending: Math.max(0, ...items.map((i) => i.aiWeeksPending)),
    points,
  };
}
