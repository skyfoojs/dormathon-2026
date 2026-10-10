"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Input, Label } from "@/components/ui/Input";
import { FilterChips } from "@/components/ui/FilterChips";
import { SavedBanner, ConfirmDeleteBanner } from "@/components/ui/Banner";
import { PurchaseOrderForm } from "@/components/orders/PurchaseOrderForm";
import { PurchaseOrdersTable } from "@/components/orders/PurchaseOrdersTable";
import { useFacility } from "@/components/providers/FacilityProvider";
import { getPurchaseOrderRows, type PurchaseOrderRow } from "@/lib/data/inventory";
import { isPurchaseOrderDelayed } from "@/lib/data/purchaseOrders";
import { daysFromToday } from "@/lib/data/dates";
import { TODAY_ISO } from "@/lib/db/seed";
import type { PurchaseOrderFormValues } from "@/lib/validation/inventory";
import * as api from "@/lib/api/resources";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/db/types";

type Filter = PurchaseOrderStatus | "all";

type Panel =
  | { mode: "edit"; id: number }
  | { mode: "delete"; id: number };

const FILTER_LABELS: { id: Filter; label: string }[] = [
  { id: "In transit", label: "In transit" },
  { id: "Delivered", label: "Delivered" },
  { id: "Cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

const EMPTY_MESSAGE: Record<Filter, string> = {
  "In transit": "Nothing in transit. Every order has arrived or been cancelled.",
  Delivered: "No delivered orders yet.",
  Cancelled: "No cancelled orders.",
  all: "No purchase orders for this facility.",
};

const MYR = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrdersView() {
  const { facilityId } = useFacility();
  if (facilityId === null) return null;
  return <OrdersViewContent facilityId={facilityId} />;
}

function OrdersViewContent({ facilityId }: { facilityId: number }) {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<Filter>("In transit");
  const [search, setSearch] = React.useState("");
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [showSaved, setShowSaved] = React.useState(false);

  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: api.getSuppliers });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId),
  });
  const weeklyInventoryQuery = useQuery({
    queryKey: ["weekly-inventory", facilityId],
    queryFn: () => api.getWeeklyInventory(facilityId),
  });

  const items = itemsQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const purchaseOrders = poQuery.data ?? [];
  const weeklyInventory = weeklyInventoryQuery.data ?? [];

  function saved() {
    setPanel(null);
    setShowSaved(true);
  }

  const invalidatePOs = () => qc.invalidateQueries({ queryKey: ["purchase-orders", facilityId] });

  const updatePoMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Omit<PurchaseOrder, "po_id"> }) =>
      api.updatePurchaseOrder(id, input),
    onSuccess: () => {
      invalidatePOs();
      saved();
    },
  });
  const deletePoMutation = useMutation({
    mutationFn: (id: number) => api.deletePurchaseOrder(id),
    onSuccess: invalidatePOs,
  });

  const allRows = getPurchaseOrderRows(facilityId, purchaseOrders, items, suppliers);
  const inTransit = purchaseOrders.filter((po) => po.status === "In transit");
  const delayedCount = inTransit.filter(isPurchaseOrderDelayed).length;
  const arrivingThisWeek = inTransit.filter((po) => {
    const days = daysFromToday(po.expected_receipt_date);
    return days >= 0 && days <= 7;
  }).length;
  const valueInTransit = inTransit.reduce((sum, po) => sum + po.qty_ordered * po.unit_cost_myr, 0);

  const chips = FILTER_LABELS.map((f) => ({
    ...f,
    count: f.id === "all" ? allRows.length : allRows.filter((r) => r.po.status === f.id).length,
  }));

  const query = search.trim().toLowerCase();
  const visibleRows = allRows
    .filter((r) => filter === "all" || r.po.status === filter)
    .filter((r) => !query || `po-${r.po.po_id} ${r.supplierName}`.toLowerCase().includes(query));
  // In transit: soonest expected first, so delayed orders lead. Other views
  // keep getPurchaseOrderRows' newest-ordered-first order.
  if (filter === "In transit") {
    visibleRows.sort((a, b) => a.po.expected_receipt_date.localeCompare(b.po.expected_receipt_date));
  }

  function handleMarkReceived({ po: { po_id, ...rest } }: PurchaseOrderRow) {
    updatePoMutation.mutate({
      id: po_id,
      input: { ...rest, status: "Delivered", actual_receipt_date: TODAY_ISO, qty_received: rest.qty_ordered },
    });
  }

  function handlePoSubmit(values: PurchaseOrderFormValues) {
    const poData = {
      facility_id: facilityId,
      item_id: values.item_id,
      supplier_id: values.supplier_id,
      order_date: values.order_date,
      qty_ordered: values.qty_ordered,
      unit_cost_myr: values.unit_cost_myr,
      expected_receipt_date: values.expected_receipt_date,
      status: values.status,
      actual_receipt_date: values.status === "Delivered" ? (values.actual_receipt_date ?? null) : null,
      qty_received: values.status === "Delivered" ? (values.qty_received ?? null) : null,
    };
    if (panel?.mode === "edit") updatePoMutation.mutate({ id: panel.id, input: poData });
  }

  function handleDeleteConfirm() {
    if (panel?.mode !== "delete") return;
    deletePoMutation.mutate(panel.id);
    setPanel(null);
  }

  const loadError =
    itemsQuery.error ||
    suppliersQuery.error ||
    poQuery.error ||
    weeklyInventoryQuery.error ||
    updatePoMutation.error;

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${inTransit.length} purchase orders in transit, ${delayedCount} past their expected date.`}
      />

      {loadError ? (
        <div className="rounded-md border border-red bg-red/5 p-4 text-sm text-red-dark">
          Could not load data from the database: {(loadError as Error).message}
        </div>
      ) : null}

      {showSaved ? <SavedBanner onDismiss={() => setShowSaved(false)} /> : null}

      {panel?.mode === "delete" ? (
        <ConfirmDeleteBanner
          label={`PO-${panel.id}`}
          onCancel={() => setPanel(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {panel?.mode === "edit" ? (
        <PurchaseOrderForm
          key={panel.id}
          mode="edit"
          po={purchaseOrders.find((p) => p.po_id === panel.id)}
          facilityId={facilityId}
          items={items}
          suppliers={suppliers}
          weeklyInventory={weeklyInventory}
          onCancel={() => setPanel(null)}
          onSubmit={handlePoSubmit}
        />
      ) : null}

      <section aria-label="Order summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="In transit" provenance="database" value={String(inTransit.length)} sub="Not yet received" />
        <KpiCard
          label="Delayed"
          provenance="database"
          value={String(delayedCount)}
          valueTone={delayedCount > 0 ? "red" : "default"}
          sub="Past their expected date"
        />
        <KpiCard
          label="Arriving soon"
          provenance="database"
          value={String(arrivingThisWeek)}
          sub="Expected in the next 7 days"
        />
        <KpiCard
          label="Value in transit"
          provenance="database"
          value={MYR.format(valueInTransit)}
          sub="MYR, quantity times unit cost"
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <FilterChips label="Filter by status" chips={chips} value={filter} onChange={setFilter} />
          <div className="relative w-full md:max-w-xs">
            <Label htmlFor="order-search" className="sr-only">
              Search orders
            </Label>
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              id="order-search"
              placeholder="Search PO or supplier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9"
            />
          </div>
        </div>
        <PurchaseOrdersTable
          rows={visibleRows}
          emptyMessage={query ? `No orders match "${search.trim()}".` : EMPTY_MESSAGE[filter]}
          onMarkReceived={handleMarkReceived}
          onEdit={(r) => setPanel({ mode: "edit", id: r.po.po_id })}
          onDelete={(r) => setPanel({ mode: "delete", id: r.po.po_id })}
        />
        <p className="text-xs text-muted">
          Orders in transit count as incoming stock in every forecast. Mark received records the full
          quantity as arriving today; edit the order to record a partial delivery.
        </p>
      </section>
    </>
  );
}
