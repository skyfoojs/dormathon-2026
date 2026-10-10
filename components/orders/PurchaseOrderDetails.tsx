"use client";

import { DataTable } from "@/components/ui/DataTable";
import { Tag } from "@/components/ui/Tag";
import { CREATOR_TONE, STATUS_TONE } from "@/components/orders/PurchaseOrdersTable";
import { createTableColumnHelper } from "@/lib/table/features";
import { formatShortDate } from "@/lib/data/dates";
import { getPurchaseOrderDisplayStatus } from "@/lib/data/purchaseOrders";
import type { OrderRow, PurchaseOrderRow } from "@/lib/data/inventory";

const MYR = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QTY = new Intl.NumberFormat("en-MY");

const LINE_ITEMS_PER_PAGE = 5;

const helper = createTableColumnHelper<PurchaseOrderRow>();

const LINE_ITEM_COLUMNS = [
  helper.accessor((r) => r.itemName, {
    id: "item",
    header: "Item",
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  helper.accessor((r) => r.po.qty_ordered, {
    id: "ordered",
    header: "Ordered",
    cell: ({ getValue }) => <span className="font-mono">{QTY.format(getValue())}</span>,
  }),
  helper.accessor((r) => r.po.qty_received, {
    id: "received",
    header: "Received",
    cell: ({ getValue }) => {
      const received = getValue();
      return <span className="font-mono">{received === null ? "—" : QTY.format(received)}</span>;
    },
  }),
  helper.accessor((r) => r.po.unit_cost_myr, {
    id: "unitCost",
    header: "Unit cost (MYR)",
    cell: ({ getValue }) => <span className="font-mono">{MYR.format(getValue())}</span>,
  }),
  helper.accessor((r) => r.po.qty_ordered * r.po.unit_cost_myr, {
    id: "lineTotal",
    header: "Line total (MYR)",
    cell: ({ getValue }) => <span className="font-mono">{MYR.format(getValue())}</span>,
  }),
];

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <dt className="font-mono text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function PurchaseOrderDetails({ order }: { order: OrderRow }) {
  const row = order;
  const lineItems = order.lines;
  const { label, note } = getPurchaseOrderDisplayStatus(row.po);
  const creator = row.po.created_by ?? "Manual";
  const total = order.totalValue;

  return (
    <>
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Detail label="Supplier">{row.supplierName}</Detail>
        <Detail label="Ordered">{formatShortDate(row.po.order_date)}</Detail>
        <Detail label="Expected">{formatShortDate(row.po.expected_receipt_date)}</Detail>
        <Detail label="Status">
          <Tag tone={STATUS_TONE[label]}>{label}</Tag>
          {note ? <span className="text-xs text-muted">{note}</span> : null}
        </Detail>
        <Detail label="Created by">
          <Tag tone={CREATOR_TONE[creator]}>{creator}</Tag>
        </Detail>
        <Detail label="Order total">
          <span className="font-mono font-semibold">MYR {MYR.format(total)}</span>
        </Detail>
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">
          Line items <span className="font-mono text-sm font-normal text-muted">{lineItems.length}</span>
        </h3>
        <DataTable
          columns={LINE_ITEM_COLUMNS}
          data={lineItems}
          getRowId={(r) => String(r.po.po_id)}
          emptyMessage="No line items on this order."
          pageSize={LINE_ITEMS_PER_PAGE}
        />
      </section>
    </>
  );
}
