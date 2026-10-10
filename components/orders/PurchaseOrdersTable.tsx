"use client";

import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { RowActions } from "@/components/inventory/RowActions";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { createTableColumnHelper } from "@/lib/table/features";
import { formatShortDate } from "@/lib/data/dates";
import { getPurchaseOrderDisplayStatus, type PurchaseOrderDisplayStatus } from "@/lib/data/purchaseOrders";
import type { PurchaseOrderRow } from "@/lib/data/inventory";

const STATUS_TONE: Record<PurchaseOrderDisplayStatus, TagTone> = {
  "On the way": "blue",
  "Due today": "amber",
  Delayed: "red",
  Received: "green",
  Cancelled: "grey",
};

const MYR = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QTY = new Intl.NumberFormat("en-MY");

const helper = createTableColumnHelper<PurchaseOrderRow>();

export function PurchaseOrdersTable({
  rows,
  emptyMessage,
  onMarkReceived,
  onEdit,
  onDelete,
}: {
  rows: PurchaseOrderRow[];
  emptyMessage: string;
  onMarkReceived: (row: PurchaseOrderRow) => void;
  onEdit: (row: PurchaseOrderRow) => void;
  onDelete: (row: PurchaseOrderRow) => void;
}) {
  const columns = [
    helper.accessor((r) => r.po.po_id, {
      id: "po",
      header: "PO number",
      cell: ({ row }) => <span className="font-mono">PO-{row.original.po.po_id}</span>,
    }),
    helper.accessor((r) => r.supplierName, { id: "supplier", header: "Supplier" }),
    helper.accessor((r) => r.po.qty_ordered, {
      id: "qty",
      header: "Quantity",
      cell: ({ row }) => <span className="font-mono">{QTY.format(row.original.po.qty_ordered)}</span>,
    }),
    helper.accessor((r) => r.po.qty_ordered * r.po.unit_cost_myr, {
      id: "total",
      header: "Total (MYR)",
      cell: ({ getValue }) => <span className="font-mono">{MYR.format(getValue())}</span>,
    }),
    helper.accessor((r) => r.po.order_date, {
      id: "ordered",
      header: "Ordered",
      cell: ({ row }) => formatShortDate(row.original.po.order_date),
    }),
    helper.accessor((r) => r.po.expected_receipt_date, {
      id: "due",
      header: "Expected",
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
    helper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const label = `PO-${row.original.po.po_id}`;
        return (
          <div className="flex items-center gap-2">
            {row.original.po.status === "In transit" ? (
              <Button aria-label={`Mark ${label} received`} onClick={() => onMarkReceived(row.original)}>
                Mark received
              </Button>
            ) : null}
            <RowActions
              label={label}
              onEdit={() => onEdit(row.original)}
              onDelete={() => onDelete(row.original)}
            />
          </div>
        );
      },
    }),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.po.po_id)}
      emptyMessage={emptyMessage}
    />
  );
}
