"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { ProvenanceTag } from "@/components/ui/Tag";
import { PurchaseOrdersDialog } from "@/components/predictions/PurchaseOrdersDialog";
import { createTableColumnHelper } from "@/lib/table/features";
import type { SuggestedStockRow } from "@/lib/mock/predictionDetail";

type BlendedRow = SuggestedStockRow & { external: number; combined: number };

const helper = createTableColumnHelper<BlendedRow>();

const COLUMNS = [
  helper.accessor((r) => r.itemName, {
    id: "item",
    header: "Item",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-semibold">{row.original.itemName}</span>
        <span className="text-xs text-muted">{row.original.why}</span>
      </div>
    ),
  }),
  helper.accessor((r) => r.internal, {
    id: "internal",
    header: "Internal",
    cell: ({ row }) => <span className="font-mono">{row.original.internal.toLocaleString()}</span>,
  }),
  helper.accessor((r) => r.externalEffect, {
    id: "effect",
    header: "External effect",
    cell: ({ row }) => <span className="font-mono">+{Math.round(row.original.externalEffect * 100)}%</span>,
  }),
  helper.accessor((r) => r.external, {
    id: "external",
    header: "External",
    cell: ({ row }) => <span className="font-mono">{row.original.external.toLocaleString()}</span>,
  }),
  helper.accessor((r) => r.combined, {
    id: "combined",
    header: "Combined",
    cell: ({ row }) => <span className="font-mono font-semibold">{row.original.combined.toLocaleString()}</span>,
  }),
  helper.display({
    id: "orderBy",
    header: "Order by",
    cell: ({ row }) => <span className="font-mono">{row.original.orderByLabel}</span>,
  }),
];

export function SuggestedStockTable({ rows }: { rows: SuggestedStockRow[] }) {
  const [trust, setTrust] = React.useState(50);
  const [ordersOpen, setOrdersOpen] = React.useState(false);

  const blended = React.useMemo<BlendedRow[]>(
    () =>
      rows.map((r) => ({
        ...r,
        external: Math.round(r.internal * (1 + r.externalEffect)),
        combined: Math.round(r.internal * (1 + (r.externalEffect * trust) / 100)),
      })),
    [rows, trust],
  );

  return (
    <Card as="section" className="flex min-w-0 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex max-w-xl flex-col items-start gap-2.5">
          <CardTitle>Suggested stock for next month</CardTitle>
          <p className="text-sm text-strong-muted">
            Internal comes from your own issue history. External adds an assumed outside effect. Combined lets you
            choose how much to trust the external view.
          </p>
          <Button onClick={() => setOrdersOpen(true)}>Show purchase orders</Button>
        </div>
        <div className="flex w-full max-w-sm flex-col">
          <label htmlFor="trust-slider" className="flex justify-between text-sm font-semibold">
            <span>Trust in external signals</span>
            <span className="font-mono">{trust}%</span>
          </label>
          <input
            id="trust-slider"
            type="range"
            min={0}
            max={100}
            step={5}
            value={trust}
            onChange={(e) => setTrust(Number(e.target.value))}
            className="h-11 w-full accent-navy"
          />
        </div>
      </div>

      <DataTable columns={COLUMNS} data={blended} getRowId={(r) => r.itemName} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <ProvenanceTag kind="model-output" />
        <ProvenanceTag kind="scenario-assumption" />
        <span>
          Internal is 4.3 weeks of the mean weekly issue over the last 6 weeks. External effects are assumed
          percentages for the demo, not measured from [SOURCE]. Combined is internal times one plus the effect times
          your trust level.
        </span>
      </div>

      <PurchaseOrdersDialog open={ordersOpen} onOpenChange={setOrdersOpen} />
    </Card>
  );
}
