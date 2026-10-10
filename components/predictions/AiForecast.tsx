"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { UpdatingFade } from "@/components/ui/UpdatingFade";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorBanner, InfoBanner } from "@/components/ui/Banner";
import { ProvenanceTag, Tag } from "@/components/ui/Tag";
import { StatTile } from "@/components/ui/StatTile";
import { CouncilGraph } from "@/components/predictions/CouncilGraph";
import { CouncilNodePanel } from "@/components/predictions/CouncilNodePanel";
import { ItemSelect } from "@/components/predictions/ItemSelect";
import { RestockStatus } from "@/components/predictions/RestockStatus";
import { StockChart } from "@/components/predictions/StockChart";
import { actualSeries, aiSeries, formatQty, thresholdLine, triggerMarker } from "@/components/predictions/forecastSeries";
import * as api from "@/lib/api/resources";
import type { AiForecastLine, ItemStockProjection, RunCouncil } from "@/lib/api/resources";
import { formatDateTime } from "@/lib/data/dates";

function CouncilCard({
  council,
  itemId,
  onItemChange,
}: {
  council: RunCouncil;
  itemId: number | null;
  onItemChange: (id: number) => void;
}) {
  const [nodeId, setNodeId] = React.useState<string | null>(null);
  const select = React.useCallback((id: string) => setNodeId((current) => (current === id ? null : id)), []);
  return (
    <Card as="section" className="flex min-w-0 flex-col gap-4 p-6">
      <CardHeader>
        <CardTitle>Council run {"·"} {formatDateTime(council.run.started_at)}</CardTitle>
        <Tag tone="grey">Click a step to see what it did</Tag>
      </CardHeader>
      {council.reused ? (
        <InfoBanner>No new news in this run, so the last council verdict was reused. Showing that council run.</InfoBanner>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row">
        <CouncilGraph council={council} selectedId={nodeId} onSelect={select} />
        {nodeId ? (
          <CouncilNodePanel
            key={nodeId}
            council={council}
            nodeId={nodeId}
            itemId={itemId}
            onItemChange={onItemChange}
            onClose={() => setNodeId(null)}
          />
        ) : null}
      </div>
    </Card>
  );
}

function AiChart({ data, line }: { data: ItemStockProjection; line: AiForecastLine }) {
  const series = React.useMemo(() => [actualSeries(data), aiSeries(line.projection)], [data, line]);
  return (
    <StockChart
      series={series}
      thresholds={[thresholdLine(data, line.threshold)]}
      markers={triggerMarker(line.projection, line.trigger, line.threshold, "var(--color-amber-border)")}
      summary={`Stock for ${data.itemName} with the AI forecast at ×${line.usageMultiplier} of the algorithmic usage.`}
    />
  );
}

function AiStats({ data, line }: { data: ItemStockProjection; line: AiForecastLine }) {
  const last = data.history[data.history.length - 1];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Last count" value={`${last.stock.toLocaleString()} ${data.unit}`} />
      <StatTile label="AI usage, per day" value={line.usagePerDay.toFixed(1)} />
      <StatTile label="Multiplier" value={`×${line.usageMultiplier}`} />
      <StatTile label="Fades over" value={line.fadeDays === null ? "Lasts" : `${line.fadeDays} days`} />
      <StatTile label="Confidence" value={line.confidence === null ? "—" : `${Math.round(line.confidence * 100)}%`} />
      <StatTile label="Restock trigger" value={Math.round(line.threshold).toLocaleString()} />
      <StatTile label="Buy amount" value={formatQty(line.buyQty, data.unit)} />
      <StatTile label="Stock runs out" value={line.stockoutDate ?? "Not in 12 weeks"} />
    </div>
  );
}

function AiRunoutCard({
  runId,
  items,
  itemId,
  onItemChange,
}: {
  runId: number;
  items: { id: number; name: string }[];
  itemId: number | null;
  onItemChange: (id: number) => void;
}) {
  const projectionQuery = useQuery({
    queryKey: ["stock-projection", itemId, runId],
    queryFn: () => api.getStockProjection(itemId as number, runId),
    enabled: itemId !== null,
    placeholderData: keepPreviousData,
  });
  const data = projectionQuery.data;
  const updating = projectionQuery.isPlaceholderData;
  const line = data?.ai ?? null;

  return (
    <Card as="section" className="flex min-w-0 flex-col gap-4 p-6">
      <CardHeader>
        <CardTitle>AI stock run-down</CardTitle>
        <div className="flex flex-wrap gap-2">
          <ProvenanceTag kind="database" />
          <ProvenanceTag kind="model-output" />
        </div>
      </CardHeader>
      <ItemSelect id="ai-item" items={items} value={itemId} onChange={onItemChange} updating={updating} />
      {projectionQuery.error ? (
        <ErrorBanner>Could not load the AI forecast: {(projectionQuery.error as Error).message}</ErrorBanner>
      ) : !data ? (
        <p role="status" className="text-sm text-muted">
          Loading forecast{"…"}
        </p>
      ) : !line ? (
        <p className="text-sm text-muted">No AI forecast for this item in this run.</p>
      ) : (
        <UpdatingFade updating={updating} className="flex flex-col gap-4">
          <RestockStatus lines={[{ name: "AI", trigger: line.trigger }]} unit={data.unit} />
          <AiChart data={data} line={line} />
          <AiStats data={data} line={line} />
          {line.reasoning ? (
            <p className="text-sm text-strong-muted">
              <span className="font-medium">Chairman reasoning: </span>
              {line.reasoning}
            </p>
          ) : null}
          <p className="text-xs text-muted">
            The AI forecast is the algorithmic usage scaled by the council&apos;s multiplier, fading back to ×1 over the
            fade days. Orders in transit are added on their expected date.
          </p>
        </UpdatingFade>
      )}
    </Card>
  );
}

export function AiForecast({
  council,
  items,
  itemId,
  onItemChange,
}: {
  council: RunCouncil;
  items: { id: number; name: string }[];
  itemId: number | null;
  onItemChange: (id: number) => void;
}) {
  return (
    <>
      <CouncilCard key={council.run.sync_run_id} council={council} itemId={itemId} onItemChange={onItemChange} />
      {council.aiForecast.length > 0 ? (
        <AiRunoutCard runId={council.run.sync_run_id} items={items} itemId={itemId} onItemChange={onItemChange} />
      ) : null}
    </>
  );
}
