"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Input, Label } from "@/components/ui/Input";
import { FilterChips } from "@/components/ui/FilterChips";
import { SavedBanner, ConfirmDeleteBanner, ErrorBanner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { PurchaseOrderDetails } from "@/components/orders/PurchaseOrderDetails";
import { PurchaseOrdersTable } from "@/components/orders/PurchaseOrdersTable";
import { useFacility } from "@/components/providers/FacilityProvider";
import { getPurchaseOrderRows, groupOrderRows, type OrderRow } from "@/lib/data/inventory";
import { isPurchaseOrderDelayed } from "@/lib/data/purchaseOrders";
import { TODAY_ISO } from "@/lib/db/seed";
import * as api from "@/lib/api/resources";
import type { PurchaseOrderCreator, PurchaseOrderStatus } from "@/lib/db/types";

type Filter = PurchaseOrderStatus | "all";
type CreatorFilter = PurchaseOrderCreator | "all";

type Panel =
  | { mode: "view"; id: number }
  | { mode: "delete"; id: number };

const CREATOR_FILTER_LABELS: { id: CreatorFilter; label: string }[] = [
  { id: "AiGIS", label: "AiGIS" },
  { id: "Manual", label: "Manual" },
  { id: "all", label: "All" },
];

const FILTER_LABELS: { id: Filter; label: string }[] = [
  { id: "Pending", label: "Pending" },
  { id: "In transit", label: "In transit" },
  { id: "Delivered", label: "Delivered" },
  { id: "Cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

const EMPTY_MESSAGE: Record<Filter, string> = {
  Pending: "No orders are waiting on a supplier.",
  "In transit": "Nothing in transit. Every order has arrived or been cancelled.",
  Delivered: "No delivered orders yet.",
  Cancelled: "No cancelled orders.",
  all: "No purchase orders for this facility.",
};

const MYR = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QTY = new Intl.NumberFormat("en-MY");

export default function OrdersView() {
  const { facilityId } = useFacility();
  if (facilityId === null) return null;
  return <OrdersViewContent facilityId={facilityId} />;
}

function OrdersViewContent({ facilityId }: { facilityId: number }) {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<Filter>("Pending");
  const [creatorFilter, setCreatorFilter] = React.useState<CreatorFilter>("AiGIS");
  const [search, setSearch] = React.useState("");
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [showSaved, setShowSaved] = React.useState(false);

  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: api.getSuppliers });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId),
  });

  const items = itemsQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const purchaseOrders = poQuery.data ?? [];

  function saved() {
    setPanel(null);
    setShowSaved(true);
  }

  const invalidatePOs = () => qc.invalidateQueries({ queryKey: ["purchase-orders", facilityId] });

  const saveOrderMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: api.PurchaseOrderDocumentInput }) =>
      api.savePurchaseOrderDocument(id, input),
    onSuccess: () => {
      invalidatePOs();
      saved();
    },
  });
  // Deleting an order deletes every line on it.
  const deleteOrderMutation = useMutation({
    mutationFn: (lineIds: number[]) => Promise.all(lineIds.map((id) => api.deletePurchaseOrder(id))),
    onSettled: invalidatePOs,
  });

  // Counts are per order; units and value are summed over every line.
  const allRows = groupOrderRows(getPurchaseOrderRows(facilityId, purchaseOrders, items, suppliers));
  const inTransit = allRows.filter((r) => r.po.status === "In transit");
  const delayedCount = inTransit.filter((r) => isPurchaseOrderDelayed(r.po)).length;
  const delivered = allRows.filter((r) => r.po.status === "Delivered");
  const aigisGenerated = allRows.filter((r) => r.po.created_by === "AiGIS").length;
  const deliveredLines = purchaseOrders.filter((po) => po.status === "Delivered");
  const itemsDelivered = deliveredLines.reduce((sum, po) => sum + (po.qty_received ?? 0), 0);
  const valueDelivered = deliveredLines.reduce((sum, po) => sum + (po.qty_received ?? 0) * po.unit_cost_myr, 0);

  // An order with no created_by value counts as Manual.
  const matchesCreator = (r: OrderRow, id: CreatorFilter) => id === "all" || (r.po.created_by ?? "Manual") === id;
  const matchesStatus = (r: OrderRow, id: Filter) => id === "all" || r.po.status === id;

  // Each group's counts respect the other group's selection, so a chip's
  // number is what choosing it would show.
  const creatorChips = CREATOR_FILTER_LABELS.map((f) => ({
    ...f,
    count: allRows.filter((r) => matchesCreator(r, f.id) && matchesStatus(r, filter)).length,
  }));
  const chips = FILTER_LABELS.map((f) => ({
    ...f,
    count: allRows.filter((r) => matchesStatus(r, f.id) && matchesCreator(r, creatorFilter)).length,
  }));

  const query = search.trim().toLowerCase();
  const visibleRows = allRows
    .filter((r) => matchesStatus(r, filter) && matchesCreator(r, creatorFilter))
    .filter((r) => !query || `po-${r.po.po_id} ${r.supplierName}`.toLowerCase().includes(query));
  // In transit: soonest expected first, so delayed orders lead. Other views
  // keep getPurchaseOrderRows' newest-ordered-first order.
  if (filter === "In transit") {
    visibleRows.sort((a, b) => a.po.expected_receipt_date.localeCompare(b.po.expected_receipt_date));
  }

  // Marks every line on the order received in full, today.
  function handleMarkReceived(order: OrderRow) {
    saveOrderMutation.mutate({
      id: order.po.po_id,
      input: {
        supplier_id: order.po.supplier_id,
        order_date: order.po.order_date,
        expected_receipt_date: order.po.expected_receipt_date,
        status: "Delivered",
        actual_receipt_date: TODAY_ISO,
        lines: order.lines.map(({ po }) => ({
          po_id: po.po_id,
          item_id: po.item_id,
          qty_ordered: po.qty_ordered,
          unit_cost_myr: po.unit_cost_myr,
          qty_received: po.qty_ordered,
        })),
      },
    });
  }

  function handleDeleteConfirm() {
    if (panel?.mode !== "delete") return;
    const order = allRows.find((r) => r.po.po_id === panel.id);
    if (order) deleteOrderMutation.mutate(order.lines.map((l) => l.po.po_id));
    setPanel(null);
  }

  const selectedOrder = panel ? allRows.find((r) => r.po.po_id === panel.id) : undefined;

  const loadError =
    itemsQuery.error ||
    suppliersQuery.error ||
    poQuery.error ||
    saveOrderMutation.error ||
    deleteOrderMutation.error;

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${inTransit.length} purchase orders in transit, ${delayedCount} past their expected date.`}
      />

      {loadError ? (
        <ErrorBanner>
          Could not load data from the database: {(loadError as Error).message}
        </ErrorBanner>
      ) : null}

      {showSaved ? <SavedBanner onDismiss={() => setShowSaved(false)} /> : null}

      {panel?.mode === "delete" ? (
        <ConfirmDeleteBanner
          label={`PO-${panel.id}`}
          onCancel={() => setPanel(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      <Modal
        open={panel?.mode === "view" && selectedOrder !== undefined}
        onOpenChange={(open) => !open && setPanel(null)}
        title={panel ? `PO-${panel.id}` : "Purchase order"}
        size="lg"
      >
        {panel?.mode === "view" && selectedOrder ? <PurchaseOrderDetails order={selectedOrder} /> : null}
      </Modal>

      <section aria-label="Order summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="AiGIS generated"
          labelTone="green"
          value={QTY.format(aigisGenerated)}
          sub={`Of ${QTY.format(allRows.length)} orders in total`}
        />
        <KpiCard
          label="Orders completed"
          value={QTY.format(delivered.length)}
          sub="Marked as delivered"
        />
        <KpiCard
          label="Items delivered"
          value={QTY.format(itemsDelivered)}
          sub="Units received across completed orders"
        />
        <KpiCard
          label="Value delivered"
          value={MYR.format(valueDelivered)}
          sub="MYR, units received times unit cost"
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <FilterChips
              label="Filter by who created the order"
              chips={creatorChips}
              value={creatorFilter}
              onChange={setCreatorFilter}
            />
            <FilterChips label="Filter by status" chips={chips} value={filter} onChange={setFilter} />
          </div>
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
          key={`${creatorFilter}:${filter}:${query}`}
          rows={visibleRows}
          emptyMessage={
            query
              ? `No orders match "${search.trim()}".`
              : creatorFilter === "AiGIS"
                ? "No AiGIS-generated orders in this view."
                : EMPTY_MESSAGE[filter]
          }
          onMarkReceived={handleMarkReceived}
          onView={(r) => setPanel({ mode: "view", id: r.po.po_id })}
          onDelete={(r) => setPanel({ mode: "delete", id: r.po.po_id })}
        />
        <p className="text-xs text-muted">
          Pending orders are waiting for the supplier to review them and can only be viewed. Orders in transit
          count as incoming stock in every forecast, and Mark received records every line as arriving in full
          today.
        </p>
      </section>
    </>
  );
}
