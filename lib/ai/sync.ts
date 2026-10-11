import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ConflictError } from "@/lib/errors";
import { errorMessage } from "@/lib/ai/errors";
import { ingestNews } from "@/lib/ai/ingest";
import { screenPendingArticles } from "@/lib/ai/screener";
import { enrichSelectedMohArticles } from "@/lib/ai/enrichMoh";
import { runCycle1 } from "@/lib/ai/cycle1";
import { runCycle2 } from "@/lib/ai/cycle2";
import { deriveAiForecastFields, findLatestAiForecasts, toUsageAdjustment } from "@/lib/ai/aiForecasts";
import { findLatestForecasts, findLatestInventoryDate, toForecastBasis } from "@/lib/ai/algorithmic";
import { loadForecastInputs, runForecasts } from "@/lib/forecast/run";
import { runAutomatedPurchaseOrders } from "@/lib/orders/automatedPurchaseOrders";
import { hazeCategoryChangedSince, recordHazeReading } from "@/lib/haze";

export type SyncTrigger = "manual" | "hourly" | "daily";
export type SyncScope = "news" | "full";
type SyncStage =
  | "algorithmic_forecast"
  | "fetching_news"
  | "screening"
  | "enriching_moh"
  | "rescreening"
  | "cycle1"
  | "cycle2"
  | "reusing_last_verdict"
  | "raising_orders"
  | "done";

export const SYNC_TIMEOUT_SECONDS = 300;
export const MAX_SYNC_COST_USD = 1;

const UNIQUE_VIOLATION = "23505";

export const syncRunSchema = z.object({
  sync_run_id: z.number(),
  trigger: z.enum(["manual", "hourly", "daily"]),
  scope: z.enum(["news", "full"]),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  stage: z.string().nullable(),
  error: z.string().nullable(),
  stock_as_of: z.string().nullable(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
});

export type SyncRun = z.infer<typeof syncRunSchema>;

export const SYNC_RUN_COLUMNS = "sync_run_id, trigger, scope, status, stage, error, stock_as_of, started_at, finished_at";

const costRowSchema = z.object({ cost_usd: z.number().nullable() });
const lastCouncilRowSchema = z.object({ created_at: z.string() });
const countSchema = z.number();

class CostCapExceededError extends Error {
  constructor(spentUsd: number) {
    super(`Cost cap of $${MAX_SYNC_COST_USD} exceeded ($${spentUsd.toFixed(4)} spent)`);
    this.name = "CostCapExceededError";
  }
}

export async function startSyncRun(trigger: SyncTrigger, scope: SyncScope): Promise<SyncRun> {
  await failTimedOutRuns();
  const { data, error } = await getDb()
    .from("sync_runs")
    .insert({ trigger, scope, status: "running" })
    .select(SYNC_RUN_COLUMNS)
    .single();
  if (error?.code === UNIQUE_VIOLATION) {
    throw new ConflictError("A sync is already running");
  }
  if (error) throw error;
  return syncRunSchema.parse(data);
}

export async function executeSyncRun(run: Pick<SyncRun, "sync_run_id" | "scope">): Promise<void> {
  const syncRunId = run.sync_run_id;
  try {
    const stockAsOf = await runPipeline(syncRunId, run.scope);
    await setStage(syncRunId, "raising_orders");
    await runAutomatedPurchaseOrders({ dryRun: false });
    await finishRun(syncRunId, { status: "succeeded", stage: "done", stock_as_of: stockAsOf, error: null });
  } catch (err) {
    console.error(`Sync run ${syncRunId} failed`, err);
    await finishRun(syncRunId, { status: "failed", error: errorMessage(err) });
  }
}

export async function findSyncRunCost(syncRunId: number): Promise<number> {
  const { data, error } = await getDb().from("llm_calls").select("cost_usd").eq("sync_run_id", syncRunId);
  if (error) throw error;
  return z
    .array(costRowSchema)
    .parse(data)
    .reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
}

async function failTimedOutRuns(): Promise<void> {
  const cutoff = new Date(Date.now() - SYNC_TIMEOUT_SECONDS * 1000).toISOString();
  const { error } = await getDb()
    .from("sync_runs")
    .update({ status: "failed", error: "Timed out", finished_at: new Date().toISOString() })
    .in("status", ["queued", "running"])
    .lt("started_at", cutoff);
  if (error) throw error;
}

async function runPipeline(syncRunId: number, scope: SyncScope): Promise<string | null> {
  if (scope === "full") {
    await setStage(syncRunId, "algorithmic_forecast");
    await runForecasts();
  }

  await setStage(syncRunId, "fetching_news");
  await recordHazeSafely(syncRunId);
  const ingest = await ingestNews(syncRunId);
  if (ingest.failedSources.length > 0) {
    console.error(`Sync run ${syncRunId}: news sources failed`, ingest.failedSources);
  }

  if (ingest.newArticleIds.length === 0 && (await countPendingArticles()) === 0) {
    if (await hazeChangedSinceLastForecast()) {
      await setStage(syncRunId, "cycle2");
      return (await runCycle2(syncRunId)).stockAsOf;
    }
    await setStage(syncRunId, "reusing_last_verdict");
    return reuseLastAiForecasts(syncRunId);
  }

  await setStage(syncRunId, "screening");
  await screenPendingArticles(syncRunId);
  await assertWithinCostCap(syncRunId);

  // MOH articles the screener judged relevant from the title alone get
  // their real content pulled from their PDF attachment here, then go back
  // to screen_status 'pending' for a cheap re-screen with that real
  // content - see enrichMoh.ts for why this runs only on already-selected
  // articles rather than every MOH article up front.
  await setStage(syncRunId, "enriching_moh");
  const enrichment = await enrichSelectedMohArticles();
  if (enrichment.enriched > 0) {
    await setStage(syncRunId, "rescreening");
    await screenPendingArticles(syncRunId);
    await assertWithinCostCap(syncRunId);
  }

  await setStage(syncRunId, "cycle1");
  await runCycle1(syncRunId);
  await assertWithinCostCap(syncRunId);

  await setStage(syncRunId, "cycle2");
  const cycle2 = await runCycle2(syncRunId);
  return cycle2.stockAsOf;
}

async function recordHazeSafely(syncRunId: number): Promise<void> {
  try {
    await recordHazeReading();
  } catch (err) {
    console.error(`Sync run ${syncRunId}: haze reading skipped`, err);
  }
}

async function hazeChangedSinceLastForecast(): Promise<boolean> {
  const { data, error } = await getDb()
    .from("council_runs")
    .select("created_at")
    .eq("cycle", 2)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return hazeCategoryChangedSince(lastCouncilRowSchema.parse(data).created_at);
}

async function setStage(syncRunId: number, stage: SyncStage): Promise<void> {
  const { error } = await getDb().from("sync_runs").update({ stage }).eq("sync_run_id", syncRunId);
  if (error) throw error;
}

async function finishRun(
  syncRunId: number,
  fields: { status: "succeeded" | "failed"; error: string | null; stage?: SyncStage; stock_as_of?: string | null },
): Promise<void> {
  const { error } = await getDb()
    .from("sync_runs")
    .update({ ...fields, finished_at: new Date().toISOString() })
    .eq("sync_run_id", syncRunId);
  if (error) console.error(`Sync run ${syncRunId}: could not record its result`, error);
}

async function assertWithinCostCap(syncRunId: number): Promise<void> {
  const spent = await findSyncRunCost(syncRunId);
  if (spent > MAX_SYNC_COST_USD) throw new CostCapExceededError(spent);
}

async function countPendingArticles(): Promise<number> {
  const { count, error } = await getDb()
    .from("articles")
    .select("article_id", { count: "exact", head: true })
    .eq("screen_status", "pending");
  if (error) throw error;
  return countSchema.parse(count ?? 0);
}

async function reuseLastAiForecasts(syncRunId: number): Promise<string | null> {
  const [adjustments, forecasts, inputs, stockAsOf] = await Promise.all([
    findLatestAiForecasts(),
    findLatestForecasts(),
    loadForecastInputs(),
    findLatestInventoryDate(),
  ]);
  const rows = [...adjustments].flatMap(([itemId, adjustment]) => {
    const forecast = forecasts.get(itemId);
    if (!forecast) return [];
    const derived = deriveAiForecastFields(
      inputs,
      itemId,
      toForecastBasis(forecast),
      toUsageAdjustment(adjustment, forecast.forecast_date),
    );
    if (!derived) return [];
    return [
      {
        sync_run_id: syncRunId,
        item_id: itemId,
        forecast_id: forecast.forecast_id,
        source_ai_forecast_id: adjustment.originalAiForecastId,
        ...derived,
      },
    ];
  });
  if (rows.length > 0) {
    const { error } = await getDb().from("ai_forecasts").insert(rows);
    if (error) throw error;
  }
  return stockAsOf;
}
