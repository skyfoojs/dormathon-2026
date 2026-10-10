import type { Item, PurchaseOrder, Supplier, WeeklyInventory } from "@/lib/db/types";
import { isPurchaseOrderDelayed } from "@/lib/data/purchaseOrders";

export type ItemRow = {
  item: Item;
  supplierName: string;
  onHand: number | null;
  coverWeeks: number | null;
  reorderLevel: number | null;
};

export function getItemRows(
  facilityId: number,
  items: Item[],
  weeklyInventory: WeeklyInventory[],
  suppliers: Supplier[],
): ItemRow[] {
  return items.map((item) => {
    const rows = weeklyInventory.filter((r) => r.facility_id === facilityId && r.item_id === item.item_id);
    const latestWeek = rows.map((r) => r.week_start).sort().at(-1);
    const latest = latestWeek ? rows.find((r) => r.week_start === latestWeek) : undefined;
    const supplier = suppliers.find((s) => s.supplier_id === item.primary_supplier_id);
    return {
      item,
      supplierName: supplier?.supplier_name ?? "—",
      onHand: latest ? latest.closing_stock : null,
      coverWeeks: latest ? latest.weeks_of_cover : null,
      reorderLevel: item.reorder_level,
    };
  });
}

export function getMeanWeeklyIssue(
  facilityId: number,
  itemId: number,
  weeklyInventory: WeeklyInventory[],
): number {
  const rows = weeklyInventory
    .filter((r) => r.facility_id === facilityId && r.item_id === itemId)
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .slice(-6);
  if (rows.length === 0) return 0;
  return rows.reduce((sum, r) => sum + r.issued_qty, 0) / rows.length;
}

export function coverTone(weeks: number | null): "red" | "amber" | "default" {
  if (weeks === null) return "default";
  if (weeks < 1) return "red";
  if (weeks < 2) return "amber";
  return "default";
}

export type PurchaseOrderRow = {
  po: PurchaseOrder;
  itemName: string;
  supplierName: string;
};

export function getPurchaseOrderRows(
  facilityId: number,
  purchaseOrders: PurchaseOrder[],
  items: Item[],
  suppliers: Supplier[],
): PurchaseOrderRow[] {
  return purchaseOrders
    .filter((po) => po.facility_id === facilityId)
    .sort((a, b) => b.order_date.localeCompare(a.order_date))
    .map((po) => ({
      po,
      itemName: items.find((i) => i.item_id === po.item_id)?.item_name ?? "—",
      supplierName: suppliers.find((s) => s.supplier_id === po.supplier_id)?.supplier_name ?? "—",
    }));
}

// One order as the Orders page shows it. Each purchase_orders row is a line
// item; rows sharing a po_doc_id belong to the same order, and a row with no
// document is an order with a single line.
export type OrderRow = {
  // The anchor line (lowest po_id). Its id is the order's PO number, and its
  // supplier, dates and status stand for the whole order.
  po: PurchaseOrder;
  supplierName: string;
  lines: PurchaseOrderRow[];
  qtyOrdered: number;
  totalValue: number;
};

export function groupOrderRows(rows: PurchaseOrderRow[]): OrderRow[] {
  const groups = new Map<string, PurchaseOrderRow[]>();
  for (const row of rows) {
    const docId = row.po.po_doc_id;
    const key = docId === null || docId === undefined ? `po:${row.po.po_id}` : `doc:${docId}`;
    const lines = groups.get(key);
    if (lines) lines.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()].map((unsorted) => {
    const lines = [...unsorted].sort((a, b) => a.po.po_id - b.po.po_id);
    return {
      po: lines[0].po,
      supplierName: lines[0].supplierName,
      lines,
      qtyOrdered: lines.reduce((sum, l) => sum + l.po.qty_ordered, 0),
      totalValue: lines.reduce((sum, l) => sum + l.po.qty_ordered * l.po.unit_cost_myr, 0),
    };
  });
}

export type SupplierRiskLevel = "Late delivery" | "Concentration" | "Single source" | "Low";

export type SupplierRow = {
  supplier: Supplier;
  itemsSupplied: number;
  openPoCount: number;
  risk: { level: SupplierRiskLevel; note: string };
};

export function getSupplierRows(
  facilityId: number,
  suppliers: Supplier[],
  items: Item[],
  purchaseOrders: PurchaseOrder[],
): SupplierRow[] {
  return suppliers.map((supplier) => {
    const suppliedItems = items.filter((i) => i.primary_supplier_id === supplier.supplier_id);
    const criticalItems = suppliedItems.filter((i) => i.is_critical === 1);
    const supplierPOs = purchaseOrders.filter(
      (po) => po.facility_id === facilityId && po.supplier_id === supplier.supplier_id,
    );
    const openPoCount = supplierPOs.filter((po) => po.status === "In transit").length;
    const hasDelayed = supplierPOs.some((po) => po.status === "In transit" && isPurchaseOrderDelayed(po));

    let risk: SupplierRow["risk"];
    if (hasDelayed) {
      risk = { level: "Late delivery", note: "An open order with this supplier is overdue." };
    } else if (criticalItems.length >= 2) {
      risk = {
        level: "Concentration",
        note: `${criticalItems.length} critical items depend on this supplier alone.`,
      };
    } else if (criticalItems.length === 1) {
      risk = {
        level: "Single source",
        note: `${criticalItems[0].item_name} has no backup supplier on file.`,
      };
    } else {
      risk = { level: "Low", note: "No known risk factors." };
    }

    return {
      supplier,
      itemsSupplied: suppliedItems.length,
      openPoCount,
      risk,
    };
  });
}
