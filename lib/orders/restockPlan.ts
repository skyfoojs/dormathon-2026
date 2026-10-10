// Decides which purchase orders AiGIS should raise. Pure logic: it is given
// the rows and returns a plan, so the same rules run in a dry run and a real
// run, and wherever else the plan is needed.
//
// The rules, in order, for each item:
//   1. Skip it if it already has an order that is pending or in transit.
//   2. Forecast weekly demand (lib/forecast/demand.ts) and project its stock
//      forward (lib/forecast/runout.ts).
//   3. Order only if the projection reaches the restock trigger (30% of
//      supply) within the supplier lead time, since an order placed today
//      cannot arrive sooner than that.
//   4. Order enough for the next 30 days of predicted usage, less what is on
//      hand and already in transit.
// Lines for the same supplier are put on one order.

import type { Item } from "@/lib/db/types";
import { addDays, forecastItem, type DailyStockRow, type SupplyOrderRow } from "@/lib/forecast/demand";
import { projectStock } from "@/lib/forecast/runout";
import { summariseRecentUsage, USAGE_WINDOW_DAYS } from "@/lib/forecast/usage";
import type { ForecastSupplier } from "@/lib/queries/forecastInputs";

// How many days of predicted usage one automated order should cover.
export const ORDER_COVER_DAYS = 30;

const OPEN_STATUSES = new Set<SupplyOrderRow["status"]>(["Pending", "In transit"]);

export type PlannedLine = {
  itemId: number;
  itemName: string;
  qtyOrdered: number;
  unitCostMyr: number;
  // Why the line was raised, kept so the decision can be explained later.
  onHand: number;
  onOrder: number;
  weeklyForecastQty: number;
  recentUsageQty: number;
  threshold: number;
  triggerDate: string;
  leadDays: number;
};

export type PlannedOrder = {
  supplierId: number;
  orderDate: string;
  expectedReceiptDate: string;
  lines: PlannedLine[];
};

export type SkipReason = "no-history" | "open-order" | "above-threshold" | "enough-stock";

export type RestockPlan = {
  orders: PlannedOrder[];
  skipped: { itemId: number; itemName: string; reason: SkipReason }[];
};

export function planRestockOrders(input: {
  items: Item[];
  suppliers: ForecastSupplier[];
  dailyByItem: Map<number, DailyStockRow[]>;
  ordersByItem: Map<number, SupplyOrderRow[]>;
  today: string;
}): RestockPlan {
  const supplierById = new Map(input.suppliers.map((s) => [s.supplier_id, s]));
  const linesBySupplier = new Map<number, PlannedLine[]>();
  const skipped: RestockPlan["skipped"] = [];

  for (const item of input.items) {
    const skip = (reason: SkipReason) => skipped.push({ itemId: item.item_id, itemName: item.item_name, reason });
    const dailyRows = input.dailyByItem.get(item.item_id) ?? [];
    const purchaseOrders = input.ordersByItem.get(item.item_id) ?? [];

    if (purchaseOrders.some((po) => OPEN_STATUSES.has(po.status))) {
      skip("open-order");
      continue;
    }

    const forecast = forecastItem({
      item,
      dailyRows,
      purchaseOrders,
      supplier: supplierById.get(item.primary_supplier_id),
    });
    const projection = forecast
      ? projectStock({ dailyRows, purchaseOrders, weeklyForecastQty: forecast.forecastQty })
      : null;
    if (!forecast || !projection) {
      skip("no-history");
      continue;
    }

    const leadDays = Math.max(1, Math.ceil(forecast.leadWeeks * 7));
    const trigger = projection.trigger;
    if (!trigger || trigger.daysFromLastActual > leadDays) {
      skip("above-threshold");
      continue;
    }

    const coverQty = projection.dailyDemand * ORDER_COVER_DAYS;
    const qtyOrdered = Math.ceil(coverQty - forecast.onHand - forecast.onOrder);
    if (qtyOrdered <= 0) {
      skip("enough-stock");
      continue;
    }

    const line: PlannedLine = {
      itemId: item.item_id,
      itemName: item.item_name,
      qtyOrdered,
      unitCostMyr: item.unit_cost_myr,
      onHand: forecast.onHand,
      onOrder: forecast.onOrder,
      weeklyForecastQty: forecast.forecastQty,
      recentUsageQty: summariseRecentUsage(dailyRows, USAGE_WINDOW_DAYS)[0]?.usageQty ?? 0,
      threshold: projection.threshold,
      triggerDate: trigger.date,
      leadDays,
    };
    const lines = linesBySupplier.get(item.primary_supplier_id);
    if (lines) lines.push(line);
    else linesBySupplier.set(item.primary_supplier_id, [line]);
  }

  const orders = [...linesBySupplier.entries()]
    .sort(([a], [b]) => a - b)
    .map(([supplierId, lines]) => ({
      supplierId,
      orderDate: input.today,
      // The order is complete when its slowest line arrives.
      expectedReceiptDate: addDays(input.today, Math.max(...lines.map((l) => l.leadDays))),
      lines,
    }));

  return { orders, skipped };
}
