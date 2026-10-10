import { classifyHazeApi } from "@/lib/db/seed";
import type { HazeApiCategory, HazeApiWeekly, Item, PurchaseOrder, WeeklyInventory } from "@/lib/db/types";
import { forecastClosingStock, type ForecastPoint } from "@/lib/data/forecast";
import { isPurchaseOrderDelayed } from "@/lib/data/purchaseOrders";
import { formatDueLabel } from "@/lib/data/dates";
import { PREDICTION_RUNS, type PredictionRunSummary } from "@/lib/mock/predictionRuns";

export const FORECAST_WEEKS = 4;

export type HazeKpi = {
  apiAvg: number;
  category: HazeApiCategory;
  weekStart: string;
};

export function getHazeKpi(hazeRows: HazeApiWeekly[]): HazeKpi | null {
  const rows = [...hazeRows].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const latest = rows[rows.length - 1];
  if (!latest) return null;
  return { apiAvg: latest.api_avg, category: latest.api_category, weekStart: latest.week_start };
}

export type LowestCoverKpi = {
  itemName: string;
  weeksOfCover: number;
};

export function getLowestCoverKpi(weeklyInventory: WeeklyInventory[], items: Item[]): LowestCoverKpi | null {
  const latestWeek = weeklyInventory.map((r) => r.week_start).sort().at(-1);
  if (!latestWeek) return null;

  const criticalItemIds = new Set(items.filter((i) => i.is_critical === 1).map((i) => i.item_id));
  const rows = weeklyInventory.filter((r) => r.week_start === latestWeek && criticalItemIds.has(r.item_id));
  if (rows.length === 0) return null;

  const lowest = rows.reduce((min, r) => (r.weeks_of_cover < min.weeks_of_cover ? r : min));
  const item = items.find((i) => i.item_id === lowest.item_id);
  return { itemName: item?.item_name ?? "Unknown item", weeksOfCover: lowest.weeks_of_cover };
}

export type OpenPurchaseOrdersKpi = {
  openCount: number;
  delayedCount: number;
  nextDueLabel: string | null;
};

export function getOpenPurchaseOrdersKpi(purchaseOrders: PurchaseOrder[]): OpenPurchaseOrdersKpi {
  const open = purchaseOrders.filter((po) => po.status === "In transit");
  const delayedCount = open.filter(isPurchaseOrderDelayed).length;
  const notDelayed = open
    .filter((po) => !isPurchaseOrderDelayed(po))
    .sort((a, b) => a.expected_receipt_date.localeCompare(b.expected_receipt_date));
  const next = notDelayed[0];
  return {
    openCount: open.length,
    delayedCount,
    nextDueLabel: next ? formatDueLabel(next.expected_receipt_date) : null,
  };
}

export type ReceiptMarker = {
  weekStart: string;
  qty: number;
  expected: boolean;
};

export type StockChartData = {
  itemName: string;
  reorderLevel: number;
  history: { weekStart: string; closingStock: number }[];
  forecast: ForecastPoint[];
  receipts: ReceiptMarker[];
  hazeBars: { weekStart: string; apiAvg: number; category: HazeApiCategory }[];
};

export function getStockChartData(
  itemWeeklyRows: WeeklyInventory[],
  purchaseOrdersForItem: PurchaseOrder[],
  hazeRows: HazeApiWeekly[],
  item: Item | undefined,
): StockChartData | null {
  const rows = [...itemWeeklyRows].sort((a, b) => a.week_start.localeCompare(b.week_start));
  if (rows.length === 0) return null;

  const history = rows.map((r) => ({ weekStart: r.week_start, closingStock: r.closing_stock }));
  const forecast = forecastClosingStock(history, FORECAST_WEEKS);

  const historyReceipts: ReceiptMarker[] = rows
    .filter((r) => r.received_qty > 0)
    .map((r) => ({ weekStart: r.week_start, qty: r.received_qty, expected: false }));

  const expectedReceipts: ReceiptMarker[] = purchaseOrdersForItem
    .filter((po) => po.status === "In transit" && forecast.some((f) => f.weekStart === po.expected_receipt_date))
    .map((po) => ({ weekStart: po.expected_receipt_date, qty: po.qty_ordered, expected: true }));

  const hazeBars = [...hazeRows]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((h) => ({ weekStart: h.week_start, apiAvg: h.api_avg, category: h.api_category }));

  return {
    itemName: item?.item_name ?? "Unknown item",
    reorderLevel: rows[rows.length - 1].reorder_level,
    history,
    forecast,
    receipts: [...historyReceipts, ...expectedReceipts],
    hazeBars,
  };
}

export type ExternalSignalRow = {
  name: string;
  value: string;
  trend: string;
  provenance: "database" | "public-evidence";
};

export function getExternalSignals(
  hazeKpi: HazeKpi | null,
  liveHaze?: { apiAvg: number; category: HazeApiCategory; locationLabel: string } | null,
): ExternalSignalRow[] {
  return [
    {
      name: "Haze (API)",
      value: hazeKpi ? `${hazeKpi.apiAvg} (${classifyHazeApi(hazeKpi.apiAvg)})` : "—",
      trend: hazeKpi ? "From this facility's weekly haze readings." : "No readings for this facility.",
      provenance: "database",
    },
    {
      name: "Haze (live reading)",
      value: liveHaze ? `${liveHaze.apiAvg} (${liveHaze.category})` : "—",
      trend: liveHaze
        ? `Right now, near ${liveHaze.locationLabel}. Not specific to this facility.`
        : "Live reading unavailable.",
      provenance: "public-evidence",
    },
    {
      name: "COVID-19 activity",
      value: "[SOURCE]",
      trend: "[TREND] – not yet connected to a public health source.",
      provenance: "public-evidence",
    },
    {
      name: "Influenza-like illness (ILI)",
      value: "[ILI RATE]",
      trend: "[TREND] – not yet connected to a public health source.",
      provenance: "public-evidence",
    },
  ];
}

export function getRecentPredictionRuns(facilityId: number, limit = 3): PredictionRunSummary[] {
  return PREDICTION_RUNS.filter((r) => r.facilityId === facilityId).slice(0, limit);
}
