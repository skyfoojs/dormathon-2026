export type RunTrigger = "Hourly" | "New input" | "Manual";
export type RunStatus = "OK" | "Partial";

export type PredictionRunSummary = {
  id: string;
  facilityId: number;
  ranAtLabel: string; // fixed display label, e.g. "34 min ago"
  ranAtClock: string; // fixed display clock time, e.g. "14:22"
  durationLabel: string; // e.g. "41 s"
  trigger: RunTrigger;
  status: RunStatus;
  riskScore: number; // 0-100, mean of the 3 model confidences
  warningsRaised: number;
};

// Synthetic data: illustrative run log, with fixed display times rather than
// ones computed from the real clock (so the demo is deterministic and the
// same on the server and the client). The real `prediction_runs` table
// (proposed; does not exist yet) would back this with real timestamps.
export const PREDICTION_RUNS: PredictionRunSummary[] = [
  {
    id: "run-104",
    facilityId: 1,
    ranAtLabel: "34 min ago",
    ranAtClock: "14:22",
    durationLabel: "41 s",
    trigger: "Hourly",
    status: "OK",
    riskScore: 81,
    warningsRaised: 2,
  },
  {
    id: "run-103",
    facilityId: 1,
    ranAtLabel: "1 hr 34 min ago",
    ranAtClock: "13:22",
    durationLabel: "39 s",
    trigger: "Hourly",
    status: "OK",
    riskScore: 74,
    warningsRaised: 1,
  },
  {
    id: "run-102",
    facilityId: 1,
    ranAtLabel: "2 hr 36 min ago",
    ranAtClock: "12:20",
    durationLabel: "58 s",
    trigger: "New input",
    status: "Partial",
    riskScore: 68,
    warningsRaised: 1,
  },
  {
    id: "run-101",
    facilityId: 1,
    ranAtLabel: "3 hr 34 min ago",
    ranAtClock: "11:22",
    durationLabel: "42 s",
    trigger: "Hourly",
    status: "OK",
    riskScore: 55,
    warningsRaised: 0,
  },
  {
    id: "run-100",
    facilityId: 1,
    ranAtLabel: "4 hr 34 min ago",
    ranAtClock: "10:22",
    durationLabel: "40 s",
    trigger: "Hourly",
    status: "OK",
    riskScore: 52,
    warningsRaised: 0,
  },
];
