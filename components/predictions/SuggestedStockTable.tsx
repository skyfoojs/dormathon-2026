"use client";

import * as React from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Input";
import { ProvenanceTag } from "@/components/ui/Tag";
import type { SuggestedStockRow } from "@/lib/mock/predictionDetail";

export function SuggestedStockTable({ rows }: { rows: SuggestedStockRow[] }) {
  const [trust, setTrust] = React.useState(60);
  const trustFraction = trust / 100;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardHeader>
        <CardTitle>Suggested stock for next month</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="trust-slider">Trust in external signals: {trust}%</Label>
          <input
            id="trust-slider"
            type="range"
            min={0}
            max={100}
            value={trust}
            onChange={(e) => setTrust(Number(e.target.value))}
            className="h-11 w-full max-w-sm accent-navy"
          />
        </div>

        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-page">
                {["Item", "Internal", "External effect", "External", "Combined", "Order by"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3 py-2.5 text-left font-mono text-xs font-medium tracking-wide text-muted uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const external = Math.round(r.internal * (1 + r.externalEffect));
                const combined = Math.round(r.internal * (1 + r.externalEffect * trustFraction));
                return (
                  <tr key={r.itemId} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5">{r.itemName}</td>
                    <td className="px-3 py-2.5 font-mono">{r.internal}</td>
                    <td className="px-3 py-2.5 font-mono">
                      {r.externalEffect > 0 ? `+${Math.round(r.externalEffect * 100)}%` : "0%"}
                    </td>
                    <td className="px-3 py-2.5 font-mono">{external}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold">{combined}</td>
                    <td className="px-3 py-2.5">{r.orderByLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <ProvenanceTag kind="model-output" />
          <ProvenanceTag kind="scenario-assumption" />
          <span>
            Internal is the model&apos;s own forecast. External effects are scenario
            assumptions until measured from a real source. Combined blends
            them at the trust level set above.
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
