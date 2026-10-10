import type { ProvenanceKind } from "@/components/ui/Tag";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

export type RunStep = {
  id: string;
  icon: "search" | "page";
  label: string;
  detail: string;
  finding: string;
  provenance: ProvenanceKind;
  // The closing "drafting the answer" step: part of the trail, not evidence.
  draft?: boolean;
};

export type RunModelId = "demand" | "external" | "supply";

export type RunModel = {
  id: RunModelId;
  name: string;
  version: string;
  role: "Investigator" | "Source" | "Skeptic";
  vote: "YES" | "NO";
  confidence: number;
  reasoning: string;
  supports: string;
  insufficient: string;
  sources: string[];
  steps: RunStep[];
};

export type RunSourceRow = {
  name: string;
  note: string;
  provenance: ProvenanceKind;
  status: "Read" | "Failed";
};

export type RunChangeRow = {
  type: "No change" | "Input" | "Raised" | "Cleared" | "Stale";
  text: string;
};

export type SuggestedStockRow = {
  itemName: string;
  why: string;
  internal: number;
  externalEffect: number;
  orderByLabel: string;
};

export type PredictionRunDetail = {
  runId: string;
  claim: string;
  consensusLabel: string;
  consensusSummary: string;
  whatToDo: string;
  models: RunModel[];
  sources: RunSourceRow[];
  changes: RunChangeRow[];
  suggestedStock: SuggestedStockRow[];
};

type ModelSeed = Omit<RunModel, "vote" | "confidence" | "steps"> & { steps: Omit<RunStep, "id">[] };

// Synthetic data: one illustrative panel run. Bracketed values are
// placeholders for outside sources that are not connected yet.
const MODEL_SEEDS: ModelSeed[] = [
  {
    id: "demand",
    name: "Demand model",
    version: "internal-trend-v1 · sample",
    role: "Investigator",
    reasoning:
      "The last count is far below the reorder level of 100 and the usual issue is 70 a week, so cover is about 0.1 weeks. Only an on-time delivery avoids a stock-out.",
    supports: "Is cover shorter than the delivery gap? Yes, 0.1 weeks of cover against a 7-day lead time.",
    insufficient: "Will demand drop this week? No sign of it in the last 6 weeks.",
    sources: ["weekly_inventory", "items"],
    steps: [
      { icon: "search", label: "Read weekly issue history", detail: "weekly_inventory, Ipratropium 0.5mg nebule, last 6 weeks", finding: "Mean issue 70 a week, spread about 8. No week above 82.", provenance: "database" },
      { icon: "page", label: "Read 14 weekly stock rows", detail: "Closing stock, receipts and reorder level for the item", finding: "7 on hand at the last count, reorder level 100.", provenance: "database" },
      { icon: "search", label: "Simulated 300 stock paths", detail: "Weekly issue with spread, a 3-week delivery cycle, PO-1043 arriving today", finding: "86 percent of paths reach zero before 16 Oct if the delivery slips.", provenance: "model-output" },
      { icon: "page", label: "Checked the series for typing errors", detail: "Median absolute deviation over the 14 weeks", finding: "No outliers for this item.", provenance: "model-output" },
      { icon: "page", label: "Drafting the answer", detail: "Simulation and checks", finding: "YES. Main driver is the low opening stock.", provenance: "model-output", draft: true },
    ],
  },
  {
    id: "external",
    name: "External signal model",
    version: "external-scan-v1 · sample",
    role: "Source",
    reasoning:
      "Outside signals add modest upward pressure on respiratory items. They do not change the answer alone. This view uses placeholders until real sources are connected.",
    supports: "Is respiratory demand likely to rise? [ILI RATE] is [TREND] per [SOURCE].",
    insufficient: "Is the haze effect large? Haze is Moderate and tracks issue only weakly in the sample (r about 0.26).",
    sources: ["[SOURCE 1]", "[SOURCE 2]", "[SOURCE 3]"],
    steps: [
      { icon: "search", label: "Searched (support): influenza-like illness trend", detail: '"[SOURCE] influenza-like illness [REGION] [WEEK]"', finding: "[ILI RATE], [TREND]. Placeholder until a source is chosen.", provenance: "public-evidence" },
      { icon: "page", label: "Opened 2 pages: [SOURCE 1], [SOURCE 2]", detail: "Both pages from the support search", finding: "Both report [TREND]. Assumed +10 percent effect on respiratory items.", provenance: "scenario-assumption" },
      { icon: "search", label: "Searched (challenge): haze outlook", detail: '"[SOURCE] haze API outlook [MONTH]"', finding: "Database shows API 57 (Moderate). [OUTLOOK] pending.", provenance: "public-evidence" },
      { icon: "page", label: "Opened 1 page: [SOURCE 3]", detail: "Top page from the challenge search", finding: "No strong contradiction found.", provenance: "public-evidence" },
      { icon: "page", label: "Drafting the answer", detail: "Support and challenge findings", finding: "YES, with lower confidence because sources are placeholders.", provenance: "model-output", draft: true },
    ],
  },
  {
    id: "supply",
    name: "Supply model",
    version: "supply-risk-v1 · sample",
    role: "Skeptic",
    reasoning:
      "The only incoming stock is PO-1043, due today from a supplier that already has a late order open. If it slips, the ward runs out.",
    supports: "Is delivery guaranteed? No, 1 of 3 recent orders from this supplier was late.",
    insufficient: "Is there a second source? None is recorded for this item.",
    sources: ["purchase_orders", "suppliers", "batches"],
    steps: [
      { icon: "search", label: "Queried open purchase orders", detail: "purchase_orders for the item, status open", finding: "PO-1043, 600 nebules, due today, Nusantara Medicines.", provenance: "database" },
      { icon: "page", label: "Read supplier lead time and history", detail: "suppliers and their open orders", finding: "Lead time 7 days. PO-1042 from the same supplier is 2 days late.", provenance: "database" },
      { icon: "search", label: "Challenged: does PO-1043 arrive in time?", detail: "Late-delivery history for this supplier", finding: "Unclear. 1 of 3 recent orders was late.", provenance: "model-output" },
      { icon: "page", label: "Checked batches for other stock", detail: "batches for the item", finding: "No other lot is recorded.", provenance: "database" },
      { icon: "page", label: "Drafting the answer", detail: "Order, supplier and batch findings", finding: "YES. The risk rests on one delivery.", provenance: "model-output", draft: true },
    ],
  },
];

const HAZE: RunSourceRow = { name: "Haze API, weekly rows", note: "14 weekly rows. Latest API 57 (Moderate).", provenance: "database", status: "Read" };
const COVID_OK: RunSourceRow = { name: "COVID-19 activity", note: "[SOURCE] read. Latest value [POSITIVITY OR CASES], trend [TREND].", provenance: "public-evidence", status: "Read" };
const ILI_OK: RunSourceRow = { name: "Influenza-like illness", note: "[SOURCE] read. Latest value [ILI RATE], trend [TREND].", provenance: "public-evidence", status: "Read" };
const COVID_FAILED: RunSourceRow = { name: "COVID-19 activity", note: "Request timed out after 30 seconds. The value from 08:00 was reused and marked stale.", provenance: "public-evidence", status: "Failed" };
const ALL_SOURCES = [HAZE, COVID_OK, ILI_OK];

type RunFacets = { sources: RunSourceRow[]; changes: RunChangeRow[] };

const RUN_FACETS: Record<string, RunFacets> = {
  "2026-10-10-1400-hourly": { sources: ALL_SOURCES, changes: [{ type: "No change", text: "No new external reading moved a forecast by more than 5 percent." }] },
  "2026-10-10-1300-hourly": { sources: ALL_SOURCES, changes: [{ type: "No change", text: "Forecasts and warnings match the 12:12 run." }] },
  "2026-10-10-1212-newinput": {
    sources: ALL_SOURCES,
    changes: [
      { type: "Input", text: "PO-1044 adds 400 Oseltamivir capsules due 16 Oct." },
      { type: "Cleared", text: "Oseltamivir cover warning cleared, the order covers the gap." },
      { type: "Raised", text: "Single-source risk on Nusantara Medicines now covers 3 critical items." },
    ],
  },
  "2026-10-10-1041-manual": {
    sources: ALL_SOURCES,
    changes: [
      { type: "Raised", text: "Influenza-like illness reading rose. Oseltamivir and Salbutamol external effect increased." },
      { type: "Raised", text: "Oseltamivir cover fell below one week." },
    ],
  },
  "2026-10-10-0900-hourly": {
    sources: [HAZE, COVID_FAILED, ILI_OK],
    changes: [{ type: "Stale", text: "COVID-19 value reused from 08:00. The External signal model is marked lower confidence." }],
  },
};

// Runs without their own entry above, including ones started with Sync now.
const DEFAULT_FACETS: RunFacets = {
  sources: ALL_SOURCES,
  changes: [{ type: "No change", text: "No change in forecasts." }],
};

const WEEKS_PER_MONTH = 4.3;

const SUGGESTED_STOCK: SuggestedStockRow[] = [
  { itemName: "Salbutamol 100mcg MDI inhaler", weekly: 65, externalEffect: 0.1, why: "Respiratory. Haze Moderate, influenza-like illness rising.", orderByLabel: "12 Oct" },
  { itemName: "Amoxicillin-clavulanate 625mg", weekly: 410, externalEffect: 0.05, why: "Antibiotic. Secondary infections follow respiratory waves.", orderByLabel: "[DATE]" },
  { itemName: "Dexamethasone 4mg/mL injection", weekly: 70, externalEffect: 0.05, why: "Steroid. Severe respiratory cases.", orderByLabel: "[DATE]" },
  { itemName: "N95 respirator", weekly: 900, externalEffect: 0.1, why: "PPE. Demand follows haze and outbreak alerts.", orderByLabel: "[DATE]" },
  { itemName: "Prednisolone 5mg tablet", weekly: 800, externalEffect: 0, why: "Steroid. No external link assumed. Lot LOT290217 expires 5 Nov.", orderByLabel: "[DATE]" },
  { itemName: "Oseltamivir 75mg capsule", weekly: 150, externalEffect: 0.2, why: "Antiviral. Direct link to influenza activity.", orderByLabel: "[DATE]" },
  { itemName: "Ipratropium 0.5mg nebule", weekly: 70, externalEffect: 0.1, why: "Respiratory. Critical, 7 on hand.", orderByLabel: "Today" },
  { itemName: "Surgical mask, 3-ply", weekly: 2500, externalEffect: 0.05, why: "PPE. Weak haze link in the sample.", orderByLabel: "[DATE]" },
].map(({ weekly, ...row }) => ({ ...row, internal: Math.round(weekly * WEEKS_PER_MONTH) }));

const CLAIM_ITEM = "Ipratropium 0.5mg nebule";

export function buildRunDetail(run: PredictionRunSummary): PredictionRunDetail {
  const models: RunModel[] = MODEL_SEEDS.map((seed, modelIndex) => {
    const confidence = run.confidences[modelIndex];
    const stale = run.staleExternal === true && seed.id === "external";
    return {
      ...seed,
      confidence,
      vote: confidence >= 50 ? "YES" : "NO",
      reasoning: stale ? `${seed.reasoning} The COVID-19 value used here is stale.` : seed.reasoning,
      steps: seed.steps.map((step, stepIndex) => ({
        ...step,
        id: `${seed.id}-${stepIndex + 1}`,
        finding:
          stale && stepIndex === 1
            ? `Source timed out. Last good value reused and marked stale. ${step.finding}`
            : step.finding,
      })),
    };
  });

  const yesCount = models.filter((m) => m.vote === "YES").length;
  const facets = RUN_FACETS[run.id] ?? DEFAULT_FACETS;

  return {
    runId: run.id,
    claim: `${CLAIM_ITEM} will run out within 7 days.`,
    consensusLabel: `Consensus · ${yesCount} of ${models.length} models agree`,
    consensusSummary: `${yesCount} of ${models.length} models say YES: ${CLAIM_ITEM} will run out within 7 days. The demand model sees low opening stock, the supply model sees one delivery that may slip, and outside signals add modest pressure.`,
    whatToDo: "Confirm PO-1043 arrives today. Ask Selangor Pharma for a bridging 150.",
    models,
    sources: facets.sources,
    changes: facets.changes,
    suggestedStock: SUGGESTED_STOCK,
  };
}
