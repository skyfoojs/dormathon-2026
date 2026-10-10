"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { UpdatingFade } from "@/components/ui/UpdatingFade";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/Banner";
import { ProvenanceTag, Tag } from "@/components/ui/Tag";
import { StatTile } from "@/components/ui/StatTile";
import { StepList } from "@/components/ui/StepList";
import { ItemSelect } from "@/components/predictions/ItemSelect";
import { RestockStatus } from "@/components/predictions/RestockStatus";
import { StockChart } from "@/components/predictions/StockChart";
import {
  actualSeries,
  arrivalMarkers,
  averageSeries,
  holtSeries,
  thresholdLine,
  triggerMarker,
  wmaSeries,
} from "@/components/predictions/forecastSeries";
import * as api from "@/lib/api/resources";
import type { AlgorithmicForecastLine, ItemStockProjection } from "@/lib/api/resources";
import { formatDateTime } from "@/lib/data/dates";

const STEPS = [
  {
    title: "Read the daily usage",
    text: "Units issued plus unmet demand per day, from the daily stock counts, with the day-of-week pattern taken out.",
  },
  { title: "Holt linear trend", text: "Smooths the daily level and trend, then extends the trend with damping so it fades." },
  { title: "Weighted moving average", text: "Averages the last 56 days, newest days counting most. Flat going forward." },
  {
    title: "Weighted average of the two",
    text: "The method that was more accurate on past days gets more weight (25% to 75%). This is the planning forecast.",
  },
  {
    title: "Run the stock down",
    text: "Each line takes today's stock down by its daily usage, adds orders in transit, and marks when it hits the restock trigger.",
  },
];

function perDay(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function methodGap(line: AlgorithmicForecastLine): string {
  if (line.holtPerDay === null || line.wmaPerDay === null || line.usagePerDay === 0) return "—";
  return `${Math.round((Math.abs(line.holtPerDay - line.wmaPerDay) / line.usagePerDay) * 100)}%`;
}

function AlgorithmicChart({ data, line }: { data: ItemStockProjection; line: AlgorithmicForecastLine }) {
  const series = React.useMemo(
    () => [
      actualSeries(data),
      ...(line.holtProjection ? [holtSeries(line.holtProjection)] : []),
      ...(line.wmaProjection ? [wmaSeries(line.wmaProjection)] : []),
      averageSeries(line.projection),
    ],
    [data, line],
  );
  const summary = `Stock for ${data.itemName} with Holt, moving average and weighted average forecasts. ${
    line.stockoutDate ? `The weighted average runs out on ${line.stockoutDate}.` : "It does not run out in the next 12 weeks."
  }`;
  return (
    <StockChart
      series={series}
      thresholds={[thresholdLine(data, line.threshold)]}
      markers={triggerMarker(line.projection, line.trigger, line.threshold, "var(--color-violet-text)")}
      arrivals={arrivalMarkers(line.projection, line.arrivals)}
      summary={summary}
    />
  );
}

export function AlgorithmicForecast({
  runId,
  items,
}: {
  runId: number | null;
  items: { id: number; name: string }[];
}) {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const itemId = selectedId ?? items[0]?.id ?? null;
  const projectionQuery = useQuery({
    queryKey: ["stock-projection", itemId, runId],
    queryFn: () => api.getStockProjection(itemId as number, runId ?? undefined),
    enabled: itemId !== null,
    placeholderData: keepPreviousData,
  });
  const data = projectionQuery.data;
  const updating = projectionQuery.isPlaceholderData;
  const line = data?.algorithmic ?? null;

  return (
    <Card as="section" className="flex min-w-0 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold">Algorithmic forecast</h2>
          {line ? <span className="text-sm text-muted">Made {formatDateTime(line.madeAt)}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <ProvenanceTag kind="database" />
          <Tag tone="grey">No AI used</Tag>
        </div>
      </div>

      <ItemSelect id="algo-item" items={items} value={itemId} onChange={setSelectedId} updating={updating} />

      {projectionQuery.error ? (
        <ErrorBanner>Could not load the forecast: {(projectionQuery.error as Error).message}</ErrorBanner>
      ) : !data ? (
        <p role="status" className="text-sm text-muted">
          Loading forecast{"…"}
        </p>
      ) : !line ? (
        <p className="text-sm text-muted">No algorithmic forecast for this item in this run.</p>
      ) : (
        <UpdatingFade updating={updating} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Holt trend, per day" value={perDay(line.holtPerDay)} />
            <StatTile label="Moving avg 56d, per day" value={perDay(line.wmaPerDay)} />
            <StatTile label="Planning forecast, per day" value={perDay(line.usagePerDay)} />
            <StatTile label="Methods differ by" value={methodGap(line)} />
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <RestockStatus lines={[{ name: "Algorithmic", trigger: line.trigger }]} unit={data.unit} />
              <AlgorithmicChart data={data} line={line} />
            </div>

            <div className="flex w-full flex-col gap-2 xl:w-80 xl:shrink-0">
              <h3 className="text-base font-semibold">How this forecast is made</h3>
              <p className="text-sm text-strong-muted">
                Two methods, then a weighted average. Both use only the daily stock counts in your database.
                {line.holtWeight !== null ? ` Holt gets ${Math.round(line.holtWeight * 100)}% of the weight for this item.` : ""}
              </p>
              <StepList steps={STEPS} />
            </div>
          </div>
        </UpdatingFade>
      )}
    </Card>
  );
}
