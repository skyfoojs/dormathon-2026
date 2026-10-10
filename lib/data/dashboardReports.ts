import type { DemandForecast, Item, PurchaseOrder, Report, ReportStatus, WeeklyInventory } from "@/lib/db/types";

export type PoDeliveredKpi = { delivered: number; total: number };

export function getPoDeliveredKpi(purchaseOrders: PurchaseOrder[]): PoDeliveredKpi {
  return {
    delivered: purchaseOrders.filter((po) => po.status === "Delivered").length,
    total: purchaseOrders.length,
  };
}

export type ItemsWellStockedKpi = { wellStocked: number; total: number };

// "Well stocked" = Low risk tier = 2 or more weeks of cover, over the
// latest week on record for each tracked item.
export function getItemsWellStockedKpi(weeklyInventory: WeeklyInventory[]): ItemsWellStockedKpi {
  const latestByItem = new Map<number, WeeklyInventory>();
  for (const row of [...weeklyInventory].sort((a, b) => a.week_start.localeCompare(b.week_start))) {
    latestByItem.set(row.item_id, row);
  }
  const rows = [...latestByItem.values()];
  return {
    wellStocked: rows.filter((r) => r.weeks_of_cover >= 2).length,
    total: rows.length,
  };
}

export type ProductAccuracy = {
  itemId: number;
  itemName: string;
  accuracy: number; // 0-100
  avgMissUnits: number;
  weeksWithin10Pct: number;
  weeksScored: number;
};

// Accuracy = 100 - mean absolute percentage error, floored at 0. Only rows
// with a known actual (i.e. the target week has closed) count.
export function getProductAccuracy(forecasts: DemandForecast[], items: Item[]): ProductAccuracy[] {
  const byItem = new Map<number, DemandForecast[]>();
  for (const f of forecasts) {
    if (f.actual_qty === null || f.avg_qty === null) continue;
    const list = byItem.get(f.item_id) ?? [];
    list.push(f);
    byItem.set(f.item_id, list);
  }

  const out: ProductAccuracy[] = [];
  for (const [itemId, rows] of byItem) {
    if (rows.length === 0) continue;
    const errors = rows.map((r) => Math.abs(r.avg_qty! - r.actual_qty!));
    const pctErrors = rows.map((r) => (r.actual_qty === 0 ? 0 : Math.abs(r.avg_qty! - r.actual_qty!) / r.actual_qty!));
    const mape = pctErrors.reduce((a, b) => a + b, 0) / pctErrors.length;
    const accuracy = Math.max(0, 100 - mape * 100);
    const avgMissUnits = errors.reduce((a, b) => a + b, 0) / errors.length;
    const weeksWithin10Pct = pctErrors.filter((e) => e <= 0.1).length;
    out.push({
      itemId,
      itemName: items.find((i) => i.item_id === itemId)?.item_name ?? "Item",
      accuracy,
      avgMissUnits,
      weeksWithin10Pct,
      weeksScored: rows.length,
    });
  }
  return out.sort((a, b) => b.accuracy - a.accuracy);
}

export type PredictionAccuracyKpi = { meanAccuracy: number; productCount: number; weeksScored: number };

export function getPredictionAccuracyKpi(productAccuracy: ProductAccuracy[]): PredictionAccuracyKpi {
  if (productAccuracy.length === 0) return { meanAccuracy: 0, productCount: 0, weeksScored: 0 };
  const meanAccuracy = productAccuracy.reduce((a, b) => a + b.accuracy, 0) / productAccuracy.length;
  const weeksScored = Math.max(...productAccuracy.map((p) => p.weeksScored));
  return { meanAccuracy, productCount: productAccuracy.length, weeksScored };
}

export type ExpectedVsActualPoint = {
  weekStart: string;
  actual: number | null;
  expected: number | null;
};

export function getExpectedVsActualSeries(forecasts: DemandForecast[], itemId: number): ExpectedVsActualPoint[] {
  return forecasts
    .filter((f) => f.item_id === itemId)
    .sort((a, b) => a.target_week_start.localeCompare(b.target_week_start))
    .map((f) => ({
      weekStart: f.target_week_start,
      actual: f.actual_qty,
      expected: f.avg_qty,
    }));
}

export const REPORT_STATUSES: ReportStatus[] = [
  "pending_approval",
  "delivery_failed",
  "sent",
  "confirmed_by_supplier",
  "rejected",
];

export function getReportStatusBreakdown(reports: Report[]): { status: ReportStatus; count: number }[] {
  return REPORT_STATUSES.map((status) => ({
    status,
    count: reports.filter((r) => r.status === status).length,
  }));
}

export function getPendingReports(reports: Report[], limit = 5): Report[] {
  return reports
    .filter((r) => r.status === "pending_approval")
    .sort((a, b) => a.generated_at.localeCompare(b.generated_at))
    .slice(0, limit);
}
