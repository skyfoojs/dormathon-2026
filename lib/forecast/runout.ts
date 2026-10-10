// Stock run-down: projects an item's stock forward from its last recorded
// level, falling by each day's forecast usage and rising when an order in
// transit arrives, and marks the day it reaches the restock trigger.

import {
  addDays,
  dayNumber,
  sumUsage,
  type DailyStockRow,
  type SupplyOrderRow,
  type UsageOnDay,
} from "@/lib/forecast/demand";

const SUPPLY_LOOKBACK_DAYS = 84;
// Fewer days are drawn than are used for the supply level, so the
// projection is not squeezed into the edge of the chart.
const HISTORY_DAYS_SHOWN = 42;
const MAX_PROJECTION_DAYS = 84;

export type StockPoint = { date: string; stock: number };

export type RestockTrigger = {
  date: string;
  daysFromLastActual: number;
  // Forecast demand used up between the last actual and the trigger date.
  demandUntilTrigger: number;
  // True when the last recorded stock is already at or below the threshold.
  alreadyReached: boolean;
};

export type StockProjection = {
  history: StockPoint[];
  // Daily points. The first one repeats the last actual so the lines join.
  projection: StockPoint[];
  arrivals: { date: string; qty: number }[];
  dailyDemand: number;
  supplyLevel: number;
  threshold: number;
  trigger: RestockTrigger | null;
  stockoutDate: string | null;
};

export function stockHistory(dailyRows: DailyStockRow[], days = HISTORY_DAYS_SHOWN): StockPoint[] {
  return [...dailyRows]
    .sort((a, b) => a.inventory_date.localeCompare(b.inventory_date))
    .slice(-days)
    .map((r) => ({ date: r.inventory_date.slice(0, 10), stock: r.closing_stock }));
}

export function projectStock(input: {
  dailyRows: DailyStockRow[];
  purchaseOrders: SupplyOrderRow[];
  usage: UsageOnDay;
  threshold: number;
}): StockProjection | null {
  const rows = [...input.dailyRows].sort((a, b) => a.inventory_date.localeCompare(b.inventory_date));
  if (rows.length === 0) return null;

  const history = stockHistory(rows);
  const lastActual = history[history.length - 1];
  const supplyLevel = Math.max(...rows.slice(-SUPPLY_LOOKBACK_DAYS).map((r) => r.closing_stock));
  const threshold = input.threshold;
  const dailyDemand = input.usage(1);

  // An order already past its expected date has not arrived yet, so the
  // earliest it can land is the first projected day.
  const firstProjectedDay = addDays(lastActual.date, 1);
  const arrivalQtyByDate = new Map<string, number>();
  for (const po of input.purchaseOrders) {
    if (po.status !== "In transit") continue;
    const date = po.expected_receipt_date > firstProjectedDay ? po.expected_receipt_date : firstProjectedDay;
    arrivalQtyByDate.set(date, (arrivalQtyByDate.get(date) ?? 0) + po.qty_ordered);
  }
  const arrivals = [...arrivalQtyByDate]
    .map(([date, qty]) => ({ date, qty }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastArrivalDate = arrivals.length ? arrivals[arrivals.length - 1].date : lastActual.date;

  const projection: StockPoint[] = [lastActual];
  let stock = lastActual.stock;
  let triggerDate: string | null = stock <= threshold ? lastActual.date : null;
  let stockoutDate: string | null = stock === 0 ? lastActual.date : null;
  for (let day = 1; day <= MAX_PROJECTION_DAYS; day++) {
    const date = addDays(lastActual.date, day);
    stock = Math.max(0, stock + (arrivalQtyByDate.get(date) ?? 0) - input.usage(day));
    projection.push({ date, stock });
    if (triggerDate === null && stock <= threshold) triggerDate = date;
    if (stockoutDate === null && stock === 0) stockoutDate = date;
    // Nothing more can change once stock is gone and no order is still due.
    if (stock === 0 && date >= lastArrivalDate) break;
  }

  const lastProjected = projection[projection.length - 1].date;
  let trigger: RestockTrigger | null = null;
  if (triggerDate !== null) {
    const days = dayNumber(triggerDate) - dayNumber(lastActual.date);
    trigger = {
      date: triggerDate,
      daysFromLastActual: days,
      demandUntilTrigger: sumUsage(input.usage, days),
      alreadyReached: days === 0,
    };
  }

  return {
    history,
    projection,
    arrivals: arrivals.filter((a) => a.date <= lastProjected),
    dailyDemand,
    supplyLevel,
    threshold,
    trigger,
    stockoutDate,
  };
}
