"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import { PurchaseOrderDetails } from "@/components/orders/PurchaseOrderDetails";
import { STATUS_TONE } from "@/components/orders/PurchaseOrdersTable";
import { formatShortDate } from "@/lib/data/dates";
import { getPurchaseOrderDisplayStatus } from "@/lib/data/purchaseOrders";
import type { OrderRow } from "@/lib/data/inventory";

const MAX_ROWS = 5;
const MYR = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const HEADER_CELL = "px-2 py-1 text-left font-mono text-xs font-medium tracking-wide text-muted uppercase";

// Purchase orders that AiGIS raised on its own (created_by = "AiGIS"),
// newest first. Each can be opened to see its line items.
export function AutomatedOrdersCard({ orders }: { orders: OrderRow[] }) {
  const [viewedId, setViewedId] = React.useState<number | null>(null);

  const automated = orders
    .filter((o) => o.po.created_by === "AiGIS")
    .sort((a, b) => b.po.order_date.localeCompare(a.po.order_date) || b.po.po_id - a.po.po_id);
  const shown = automated.slice(0, MAX_ROWS);
  const viewed = viewedId === null ? undefined : automated.find((o) => o.po.po_id === viewedId);

  return (
    <Card className="flex h-full flex-col gap-3 border-t-4 border-t-green-border px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CardTitle>AiGIS automated POs</CardTitle>
          <span className="rounded-full bg-green-tint px-2 py-0.5 font-mono text-xs font-semibold text-green-text">
            {automated.length}
          </span>
        </div>
        <Link href="/orders" className="text-sm font-semibold text-navy">
          View all orders
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">AiGIS has not raised any purchase orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={HEADER_CELL}>
                  PO number
                </th>
                <th scope="col" className={HEADER_CELL}>
                  Supplier
                </th>
                <th scope="col" className={HEADER_CELL}>
                  Ordered
                </th>
                <th scope="col" className={HEADER_CELL}>
                  Total (MYR)
                </th>
                <th scope="col" className={HEADER_CELL}>
                  Status
                </th>
                <th scope="col" className={HEADER_CELL}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((order) => {
                const label = `PO-${order.po.po_id}`;
                const status = getPurchaseOrderDisplayStatus(order.po).label;
                return (
                  <tr key={order.po.po_id} className="border-b border-line last:border-0">
                    <td className="px-2 py-1.5 align-middle font-mono font-semibold">{label}</td>
                    <td className="px-2 py-1.5 align-middle">{order.supplierName}</td>
                    <td className="px-2 py-1.5 align-middle font-mono">{formatShortDate(order.po.order_date)}</td>
                    <td className="px-2 py-1.5 align-middle font-mono">{MYR.format(order.totalValue)}</td>
                    <td className="px-2 py-1.5 align-middle">
                      <Tag tone={STATUS_TONE[status]}>{status}</Tag>
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <div className="flex items-center justify-end">
                        <Button aria-label={`View details of ${label}`} onClick={() => setViewedId(order.po.po_id)}>
                          View details
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {automated.length > shown.length ? (
        <span className="text-xs text-muted">
          Showing the newest {shown.length} of {automated.length}.
        </span>
      ) : null}

      <Modal
        open={viewed !== undefined}
        onOpenChange={(open) => !open && setViewedId(null)}
        title={viewed ? `PO-${viewed.po.po_id}` : "Purchase order"}
        size="lg"
      >
        {viewed ? <PurchaseOrderDetails order={viewed} /> : null}
      </Modal>
    </Card>
  );
}
