"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { PreviousRunsCard } from "@/components/predictions/RunTiles";
import { ForecastModeSwitch, type ForecastMode } from "@/components/predictions/ForecastModeSwitch";
import { AlgorithmicForecast } from "@/components/predictions/AlgorithmicForecast";
import { RunDetail } from "@/components/predictions/RunDetail";
import { SourcesAndChanges } from "@/components/predictions/SourcesAndChanges";
import { SuggestedStockTable } from "@/components/predictions/SuggestedStockTable";
import { StockRunoutCard } from "@/components/predictions/StockRunoutCard";
import { usePredictions } from "@/components/providers/PredictionsProvider";
import * as api from "@/lib/api/resources";
import { ALGO_CHANGES, ALGO_SOURCES, buildTierRows, type WmaWindowDays } from "@/lib/mock/algorithmicForecast";
import { buildRunDetail } from "@/lib/mock/predictionDetail";

const SUBTITLE: Record<ForecastMode, string> = {
  ai: "When the models last read the outside world, what each one found, and what they suggest.",
  algorithmic: "Forecasts from your own stock history only. No AI and no outside signals.",
};

export default function PredictionsView() {
  const { runs, selectedRunId, selectRun, syncNow } = usePredictions();
  const [mode, setMode] = React.useState<ForecastMode>("ai");
  const [windowDays, setWindowDays] = React.useState<WmaWindowDays>(60);

  // A sync also lets AiGIS raise any purchase orders the forecast calls for.
  const qc = useQueryClient();
  const autoOrdersMutation = useMutation({
    mutationFn: () => api.runAutomatedPurchaseOrders(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
  const autoOrders = autoOrdersMutation.data;
  const autoOrderLines = autoOrders ? autoOrders.orders.reduce((sum, o) => sum + o.lines.length, 0) : 0;

  function handleSyncNow() {
    // A second press while the first is still checking would ask twice.
    if (autoOrdersMutation.isPending) return;
    syncNow();
    autoOrdersMutation.mutate();
  }

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? runs[0];
  const detail = React.useMemo(() => buildRunDetail(selectedRun), [selectedRun]);
  const tierRows = React.useMemo(() => buildTierRows(windowDays), [windowDays]);
  const highTierCount = tierRows.filter((r) => r.tier === "High").length;
  const isAi = mode === "ai";

  return (
    <>
      <PageHeader title="Predictions" subtitle={SUBTITLE[mode]} />

      <PreviousRunsCard
        runs={runs}
        selectedRunId={selectedRun.id}
        onSelect={selectRun}
        onSyncNow={handleSyncNow}
        syncing={autoOrdersMutation.isPending}
        nextSyncClock="15:00"
        scoreLabel={isAi ? "risk" : "high tier"}
        getScore={(run) => (isAi ? run.riskScore : highTierCount)}
      />

      {autoOrdersMutation.isPending ? (
        <p role="status" className="text-sm text-muted">
          Checking whether any purchase orders are needed{"…"}
        </p>
      ) : autoOrdersMutation.error ? (
        <div role="alert" className="rounded-md border border-red bg-red/5 p-4 text-sm text-red-dark">
          AiGIS could not raise purchase orders. {(autoOrdersMutation.error as Error).message}
        </div>
      ) : autoOrders ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-green-border bg-green-tint px-4 py-3 text-sm text-green-text"
        >
          <span>
            {autoOrders.createdPoIds.length > 0
              ? `AiGIS raised ${autoOrders.createdPoIds.length} purchase order${autoOrders.createdPoIds.length === 1 ? "" : "s"} covering ${autoOrderLines} item${autoOrderLines === 1 ? "" : "s"}. They are pending supplier review.`
              : "No new purchase orders are needed right now."}
          </span>
          {autoOrders.createdPoIds.length > 0 ? (
            <Link href="/orders" className="font-semibold underline underline-offset-2">
              View orders
            </Link>
          ) : null}
        </div>
      ) : null}

      <ForecastModeSwitch mode={mode} onChange={setMode} />

      {isAi ? (
        <>
          <RunDetail key={selectedRun.id} run={selectedRun} detail={detail} />
          <SuggestedStockTable rows={detail.suggestedStock} />
        </>
      ) : (
        <>
          <AlgorithmicForecast
            run={selectedRun}
            windowDays={windowDays}
            onWindowChange={setWindowDays}
            tierRows={tierRows}
          />
          <StockRunoutCard />
        </>
      )}

      <SourcesAndChanges
        sources={isAi ? detail.sources : ALGO_SOURCES}
        changes={isAi ? detail.changes : ALGO_CHANGES}
      />
    </>
  );
}
