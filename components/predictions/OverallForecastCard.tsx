"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { UpdatingFade } from "@/components/ui/UpdatingFade";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/Banner";
import { ItemSelect } from "@/components/predictions/ItemSelect";
import { RestockStatus } from "@/components/predictions/RestockStatus";
import { StockChart } from "@/components/predictions/StockChart";
import { actualSeries, aiSeries, averageSeries, thresholdLine } from "@/components/predictions/forecastSeries";
import * as api from "@/lib/api/resources";
import type { ItemStockProjection } from "@/lib/api/resources";

function OverviewChart({ data }: { data: ItemStockProjection }) {
  const { algorithmic: algo, ai } = data;
  const threshold = algo?.threshold ?? ai?.threshold ?? null;
  const series = React.useMemo(
    () => [
      actualSeries(data),
      ...(algo ? [averageSeries(algo.projection, "Algorithmic forecast")] : []),
      ...(ai ? [aiSeries(ai.projection)] : []),
    ],
    [data, algo, ai],
  );
  return (
    <StockChart
      series={series}
      thresholds={threshold === null ? [] : [thresholdLine(data, threshold)]}
      summary={`Stock for ${data.itemName} with the algorithmic and AI forecasts.`}
    />
  );
}

export function OverallForecastCard({
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
  const algo = data?.algorithmic ?? null;
  const ai = data?.ai ?? null;

  return (
    <Card as="section" className="flex min-w-0 flex-col gap-4 p-6">
      <CardHeader>
        <CardTitle>Forecast overview</CardTitle>
      </CardHeader>
      <ItemSelect id="overall-item" items={items} value={itemId} onChange={setSelectedId} updating={updating} />
      {projectionQuery.error ? (
        <ErrorBanner>Could not load the forecast: {(projectionQuery.error as Error).message}</ErrorBanner>
      ) : !data ? (
        <p role="status" className="text-sm text-muted">
          Loading forecast{"…"}
        </p>
      ) : (
        <UpdatingFade updating={updating} className="flex flex-col gap-4">
          {algo || ai ? (
            <RestockStatus
              lines={[
                ...(algo ? [{ name: "Algorithmic", trigger: algo.trigger }] : []),
                ...(ai ? [{ name: "AI", trigger: ai.trigger }] : []),
              ]}
              unit={data.unit}
            />
          ) : (
            <p className="text-sm text-muted">
              {runId === null ? "No forecasts yet." : "No forecast for this item in this run."} Showing actual stock only.
            </p>
          )}
          <OverviewChart data={data} />
        </UpdatingFade>
      )}
    </Card>
  );
}
