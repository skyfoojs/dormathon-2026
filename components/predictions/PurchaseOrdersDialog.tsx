"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { ProvenanceTag } from "@/components/ui/Tag";
import { DataTable } from "@/components/ui/DataTable";
import { Tag } from "@/components/ui/Tag";
import { STATUS_TONE } from "@/components/orders/PurchaseOrdersTable";
import { useFacility } from "@/components/providers/FacilityProvider";
import * as api from "@/lib/api/resources";
import { formatShortDate } from "@/lib/data/dates";
import { getPurchaseOrderRows, type PurchaseOrderRow } from "@/lib/data/inventory";
import { getPurchaseOrderDisplayStatus } from "@/lib/data/purchaseOrders";
import { createTableColumnHelper } from "@/lib/table/features";

const ROWS_PER_PAGE = 8;

const helper = createTableColumnHelper<PurchaseOrderRow>();

// Read-only: one row per order line. Editing lives on the Orders page.
const COLUMNS = [
  helper.accessor((r) => r.po.po_id, {
    id: "po",
    header: "PO number",
    cell: ({ row }) => <span className="font-mono font-medium">PO-{row.original.po.po_id}</span>,
  }),
  helper.accessor((r) => r.itemName, {
    id: "item",
    header: "Item",
    cell: ({ row }) => <span className="font-semibold">{row.original.itemName}</span>,
  }),
  helper.accessor((r) => r.supplierName, { id: "supplier", header: "Supplier" }),
  helper.accessor((r) => r.po.qty_ordered, {
    id: "qty",
    header: "Quantity",
    cell: ({ row }) => <span className="font-mono">{row.original.po.qty_ordered.toLocaleString()}</span>,
  }),
  helper.accessor((r) => r.po.order_date, {
    id: "ordered",
    header: "Ordered",
    cell: ({ row }) => formatShortDate(row.original.po.order_date),
  }),
  helper.accessor((r) => r.po.expected_receipt_date, {
    id: "due",
    header: "Due",
    cell: ({ row }) => formatShortDate(row.original.po.expected_receipt_date),
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const { label, note } = getPurchaseOrderDisplayStatus(row.original.po);
      return (
        <div className="flex flex-col items-start gap-1">
          <Tag tone={STATUS_TONE[label]}>{label}</Tag>
          {note ? <span className="text-xs text-muted">{note}</span> : null}
        </div>
      );
    },
  }),
];

export function PurchaseOrdersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { facilityId } = useFacility();
  const enabled = open && facilityId !== null;

  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems, enabled });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: api.getSuppliers, enabled });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId as number),
    enabled,
  });

  const error = poQuery.error ?? itemsQuery.error ?? suppliersQuery.error;
  const loading = poQuery.isPending || itemsQuery.isPending || suppliersQuery.isPending;
  const rows =
    facilityId === null
      ? []
      : getPurchaseOrderRows(
          facilityId,
          (poQuery.data ?? []).filter((po) => po.status === "In transit"),
          itemsQuery.data ?? [],
          suppliersQuery.data ?? [],
        );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        <>
          Open purchase orders{" "}
          {loading || error ? null : <span className="font-mono text-sm font-normal text-muted">{rows.length}</span>}
        </>
      }
    >
      {error ? (
        <div className="rounded-md border border-red bg-red/5 p-4 text-sm text-red-dark">
          Could not load purchase orders: {(error as Error).message}
        </div>
      ) : loading ? (
        <p className="text-sm text-muted">Loading purchase orders{"…"}</p>
      ) : (
        <DataTable
          columns={COLUMNS}
          data={rows}
          getRowId={(r) => String(r.po.po_id)}
          emptyMessage="No purchase orders in transit."
          pageSize={ROWS_PER_PAGE}
        />
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <ProvenanceTag kind="database" />
        <span>Orders still in transit for this facility. Status is read against today.</span>
      </div>
    </Modal>
  );
}
