import type { ProvenanceKind } from "@/components/ui/Tag";
import type { Batch, Facility, Item, PurchaseOrder, Supplier, WeeklyInventory } from "@/lib/db/types";
import { isPurchaseOrderDelayed } from "@/lib/data/purchaseOrders";
import { mean, stdDev } from "@/lib/data/stats";

export type WarningSeverity = "high" | "medium" | "low";
export type WarningKind = "restock" | "manage" | "check-input";
export type WarningStatus = "open" | "resolved" | "snoozed";

export type WarningRecord = {
  id: string;
  facilityId: number;
  severity: WarningSeverity;
  kind: WarningKind;
  provenance: ProvenanceKind;
  title: string;
  detail: string;
  aiCheck: string;
  suggestedAction: string;
  status: WarningStatus;
  snoozedUntil: string | null;
};

type FacilityData = {
  facility: Facility;
  weeklyInventory: WeeklyInventory[];
  purchaseOrders: PurchaseOrder[];
  batches: Batch[];
};

function daysUntil(isoDate: string, today: Date): number {
  const diffMs = new Date(`${isoDate}T00:00:00Z`).getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function computeWarnings(input: {
  items: Item[];
  suppliers: Supplier[];
  facilities: FacilityData[];
  today?: Date;
}): WarningRecord[] {
  const { items, suppliers, facilities } = input;
  const today = input.today ?? new Date();
  const warnings: WarningRecord[] = [];
  const itemById = new Map(items.map((i) => [i.item_id, i]));
  const supplierById = new Map(suppliers.map((s) => [s.supplier_id, s]));

  const criticalItemsBySupplier = new Map<number, Item[]>();
  for (const item of items.filter((i) => i.is_critical === 1)) {
    const list = criticalItemsBySupplier.get(item.primary_supplier_id) ?? [];
    list.push(item);
    criticalItemsBySupplier.set(item.primary_supplier_id, list);
  }

  for (const { facility, weeklyInventory, purchaseOrders, batches } of facilities) {
    const facilityId = facility.facility_id;
    const byItem = new Map<number, WeeklyInventory[]>();
    for (const r of weeklyInventory) {
      const list = byItem.get(r.item_id) ?? [];
      list.push(r);
      byItem.set(r.item_id, list);
    }

    const itemsWithDataHere = new Set<number>();

    for (const [itemId, rowsUnsorted] of byItem) {
      const rows = [...rowsUnsorted].sort((a, b) => a.week_start.localeCompare(b.week_start));
      const latest = rows[rows.length - 1];
      const item = itemById.get(itemId);
      if (!latest || !item) continue;
      itemsWithDataHere.add(itemId);

      // Low cover vs reorder level
      if (item.is_critical === 1 && latest.weeks_of_cover < 2) {
        const severity: WarningSeverity = latest.weeks_of_cover < 1 ? "high" : "medium";
        warnings.push({
          id: `cover:${facilityId}:${itemId}`,
          facilityId,
          severity,
          kind: "restock",
          provenance: "model-output",
          title: `${item.item_name}: ${latest.weeks_of_cover.toFixed(2)} weeks of cover left`,
          detail: `Closing stock is ${latest.closing_stock} against a reorder level of ${latest.reorder_level} at ${facility.facility_name}, for the week of ${latest.week_start}.`,
          aiCheck: "Rule-based check on weekly_inventory: latest week's cover compared to the saved reorder level.",
          suggestedAction: `Raise or expedite a purchase order for ${item.item_name}.`,
          status: "open",
          snoozedUntil: null,
        });
      }

      // Unusual latest-week issued quantity vs trailing history (possible typo)
      const trailing = rows.slice(0, -1).slice(-8).map((r) => r.issued_qty);
      if (trailing.length >= 4) {
        const m = mean(trailing);
        const sd = stdDev(trailing);
        if (sd > 0 && Math.abs(latest.issued_qty - m) > 2.5 * sd) {
          warnings.push({
            id: `outlier:${facilityId}:${itemId}:${latest.week_start}`,
            facilityId,
            severity: "low",
            kind: "check-input",
            provenance: "model-output",
            title: `${item.item_name}: issued quantity looks unusual this week`,
            detail: `${latest.issued_qty} units issued, versus a trailing average of ${Math.round(m)} over the previous ${trailing.length} weeks.`,
            aiCheck: "Statistical check: more than 2.5 standard deviations from the trailing mean.",
            suggestedAction: "Check this week's weekly_inventory entry for a data entry error.",
            status: "open",
            snoozedUntil: null,
          });
        }
      }
    }

    // Late purchase orders
    for (const po of purchaseOrders) {
      if (po.status !== "In transit" || !isPurchaseOrderDelayed(po)) continue;
      const days = Math.abs(daysUntil(po.expected_receipt_date, today));
      const item = itemById.get(po.item_id);
      warnings.push({
        id: `po:${po.po_id}`,
        facilityId,
        severity: days > 7 ? "high" : "medium",
        kind: "manage",
        provenance: "database",
        title: `Purchase order PO-${po.po_id} is ${days} day${days === 1 ? "" : "s"} late`,
        detail: `Expected receipt date has passed with no delivery recorded, for ${item?.item_name ?? "this item"} at ${facility.facility_name}.`,
        aiCheck: "Rule-based check on purchase_orders: no model disagreement.",
        suggestedAction: "Contact the supplier for an updated delivery date.",
        status: "open",
        snoozedUntil: null,
      });
    }

    // Batches near expiry
    for (const batch of batches) {
      if (!batch.expiry_date) continue;
      const days = daysUntil(batch.expiry_date, today);
      if (days < 0 || days > 30) continue;
      const item = itemById.get(batch.item_id);
      warnings.push({
        id: `batch:${batch.batch_id}`,
        facilityId,
        severity: days <= 7 ? "high" : "medium",
        kind: "manage",
        provenance: "database",
        title: `${item?.item_name ?? "Item"}: batch nearing expiry`,
        detail: `Lot ${batch.lot_no} (${batch.quantity} units) expires in ${days} day${days === 1 ? "" : "s"} at ${facility.facility_name}.`,
        aiCheck: "Rule-based check on batches: no model disagreement.",
        suggestedAction: "Prioritise this lot for issue, or consider a transfer to a facility with higher demand.",
        status: "open",
        snoozedUntil: null,
      });
    }

    // Supplier concentration: only surfaced for a facility that actually
    // stocks items from that supplier.
    for (const [supplierId, criticalItems] of criticalItemsBySupplier) {
      if (criticalItems.length < 2) continue;
      const stockedHere = criticalItems.filter((i) => itemsWithDataHere.has(i.item_id));
      if (stockedHere.length < 2) continue;
      const supplier = supplierById.get(supplierId);
      warnings.push({
        id: `concentration:${facilityId}:${supplierId}`,
        facilityId,
        severity: "medium",
        kind: "manage",
        provenance: "model-output",
        title: `${supplier?.supplier_name ?? "A supplier"} supplies several critical items here`,
        detail: `${stockedHere.length} critical items at ${facility.facility_name} depend on this single supplier: ${stockedHere.map((i) => i.item_name).join(", ")}.`,
        aiCheck: "Rule-based check on items.primary_supplier_id: no model disagreement.",
        suggestedAction: "Identify and record a backup supplier for at least one of these items.",
        status: "open",
        snoozedUntil: null,
      });
    }
  }

  return warnings;
}
