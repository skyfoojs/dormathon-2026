// Recent usage per item: the last N recorded days of daily_inventory, added
// up. This is context for the restock decision, not the forecast itself. The
// forecast (lib/forecast/demand.ts) still uses the item's whole history, and
// the restock trigger (lib/forecast/runout.ts) still fires at 30% of supply.

import { addDays, type DailyStockRow } from "@/lib/forecast/demand";

export const USAGE_WINDOW_DAYS = 30;

export type DailyUsage = { date: string; issuedQty: number; unmetQty: number; usageQty: number };

export type ItemUsage = {
  itemId: number;
  // The window asked for. Every item shares it, so totals are comparable.
  fromDate: string;
  toDate: string;
  // Days in the window that actually have a row for this item.
  daysRecorded: number;
  issuedQty: number;
  unmetQty: number;
  // Usage is issued + unmet demand, the same definition the forecast uses:
  // issued alone reads low on days the shelf was empty.
  usageQty: number;
  // Averaged over the days recorded, not the window length, so a gap in data
  // entry does not read as lower usage.
  meanDailyUsage: number;
  // Closing stock on the item's latest recorded day in the window.
  closingStock: number;
  daily: DailyUsage[];
};

// First day of a window of `days` days ending on `toDate`.
export function usageWindowStart(toDate: string, days: number): string {
  return addDays(toDate, -(days - 1));
}

// Groups rows by item and totals the `days` days ending on the latest date
// found in the rows. Rows outside that window are ignored, so it is safe to
// pass a longer history.
export function summariseRecentUsage(rows: DailyStockRow[], days = USAGE_WINDOW_DAYS): ItemUsage[] {
  if (rows.length === 0) return [];
  const toDate = rows.reduce((latest, r) => (r.inventory_date > latest ? r.inventory_date : latest), "").slice(0, 10);
  const fromDate = usageWindowStart(toDate, days);

  const byItem = new Map<number, DailyStockRow[]>();
  for (const row of rows) {
    const date = row.inventory_date.slice(0, 10);
    if (date < fromDate || date > toDate) continue;
    const list = byItem.get(row.item_id);
    if (list) list.push(row);
    else byItem.set(row.item_id, [row]);
  }

  return [...byItem.entries()]
    .sort(([a], [b]) => a - b)
    .map(([itemId, itemRows]) => {
      const sorted = [...itemRows].sort((a, b) => a.inventory_date.localeCompare(b.inventory_date));
      const daily = sorted.map((r) => {
        const unmetQty = r.unmet_demand_qty ?? 0;
        return {
          date: r.inventory_date.slice(0, 10),
          issuedQty: r.issued_qty,
          unmetQty,
          usageQty: r.issued_qty + unmetQty,
        };
      });
      const issuedQty = daily.reduce((sum, d) => sum + d.issuedQty, 0);
      const unmetQty = daily.reduce((sum, d) => sum + d.unmetQty, 0);
      return {
        itemId,
        fromDate,
        toDate,
        daysRecorded: daily.length,
        issuedQty,
        unmetQty,
        usageQty: issuedQty + unmetQty,
        meanDailyUsage: (issuedQty + unmetQty) / daily.length,
        closingStock: sorted[sorted.length - 1].closing_stock,
        daily,
      };
    });
}
