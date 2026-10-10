"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PreviousRunsCard } from "@/components/predictions/RunTiles";
import { ForecastModeSwitch, type ForecastMode } from "@/components/predictions/ForecastModeSwitch";
import { AlgorithmicForecast } from "@/components/predictions/AlgorithmicForecast";
import { RunDetail } from "@/components/predictions/RunDetail";
import { SourcesAndChanges } from "@/components/predictions/SourcesAndChanges";
import { SuggestedStockTable } from "@/components/predictions/SuggestedStockTable";
import { StockRunoutCard } from "@/components/predictions/StockRunoutCard";
import { usePredictions } from "@/components/providers/PredictionsProvider";
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
        onSyncNow={syncNow}
        nextSyncClock="15:00"
        scoreLabel={isAi ? "risk" : "high tier"}
        getScore={(run) => (isAi ? run.riskScore : highTierCount)}
      />

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
