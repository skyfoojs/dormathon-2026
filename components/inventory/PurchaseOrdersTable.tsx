"use client";

import { DataTable } from "@/components/ui/DataTable";
import { RowActions } from "@/components/inventory/RowActions";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { createTableColumnHelper } from "@/lib/table/features";
import { formatShortDate } from "@/lib/data/dates";
import { getPurchaseOrderDisplayStatus, type PurchaseOrderDisplayStatus } from "@/lib/data/purchaseOrders";
import type { PurchaseOrderRow } from "@/lib/data/inventory";

const STATUS_TONE: Record<PurchaseOrderDisplayStatus, TagTone> = {
  Open: "blue",
  "Due today": "amber",
  Delayed: "red",
  Received: "green",
  Cancelled: "grey",
};

const helper = createTableColumnHelper<PurchaseOrderRow>();

export function PurchaseOrdersTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: PurchaseOrderRow[];
  // Leave both out for a read-only table with no actions column.
  onEdit?: (row: PurchaseOrderRow) => void;
  onDelete?: (row: PurchaseOrderRow) => void;
}) {
  const columns = [
    helper.accessor((r) => r.po.po_id, {
      id: "po",
      header: "PO number",
      cell: ({ row }) => <span className="font-mono">PO-{row.original.po.po_id}</span>,
    }),
    helper.accessor((r) => r.itemName, { id: "item", header: "Item" }),
    helper.accessor((r) => r.supplierName, { id: "supplier", header: "Supplier" }),
    helper.accessor((r) => r.po.qty_ordered, {
      id: "qty",
      header: "Quantity",
      cell: ({ row }) => <span className="font-mono">{row.original.po.qty_ordered}</span>,
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
          <div className="flex flex-col gap-1">
            <Tag tone={STATUS_TONE[label]}>{label}</Tag>
            {note ? <span className="text-xs text-muted">{note}</span> : null}
          </div>
        );
      },
    }),
    ...(onEdit && onDelete
      ? [
          helper.display({
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
              <RowActions
                label={`PO-${row.original.po.po_id}`}
                onEdit={() => onEdit(row.original)}
                onDelete={() => onDelete(row.original)}
              />
            ),
          }),
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.po.po_id)}
      emptyMessage="No purchase orders for this facility."
    />
  );
}
