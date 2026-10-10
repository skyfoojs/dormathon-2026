"use client";

import * as React from "react";
import { PREDICTION_RUNS, type PredictionRunSummary } from "@/lib/mock/predictionRuns";

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
    const id = `run-manual-${manualRunCounter++}`;
    const newRun: PredictionRunSummary = {
      id,
      facilityId: 1,
      ranAtLabel: "Just now",
      ranAtClock: "Now",
      durationLabel: "43 s",
      trigger: "Manual",
      status: "OK",
      riskScore: 80,
      warningsRaised: 1,
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
