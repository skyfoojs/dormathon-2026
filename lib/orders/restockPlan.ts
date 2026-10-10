// Decides which purchase orders AiGIS should raise, from the same predicted
// values the Predictions page shows. Pure logic: it is given the rows and
// returns a plan, so the same rules run in a dry run and a real run, and
// wherever else the plan is needed.
//
// The rules, in order, for each item:
//   1. Skip it if it already has an order that is pending or in transit.
//   2. Read its prediction: the latest saved forecast run, with the AI
//      adjustment on top when one exists. An item with no saved run is
//      forecast from its history, which is what a run right now would save.
//   3. Order only if the predicted stock reaches the restock threshold
//      within the supplier lead time, since an order placed today cannot
//      arrive sooner than that.
//   4. Order the predicted buy amount, less what is on hand.
// Lines for the same supplier are put on one order.

import {
  addDays,
  dayNumber,
  forecastItem,
  sumUsage,
  usageOnDay,
  type DailyStockRow,
  type SupplyOrderRow,
} from "@/lib/forecast/demand";
import { buildAiForecast, type ForecastBasis, type UsageAdjustment } from "@/lib/forecast/aiForecast";
import { projectStock, stockHistory, type StockProjection } from "@/lib/forecast/runout";
import type { ForecastItem, ForecastSupplier } from "@/lib/queries/forecastInputs";

const OPEN_STATUSES = new Set<SupplyOrderRow["status"]>(["Pending", "In transit"]);

// One item's latest saved forecast run, and the AI adjustment made to it.
export type SavedPrediction = {
  forecastDate: string;
  basis: ForecastBasis;
  threshold: number | null;
  buyQty: number | null;
  ai: { adjustment: UsageAdjustment; threshold: number | null; buyQty: number | null } | null;
};

export type RestockInput = {
  items: ForecastItem[];
  suppliers: ForecastSupplier[];
  dailyByItem: Map<number, DailyStockRow[]>;
  ordersByItem: Map<number, SupplyOrderRow[]>;
  predictions: Map<number, SavedPrediction>;
};

export type PredictionSource = "ai" | "algorithmic";

export type ItemStockStatus = {
  itemId: number;
  itemName: string;
  // Running low = the predicted stock reaches the threshold within the lead time.
  status: "well-stocked" | "running-low";
  // Which predicted line the figures below come from.
  source: PredictionSource;
  onHand: number;
  // The predicted buy amount: usage over the cover days plus safety stock.
  buyQty: number;
  threshold: number;
  triggerDate: string | null;
  leadDays: number;
};

export type PlannedLine = {
  itemId: number;
  itemName: string;
  qtyOrdered: number;
  unitCostMyr: number;
  // Why the line was raised, kept so the decision can be explained later.
  source: PredictionSource;
  onHand: number;
  buyQty: number;
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

type PredictionReading = {
  source: PredictionSource;
  projection: StockProjection;
  buyQty: number;
  leadDays: number;
};

// Every item with stock history, and whether its prediction says to restock.
export function assessStock(input: RestockInput): ItemStockStatus[] {
  const supplierById = new Map(input.suppliers.map((s) => [s.supplier_id, s]));
  return input.items.flatMap((item) => {
    const dailyRows = input.dailyByItem.get(item.item_id) ?? [];
    const purchaseOrders = input.ordersByItem.get(item.item_id) ?? [];
    const prediction = input.predictions.get(item.item_id);
    const reading = prediction
      ? readSavedPrediction(item, prediction, dailyRows, purchaseOrders)
      : readLiveForecast(item, dailyRows, purchaseOrders, supplierById.get(item.primary_supplier_id));
    if (!reading) return [];

    const { projection } = reading;
    const leadDays = Math.max(1, Math.ceil(reading.leadDays));
    const runningLow = projection.trigger !== null && projection.trigger.daysFromLastActual <= leadDays;
    return [
      {
        itemId: item.item_id,
        itemName: item.item_name,
        status: runningLow ? "running-low" : "well-stocked",
        source: reading.source,
        onHand: projection.projection[0].stock,
        buyQty: reading.buyQty,
        threshold: projection.threshold,
        triggerDate: projection.trigger?.date ?? null,
        leadDays,
      },
    ];
  });
}

export function planRestockOrders(input: RestockInput & { today: string }): RestockPlan {
  const statusByItem = new Map(assessStock(input).map((status) => [status.itemId, status]));
  const linesBySupplier = new Map<number, PlannedLine[]>();
  const skipped: RestockPlan["skipped"] = [];

  for (const item of input.items) {
    const skip = (reason: SkipReason) => skipped.push({ itemId: item.item_id, itemName: item.item_name, reason });
    const purchaseOrders = input.ordersByItem.get(item.item_id) ?? [];

    if (purchaseOrders.some((po) => OPEN_STATUSES.has(po.status))) {
      skip("open-order");
      continue;
    }

    const status = statusByItem.get(item.item_id);
    if (!status) {
      skip("no-history");
      continue;
    }
    if (status.status !== "running-low" || status.triggerDate === null) {
      skip("above-threshold");
      continue;
    }

    const qtyOrdered = Math.ceil(status.buyQty - status.onHand);
    if (qtyOrdered <= 0) {
      skip("enough-stock");
      continue;
    }

    const line: PlannedLine = {
      itemId: item.item_id,
      itemName: item.item_name,
      qtyOrdered,
      unitCostMyr: item.unit_cost_myr,
      source: status.source,
      onHand: status.onHand,
      buyQty: status.buyQty,
      threshold: status.threshold,
      triggerDate: status.triggerDate,
      leadDays: status.leadDays,
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

// The saved run, moved forward to start from the latest recorded stock, the
// way the Predictions page draws it. The AI line is used when there is one.
function readSavedPrediction(
  item: ForecastItem,
  prediction: SavedPrediction,
  dailyRows: DailyStockRow[],
  purchaseOrders: SupplyOrderRow[],
): PredictionReading | null {
  const lastActual = stockHistory(dailyRows).at(-1);
  if (!lastActual) return null;
  const { basis, ai } = prediction;
  const dayOffset = Math.max(0, dayNumber(lastActual.date) + 1 - dayNumber(prediction.forecastDate));

  if (ai) {
    const aiForecast = buildAiForecast({
      basis,
      adjustment: ai.adjustment,
      reorderLevel: item.reorder_level ?? ai.threshold,
      dailyRows,
      purchaseOrders,
      dayOffset,
    });
    if (aiForecast) {
      return {
        source: "ai",
        projection: aiForecast.projection,
        buyQty: ai.buyQty ?? aiForecast.buyQty,
        leadDays: basis.leadDays,
      };
    }
  }

  const usage = (h: number) => usageOnDay(basis, h + dayOffset);
  const projection = projectStock({
    dailyRows,
    purchaseOrders,
    usage,
    threshold: item.reorder_level ?? prediction.threshold ?? sumUsage(usage, basis.leadDays) + basis.safetyStock,
  });
  if (!projection) return null;
  return {
    source: "algorithmic",
    projection,
    buyQty: prediction.buyQty ?? sumUsage(usage, basis.coverDays) + basis.safetyStock,
    leadDays: basis.leadDays,
  };
}

function readLiveForecast(
  item: ForecastItem,
  dailyRows: DailyStockRow[],
  purchaseOrders: SupplyOrderRow[],
  supplier: ForecastSupplier | undefined,
): PredictionReading | null {
  const forecast = forecastItem({ item, dailyRows, purchaseOrders, supplier });
  if (!forecast) return null;
  const projection = projectStock({
    dailyRows,
    purchaseOrders,
    usage: (h) => usageOnDay(forecast, h),
    threshold: item.reorder_level ?? forecast.reorderPoint,
  });
  if (!projection) return null;
  return { source: "algorithmic", projection, buyQty: forecast.buyQty, leadDays: forecast.leadDays };
}
