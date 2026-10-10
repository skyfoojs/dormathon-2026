"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Input";
import { ProvenanceTag, Tag, type TagTone } from "@/components/ui/Tag";
import { StockRunoutChart } from "@/components/predictions/StockRunoutChart";
import * as api from "@/lib/api/resources";
import type { AiForecastLine, AlgorithmicForecastLine, ItemStockProjection } from "@/lib/api/resources";
import { formatShortDate } from "@/lib/data/dates";
import { ErrorBanner } from "@/components/ui/Banner";

const LEGEND_ITEMS = [
  { label: "Actual stock", swatch: "border-t-2 border-green-text" },
  { label: "Algorithmic forecast", swatch: "border-t-2 border-dashed border-blue-light" },
  { label: "AI forecast", swatch: "border-t-2 border-dashed border-amber-border" },
  { label: "Restock trigger", swatch: "border-t-2 border-violet-text" },
];

const THRESHOLD_LABEL: Record<ItemStockProjection["thresholdSource"], string> = {
  reorder_level: "Reorder level (set)",
  reorder_point: "Reorder point",
};

type Status = { tone: TagTone; label: string; detail: string };

function getStatus(name: string, line: AlgorithmicForecastLine | AiForecastLine, unit: string): Status {
  const trigger = line.trigger;
  if (!trigger) {
    return {
      tone: "green",
      label: `${name}: no restock needed yet`,
      detail: "Projected stock stays above the restock trigger for the next 12 weeks.",
    };
  }
  if (trigger.alreadyReached) {
    return { tone: "red", label: `${name}: restock now`, detail: "Stock is already at or below the restock trigger." };
  }
  const days = trigger.daysFromLastActual;
  return {
    tone: "amber",
    label: `${name}: restock by ${formatShortDate(trigger.date)}`,
    detail: `${days} day${days === 1 ? "" : "s"} after the last count, once about ${Math.round(trigger.demandUntilTrigger).toLocaleString()} ${unit} more are used.`,
  };
}

function getStatuses(data: ItemStockProjection): Status[] {
  const statuses: Status[] = [];
  if (data.algorithmic) statuses.push(getStatus("Algorithmic", data.algorithmic, data.unit));
  if (data.ai) statuses.push(getStatus("AI", data.ai, data.unit));
  return statuses;
}

function formatQty(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined ? "None" : `${Math.round(value).toLocaleString()} ${unit}`;
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
  const statuses = data ? getStatuses(data) : [];
  const arrivals = data?.algorithmic?.arrivals ?? data?.ai?.arrivals ?? [];
  const incomingQty = arrivals.reduce((sum, a) => sum + a.qty, 0);
  const threshold = data?.algorithmic?.threshold ?? data?.ai?.threshold ?? null;

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
          <ErrorBanner>
            Could not load the projection: {(projectionQuery.error as Error).message}
          </ErrorBanner>
        ) : !data ? (
          <p className="text-sm text-muted">Loading projection{"…"}</p>
        ) : (
          <>
            {statuses.length === 0 ? (
              <p className="text-sm text-muted">No forecast yet. Showing actual stock only.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {statuses.map((status) => (
                  <li key={status.label} className="flex flex-wrap items-center gap-3">
                    <Tag tone={status.tone}>{status.label}</Tag>
                    <span className="text-sm text-strong-muted">{status.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            <StockRunoutChart data={data} />

            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Stat
                label="Last count"
                value={`${data.history[data.history.length - 1].stock.toLocaleString()} ${data.unit}`}
              />
              <Stat
                label="Algorithmic demand"
                value={data.algorithmic ? `${Math.round(data.algorithmic.weeklyForecastQty).toLocaleString()} / week` : "None"}
              />
              <Stat
                label={data.ai ? `AI demand (x${data.ai.usageMultiplier})` : "AI demand"}
                value={data.ai ? `${Math.round(data.ai.weeklyForecastQty).toLocaleString()} / week` : "None"}
              />
              <Stat
                label={THRESHOLD_LABEL[data.thresholdSource]}
                value={threshold === null ? "None" : Math.round(threshold).toLocaleString()}
              />
              <Stat label="Buy amount (algorithmic)" value={formatQty(data.algorithmic?.buyQty, data.unit)} />
              <Stat label="Buy amount (AI)" value={formatQty(data.ai?.buyQty, data.unit)} />
              <Stat label="Orders arriving" value={arrivals.length ? `${incomingQty.toLocaleString()} ${data.unit}` : "None"} />
            </dl>

            {data.ai?.reasoning ? (
              <p className="text-sm text-strong-muted">
                <span className="font-medium">AI reasoning: </span>
                {data.ai.reasoning}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <ProvenanceTag kind="database" />
              <ProvenanceTag kind="model-output" />
              <span>
                Algorithmic forecast: daily Holt and weighted-average usage, with a fading trend. AI forecast: the
                algorithmic usage scaled by the AI council&apos;s multiplier from the latest news. Both rise when an order
                in transit reaches its expected date. Actual stock is the daily closing count. The restock trigger is the
                item&apos;s reorder level if set, otherwise the reorder point (usage over the supplier lead time plus
                safety stock).
              </span>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
