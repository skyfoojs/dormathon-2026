"use client";

import * as React from "react";
import {
  PREDICTION_RUNS,
  meanConfidence,
  type PredictionRunSummary,
  type RunConfidences,
} from "@/lib/mock/predictionRuns";

type PredictionsContextValue = {
  runs: PredictionRunSummary[];
  selectedRunId: string;
  selectRun: (id: string) => void;
  syncNow: () => void;
};

const PredictionsContext = React.createContext<PredictionsContextValue | null>(null);

let manualRunCounter = 1;

export function PredictionsProvider({ children }: { children: React.ReactNode }) {
  const [runs, setRuns] = React.useState<PredictionRunSummary[]>(PREDICTION_RUNS);
  const [selectedRunId, setSelectedRunId] = React.useState(PREDICTION_RUNS[0].id);

  const syncNow = React.useCallback(() => {
    const confidences: RunConfidences = [86, 72, 93];
    const id = `2026-10-10-1435-manual-${manualRunCounter++}`;
    const newRun: PredictionRunSummary = {
      id,
      facilityId: 1,
      ranAtLabel: "Just now",
      ranAtClock: "14:35",
      durationLabel: "43 s",
      trigger: "Manual",
      status: "OK",
      confidences,
      riskScore: meanConfidence(confidences),
      warningsRaised: 6,
    };
    setRuns((prev) => [newRun, ...prev]);
    setSelectedRunId(id);
  }, []);

  const value = React.useMemo<PredictionsContextValue>(
    () => ({ runs, selectedRunId, selectRun: setSelectedRunId, syncNow }),
    [runs, selectedRunId, syncNow],
  );

  return <PredictionsContext.Provider value={value}>{children}</PredictionsContext.Provider>;
}

export function usePredictions(): PredictionsContextValue {
  const ctx = React.useContext(PredictionsContext);
  if (!ctx) {
    throw new Error("usePredictions must be used within a PredictionsProvider");
  }
  return ctx;
}
