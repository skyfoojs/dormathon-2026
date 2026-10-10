import type { ProvenanceKind } from "@/components/ui/Tag";
import { PREDICTION_RUNS, type PredictionRunSummary } from "@/lib/mock/predictionRuns";
import { ITEMS } from "@/lib/db/seed";

export type RunStep = {
  id: string;
  icon: "search" | "page";
  label: string;
  detail: string;
  finding: string;
  provenance: ProvenanceKind;
};

export type RunModelId = "demand" | "external" | "supply";

export type RunModel = {
  id: RunModelId;
  name: string;
  version: string;
  role: "Investigator" | "Source" | "Skeptic";
  vote: "YES" | "NO";
  confidence: number;
  outcome: string;
  reasoning: string;
  supports: string;
  insufficient: string;
  steps: RunStep[];
};

export type RunSourceRow = {
  name: string;
  provenance: ProvenanceKind;
  status: "Read" | "Failed" | "Stale";
};

export type RunChangeRow = {
  type: "No change" | "Input" | "Raised" | "Cleared" | "Stale";
  text: string;
};

export type SuggestedStockRow = {
  itemId: number;
  itemName: string;
  internal: number;
  externalEffect: number;
  orderByLabel: string;
};

export type PredictionRunDetail = {
  runId: string;
  claim: string;
  consensusLabel: string;
  whatToDo: string;
  models: RunModel[];
  sources: RunSourceRow[];
  changes: RunChangeRow[];
  suggestedStock: SuggestedStockRow[];
};

const DEMAND_STEPS: Omit<RunStep, "id">[] = [
  {
    icon: "page",
    label: "Read weekly_inventory",
    detail: "Closing stock, issued quantity and reorder level for this item at this facility.",
    finding: "Issued quantity has been above the 6-week average for the last 3 weeks.",
    provenance: "database",
  },
  {
    icon: "search",
    label: "Compute 6-week issue trend",
    detail: "Mean and trend of weekly issued quantity over the trailing 6 weeks.",
    finding: "Trend is rising, consistent with the item's recent weeks of cover.",
    provenance: "model-output",
  },
  {
    icon: "search",
    label: "Compare to reorder level",
    detail: "Latest closing stock against the facility's saved reorder level.",
    finding: "Closing stock is at or below the reorder level.",
    provenance: "database",
  },
  {
    icon: "search",
    label: "Check for anomalies",
    detail: "Unusually large single-week swings in issued or received quantity.",
    finding: "No anomalies found in the trailing weeks.",
    provenance: "model-output",
  },
  {
    icon: "page",
    label: "Estimate days to stockout",
    detail: "Projects closing stock forward at the current issue trend.",
    finding: "Projected to breach zero within the next 7 to 10 days on current trend.",
    provenance: "model-output",
  },
];

const EXTERNAL_STEPS: Omit<RunStep, "id">[] = [
  {
    icon: "page",
    label: "Read haze_api_weekly",
    detail: "Weekly haze API average for this facility.",
    finding: "Haze API has risen for 3 consecutive weeks.",
    provenance: "database",
  },
  {
    icon: "search",
    label: "Check API trend",
    detail: "Direction and rate of change of the haze API reading.",
    finding: "Trend is upward, now in the Moderate category.",
    provenance: "model-output",
  },
  {
    icon: "search",
    label: "Cross-reference respiratory items",
    detail: "Whether this item is tagged respiratory-relevant.",
    finding: "Item is respiratory-relevant; haze readings are a plausible demand driver.",
    provenance: "model-output",
  },
  {
    icon: "page",
    label: "Check COVID-19 activity",
    detail: "Public health reporting for COVID-19 activity in this area.",
    finding: "[SOURCE] not yet connected. Placeholder shown instead of a figure.",
    provenance: "public-evidence",
  },
  {
    icon: "page",
    label: "Check influenza-like illness rate",
    detail: "Public health reporting for ILI consultation rate.",
    finding: "[ILI RATE] not yet connected. Placeholder shown instead of a figure.",
    provenance: "public-evidence",
  },
];

const SUPPLY_STEPS: Omit<RunStep, "id">[] = [
  {
    icon: "page",
    label: "Read purchase_orders",
    detail: "Open and recent orders for this item at this facility.",
    finding: "At least one open order exists; its timing is checked next.",
    provenance: "database",
  },
  {
    icon: "search",
    label: "Check expected receipt dates",
    detail: "Whether any open order is due before the projected stockout date.",
    finding: "No open order is due before the projected stockout date.",
    provenance: "database",
  },
  {
    icon: "search",
    label: "Check supplier reliability",
    detail: "The primary supplier's saved reliability score and lead time.",
    finding: "Supplier reliability is within the normal range for this facility.",
    provenance: "database",
  },
  {
    icon: "search",
    label: "Check batches for expiry",
    detail: "Whether any on-hand batch is close to expiry and should be excluded.",
    finding: "No batches for this item are close to expiry.",
    provenance: "database",
  },
  {
    icon: "page",
    label: "Estimate replenishment timing",
    detail: "Combines lead time and order timing into an expected restock date.",
    finding: "Earliest realistic restock is after the projected stockout date.",
    provenance: "model-output",
  },
];

function withIds(steps: Omit<RunStep, "id">[], prefix: string): RunStep[] {
  return steps.map((s, i) => ({ ...s, id: `${prefix}-${i + 1}` }));
}

function clampConfidence(n: number): number {
  return Math.min(98, Math.max(55, Math.round(n)));
}

export function buildRunDetail(run: PredictionRunSummary): PredictionRunDetail {
  const item = ITEMS[(Number(run.id.replace(/\D/g, "")) || 0) % ITEMS.length];
  const itemName = run.id === "run-104" ? "Ipratropium 0.5mg nebule" : item.item_name;

  const demandConfidence = clampConfidence(run.riskScore + 7);
  const externalConfidence = clampConfidence(run.riskScore - 9);
  const supplyConfidence = clampConfidence(run.riskScore + 1);

  const models: RunModel[] = [
    {
      id: "demand",
      name: "Demand model",
      version: "v1.3",
      role: "Investigator",
      vote: "YES",
      confidence: demandConfidence,
      outcome: `${itemName} will breach its reorder level within 7 days.`,
      reasoning:
        "Issued quantity has risen over the trailing 6 weeks while closing stock has not been replenished in time.",
      supports: "weekly_inventory shows a consistent downward trend in closing stock.",
      insufficient: "No single week's data alone confirms the trend; the 6-week window is what drives this vote.",
      steps: withIds(DEMAND_STEPS, "demand"),
    },
    {
      id: "external",
      name: "External signal model",
      version: "v0.9",
      role: "Source",
      vote: "YES",
      confidence: externalConfidence,
      outcome: "Outside conditions make a demand spike more likely, though two sources are not yet connected.",
      reasoning:
        "Haze API has been rising for 3 weeks, a plausible driver for respiratory item demand. COVID-19 activity and ILI rate are not yet connected, so this vote carries lower confidence.",
      supports: "haze_api_weekly shows a rising trend over the trailing 3 weeks.",
      insufficient: "COVID-19 activity and influenza-like illness rate: no source connected yet.",
      steps: withIds(EXTERNAL_STEPS, "external"),
    },
    {
      id: "supply",
      name: "Supply model",
      version: "v1.1",
      role: "Skeptic",
      vote: "YES",
      confidence: supplyConfidence,
      outcome: "No open order will arrive before the projected stockout date.",
      reasoning:
        "Purchase orders and supplier lead times were checked against the projected stockout date; nothing resolves it in time.",
      supports: "purchase_orders has no open order with an expected receipt date before the projected stockout.",
      insufficient: "A same-day emergency order was not modelled; this model only reasons from saved lead times.",
      steps: withIds(SUPPLY_STEPS, "supply"),
    },
  ];

  const sources: RunSourceRow[] = [
    { name: "weekly_inventory", provenance: "database", status: "Read" },
    { name: "haze_api_weekly", provenance: "database", status: "Read" },
    { name: "purchase_orders", provenance: "database", status: "Read" },
    { name: "COVID-19 activity feed", provenance: "public-evidence", status: run.status === "Partial" ? "Failed" : "Stale" },
    { name: "Influenza-like illness feed", provenance: "public-evidence", status: "Stale" },
  ];

  const changes: RunChangeRow[] =
    run.id === "run-104"
      ? [
          { type: "Raised", text: "Risk score raised from 74 to 81 since the previous run." },
          { type: "Input", text: "A new purchase order was saved for this facility, triggering this run." },
          { type: "Stale", text: "COVID-19 activity feed could not be read; last good value reused." },
        ]
      : [{ type: "No change", text: "No material change since the previous run." }];

  const suggestedStock: SuggestedStockRow[] = ITEMS.filter((i) => i.is_critical === 1).map((i, idx) => ({
    itemId: i.item_id,
    itemName: i.item_name,
    internal: 200 + idx * 120,
    externalEffect: [0.08, 0.04, 0.0, 0.12, 0.02][idx % 5],
    orderByLabel: idx === 0 ? "Today" : `In ${idx + 2} days`,
  }));

  return {
    runId: run.id,
    claim: `${itemName} will run out within 7 days.`,
    consensusLabel: "Consensus · 3 of 3 models agree",
    whatToDo: `Raise a purchase order for ${itemName} today. No open order currently covers the projected stockout date.`,
    models,
    sources,
    changes,
    suggestedStock,
  };
}

export function getRunDetail(runId: string): PredictionRunDetail | null {
  const run = PREDICTION_RUNS.find((r) => r.id === runId);
  if (!run) return null;
  return buildRunDetail(run);
}
