"use client";

import { DataTable } from "@/components/ui/DataTable";
import { FileText, ListChecks } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { RowActions } from "@/components/inventory/RowActions";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { createTableColumnHelper } from "@/lib/table/features";
import { formatShortDate } from "@/lib/data/dates";
import { getPurchaseOrderDisplayStatus, type PurchaseOrderDisplayStatus } from "@/lib/data/purchaseOrders";
import type { OrderRow } from "@/lib/data/inventory";
import type { PurchaseOrderCreator } from "@/lib/db/types";

export const STATUS_TONE: Record<PurchaseOrderDisplayStatus, TagTone> = {
  Draft: "dashed",
  "On the way": "blue",
  "Due today": "amber",
  Delayed: "red",
  Received: "green",
  Cancelled: "grey",
};

export const CREATOR_TONE: Record<PurchaseOrderCreator, TagTone> = {
  Manual: "grey",
  AiGIS: "green",
};

const MYR = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QTY = new Intl.NumberFormat("en-MY");

const ORDERS_PER_PAGE = 5;

const helper = createTableColumnHelper<OrderRow>();

export function PurchaseOrdersTable({
  rows,
  emptyMessage,
  onMarkReceived,
  onView,
  onGeneratePdf,
  onEdit,
  onDelete,
}: {
  rows: OrderRow[];
  emptyMessage: string;
  onMarkReceived: (row: OrderRow) => void;
  onView: (row: OrderRow) => void;
  onGeneratePdf: (row: OrderRow) => void;
  onEdit: (row: OrderRow) => void;
  onDelete: (row: OrderRow) => void;
}) {
  const columns = [
    helper.accessor((r) => r.po.po_id, {
      id: "po",
      header: "PO number",
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={`View PO-${row.original.po.po_id} line items`}
          onClick={() => onView(row.original)}
          className="rounded font-mono font-medium text-navy underline underline-offset-2 transition-colors duration-150 hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
        >
          PO-{row.original.po.po_id}
        </button>
      ),
    }),
    helper.accessor((r) => r.supplierName, { id: "supplier", header: "Supplier" }),
    helper.accessor((r) => r.qtyOrdered, {
      id: "qty",
      header: "Quantity",
      cell: ({ getValue }) => <span className="font-mono">{QTY.format(getValue())}</span>,
    }),
    helper.accessor((r) => r.totalValue, {
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
    helper.accessor((r) => r.po.created_by ?? "Manual", {
      id: "createdBy",
      header: "Created by",
      cell: ({ getValue }) => <Tag tone={CREATOR_TONE[getValue()]}>{getValue()}</Tag>,
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
              <IconButton
                variant="secondary"
                aria-label={`Mark ${label} received`}
                title="Mark received"
                onClick={() => onMarkReceived(row.original)}
              >
                <ListChecks size={20} aria-hidden="true" />
              </IconButton>
            ) : null}
            <IconButton
              aria-label={`Generate PDF for ${label}`}
              title="Generate PDF"
              onClick={() => onGeneratePdf(row.original)}
            >
              <FileText size={18} aria-hidden="true" />
            </IconButton>
            <RowActions
              label={label}
              onEdit={row.original.po.status === "Draft" ? () => onEdit(row.original) : undefined}
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
      pageSize={ORDERS_PER_PAGE}
    />
  );
}
