export type RunTrigger = "Hourly" | "New input" | "Manual";
export type RunStatus = "OK" | "Partial";

// Confidence of each model, in panel order: demand, external signal, supply.
export type RunConfidences = [number, number, number];

export type PredictionRunSummary = {
  id: string;
  facilityId: number;
  ranAtLabel: string; // fixed display label, e.g. "34 min ago"
  ranAtClock: string; // fixed display clock time, e.g. "14:00"
  durationLabel: string; // e.g. "41 s"
  trigger: RunTrigger;
  status: RunStatus;
  confidences: RunConfidences;
  riskScore: number; // 0-100, mean of the 3 model confidences
  warningsRaised: number;
  // True when the external signal model reused a stale outside reading.
  staleExternal?: boolean;
};

export function meanConfidence(confidences: RunConfidences): number {
  return Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length);
}

function run(
  input: Omit<PredictionRunSummary, "id" | "facilityId" | "riskScore">,
): PredictionRunSummary {
  const slug = input.trigger.toLowerCase().replace(" ", "");
  return {
    ...input,
    id: `2026-10-10-${input.ranAtClock.replace(":", "")}-${slug}`,
    facilityId: 1,
    riskScore: meanConfidence(input.confidences),
  };
}

// Synthetic data: illustrative run log, with fixed display times rather than
// ones computed from the real clock (so the demo is deterministic and the
// same on the server and the client). The real `prediction_runs` table
// (proposed; does not exist yet) would back this with real timestamps.
export const PREDICTION_RUNS: PredictionRunSummary[] = [
  run({ ranAtClock: "14:00", ranAtLabel: "34 min ago", durationLabel: "41 s", trigger: "Hourly", status: "OK", confidences: [86, 72, 93], warningsRaised: 6 }),
  run({ ranAtClock: "13:00", ranAtLabel: "1 hr 34 min ago", durationLabel: "39 s", trigger: "Hourly", status: "OK", confidences: [85, 70, 93], warningsRaised: 6 }),
  run({ ranAtClock: "12:12", ranAtLabel: "2 hr 22 min ago", durationLabel: "44 s", trigger: "New input", status: "OK", confidences: [86, 70, 90], warningsRaised: 6 }),
  run({ ranAtClock: "12:00", ranAtLabel: "2 hr 34 min ago", durationLabel: "40 s", trigger: "Hourly", status: "OK", confidences: [84, 68, 92], warningsRaised: 6 }),
  run({ ranAtClock: "11:00", ranAtLabel: "3 hr 34 min ago", durationLabel: "42 s", trigger: "Hourly", status: "OK", confidences: [84, 66, 91], warningsRaised: 7 }),
  run({ ranAtClock: "10:41", ranAtLabel: "3 hr 53 min ago", durationLabel: "47 s", trigger: "Manual", status: "OK", confidences: [83, 69, 90], warningsRaised: 7 }),
  run({ ranAtClock: "10:00", ranAtLabel: "4 hr 34 min ago", durationLabel: "40 s", trigger: "Hourly", status: "OK", confidences: [82, 63, 90], warningsRaised: 6 }),
  run({ ranAtClock: "09:00", ranAtLabel: "5 hr 34 min ago", durationLabel: "58 s", trigger: "Hourly", status: "Partial", confidences: [82, 58, 88], warningsRaised: 6, staleExternal: true }),
];
