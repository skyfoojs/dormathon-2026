"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Input";
import { ProvenanceTag, Tag, type TagTone } from "@/components/ui/Tag";
import { StockRunoutChart } from "@/components/predictions/StockRunoutChart";
import * as api from "@/lib/api/resources";
import type { ItemStockProjection } from "@/lib/api/resources";
import { formatShortDate } from "@/lib/data/dates";
import { RESTOCK_TRIGGER_SHARE } from "@/lib/forecast/runout";

const LEGEND_ITEMS = [
  { label: "Actual stock", swatch: "border-t-2 border-green-text" },
  { label: "Projected stock", swatch: "border-t-2 border-dashed border-blue-light" },
  { label: "Restock trigger", swatch: "border-t-2 border-violet-text" },
];

const TRIGGER_PERCENT = Math.round(RESTOCK_TRIGGER_SHARE * 100);

function getStatus(data: ItemStockProjection): { tone: TagTone; label: string; detail: string } {
  const trigger = data.trigger;
  if (!trigger) {
    return {
      tone: "green",
      label: "No restock needed yet",
      detail: `Projected stock stays above ${TRIGGER_PERCENT}% of supply for the next 12 weeks.`,
    };
  }
  if (trigger.alreadyReached) {
    return {
      tone: "red",
      label: "Restock now",
      detail: `Stock is already at or below ${TRIGGER_PERCENT}% of supply.`,
    };
  }
  const days = trigger.daysFromLastActual;
  return {
    tone: "amber",
    label: `Restock by ${formatShortDate(trigger.date)}`,
    detail: `${days} day${days === 1 ? "" : "s"} after the last count, once about ${Math.round(trigger.demandUntilTrigger).toLocaleString()} ${data.unit} more are used.`,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-mono text-lg font-medium">{value}</dd>
    </div>
  );
}

export function StockRunoutCard() {
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const items = [...(itemsQuery.data ?? [])].sort((a, b) => a.item_id - b.item_id);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const itemId = selectedId ?? items[0]?.item_id ?? null;

  const projectionQuery = useQuery({
    queryKey: ["stock-projection", itemId],
    queryFn: () => api.getStockProjection(itemId as number),
    enabled: itemId !== null,
  });
  const data = projectionQuery.data;
  const status = data ? getStatus(data) : null;
  const incomingQty = data ? data.arrivals.reduce((sum, a) => sum + a.qty, 0) : 0;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardHeader>
        <CardTitle>Stock run-down</CardTitle>
        <div className="flex flex-wrap items-center gap-4 text-xs text-strong-muted">
          {LEGEND_ITEMS.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-5 ${l.swatch}`} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardBody className="gap-4">
        <div className="flex w-full max-w-sm flex-col gap-1.5">
          <Label htmlFor="runout-item">Item</Label>
          <Select
            id="runout-item"
            value={itemId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            disabled={items.length === 0}
          >
            {items.map((i) => (
              <option key={i.item_id} value={i.item_id}>
                {i.item_name}
              </option>
            ))}
          </Select>
        </div>

        {projectionQuery.error ? (
          <div className="rounded-md border border-red bg-red/5 p-4 text-sm text-red-dark">
            Could not load the projection: {(projectionQuery.error as Error).message}
          </div>
        ) : !data || !status ? (
          <p className="text-sm text-muted">Loading projection{"…"}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Tag tone={status.tone}>{status.label}</Tag>
              <span className="text-sm text-strong-muted">{status.detail}</span>
            </div>

            <StockRunoutChart data={data} />

            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat
                label="Last count"
                value={`${data.history[data.history.length - 1].stock.toLocaleString()} ${data.unit}`}
              />
              <Stat label="Forecast demand" value={`${Math.round(data.weeklyForecastQty).toLocaleString()} / week`} />
              <Stat
                label={`Trigger (${TRIGGER_PERCENT}% of ${data.supplyLevel.toLocaleString()})`}
                value={Math.round(data.threshold).toLocaleString()}
              />
              <Stat
                label="Orders arriving"
                value={data.arrivals.length ? `${incomingQty.toLocaleString()} ${data.unit}` : "None"}
              />
            </dl>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <ProvenanceTag kind="database" />
              <ProvenanceTag kind="model-output" />
              <span>
                Projected stock falls by the Holt and weighted-average demand forecast, held flat, and rises when an
                order in transit reaches its expected date. Actual stock is the daily closing count. Supply is the highest
                daily stock in the last 12 weeks.
              </span>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
