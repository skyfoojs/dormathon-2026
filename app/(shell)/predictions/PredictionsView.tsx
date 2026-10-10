"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorBanner } from "@/components/ui/Banner";
import { SyncRunsCard, isActive, type RunFilter } from "@/components/predictions/SyncRunsCard";
import { ForecastModeSwitch, type ForecastMode } from "@/components/predictions/ForecastModeSwitch";
import { OverallForecastCard } from "@/components/predictions/OverallForecastCard";
import { AlgorithmicForecast } from "@/components/predictions/AlgorithmicForecast";
import { AiForecast } from "@/components/predictions/AiForecast";
import * as api from "@/lib/api/resources";
import type { RunCouncil, SyncRunFilter, SyncScope } from "@/lib/api/resources";

const POLL_MS = 3000;

const SUBTITLE: Record<ForecastMode, string> = {
  ai: "When the models last read the outside world, what each one found, and what they suggest.",
  algorithmic: "Forecasts from your own stock history only. No AI and no outside signals.",
};

function toApiFilter(filter: RunFilter): SyncRunFilter {
  if (filter.kind === "manual") return { trigger: "manual" };
  if (filter.kind === "auto") return { trigger: filter.auto === "both" ? "auto" : filter.auto };
  return {};
}

function disabledModes(council: RunCouncil | undefined): ForecastMode[] {
  if (!council) return ["algorithmic", "ai"];
  const hasForecasts = council.aiForecast.length > 0;
  const hasAlgorithmic = hasForecasts || (council.algorithmic?.forecastCount ?? 0) > 0;
  const hasCouncil = council.cycles.length > 0 || council.screener !== null || isActive(council.run);
  return [...(hasAlgorithmic ? [] : (["algorithmic"] as const)), ...(hasForecasts || hasCouncil ? [] : (["ai"] as const))];
}

export default function PredictionsView() {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<RunFilter>({ kind: "both", auto: "both" });
  const [selectedRunId, setSelectedRunId] = React.useState<number | null>(null);
  const [requestedMode, setRequestedMode] = React.useState<ForecastMode>("ai");
  const [aiItemId, setAiItemId] = React.useState<number | null>(null);
  const apiFilter = toApiFilter(filter);

  const runsQuery = useQuery({
    queryKey: ["sync-runs", apiFilter],
    queryFn: () => api.getSyncRuns(apiFilter),
    refetchInterval: (query) => (query.state.data?.some(isActive) ? POLL_MS : false),
  });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const runs = runsQuery.data ?? [];
  const runId = runs.some((r) => r.sync_run_id === selectedRunId) ? selectedRunId : (runs[0]?.sync_run_id ?? null);

  const councilQuery = useQuery({
    queryKey: ["run-council", runId],
    queryFn: () => api.getRunCouncil(runId as number),
    enabled: runId !== null,
    refetchInterval: (query) => (query.state.data && isActive(query.state.data.run) ? POLL_MS : false),
  });
  const council = councilQuery.data;
  const runStatus = council?.run.status;
  const runStage = council?.run.stage;

  const previous = React.useRef({ status: runStatus, stage: runStage });
  React.useEffect(() => {
    const wasActive = previous.current.status === "running" || previous.current.status === "queued";
    const leftAlgorithmic = previous.current.stage === "algorithmic_forecast" && runStage !== "algorithmic_forecast";
    previous.current = { status: runStatus, stage: runStage };
    const finished = wasActive && (runStatus === "succeeded" || runStatus === "failed");
    if (finished || leftAlgorithmic) qc.invalidateQueries({ queryKey: ["stock-projection"] });
    if (finished) qc.invalidateQueries({ queryKey: ["sync-runs"] });
  }, [qc, runStatus, runStage]);

  const syncMutation = useMutation({
    mutationFn: (scope: SyncScope) => api.startSyncRun(scope),
    onSuccess: (run) => {
      setSelectedRunId(run.sync_run_id);
      return qc.invalidateQueries({ queryKey: ["sync-runs"] });
    },
  });

  const items = [...(itemsQuery.data ?? [])]
    .sort((a, b) => a.item_name.localeCompare(b.item_name))
    .map((i) => ({ id: i.item_id, name: i.item_name }));
  const disabled = disabledModes(council);
  const mode = disabled.includes(requestedMode)
    ? ((["algorithmic", "ai"] as const).find((m) => !disabled.includes(m)) ?? requestedMode)
    : requestedMode;
  const activeRun = runs.find(isActive) ?? null;
  const loadError = runsQuery.error || itemsQuery.error || councilQuery.error;

  return (
    <>
      <PageHeader title="Predictions" subtitle={SUBTITLE[mode]} />

      {loadError ? <ErrorBanner>Could not load predictions: {(loadError as Error).message}</ErrorBanner> : null}

      <SyncRunsCard
        runs={runs}
        selectedRunId={runId}
        onSelect={setSelectedRunId}
        filter={filter}
        onFilterChange={setFilter}
        onSync={(scope) => syncMutation.mutate(scope)}
        activeRun={activeRun}
        syncError={syncMutation.error ? (syncMutation.error as Error).message : null}
      />

      <OverallForecastCard runId={runId} items={items} />

      <ForecastModeSwitch mode={mode} onChange={setRequestedMode} disabled={disabled} />

      {runId !== null && !council && !councilQuery.error ? (
        <p role="status" className="text-sm text-muted">
          Loading run{"…"}
        </p>
      ) : disabled.length === 2 ? (
        <p className="text-sm text-muted">
          {council?.run.error ? `This run failed: ${council.run.error}` : "This run has no forecasts to show."}
        </p>
      ) : mode === "algorithmic" ? (
        <AlgorithmicForecast runId={runId} items={items} />
      ) : council ? (
        <AiForecast council={council} items={items} itemId={aiItemId ?? items[0]?.id ?? null} onItemChange={setAiItemId} />
      ) : null}
    </>
  );
}
