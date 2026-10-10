import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ConflictError } from "@/lib/errors";
import { errorMessage } from "@/lib/ai/errors";
import { ingestNews } from "@/lib/ai/ingest";
import { screenPendingArticles } from "@/lib/ai/screener";
import { runCycle1 } from "@/lib/ai/cycle1";
import { runCycle2 } from "@/lib/ai/cycle2";
import { findLatestForecasts, findLatestInventoryDate } from "@/lib/ai/internal";

export type SyncTrigger = "manual" | "hourly" | "daily";
export type SyncScope = "news" | "full";
type SyncStage = "fetching_news" | "screening" | "cycle1" | "cycle2" | "reusing_last_verdict" | "done";

export const SYNC_TIMEOUT_SECONDS = 300;
export const MAX_SYNC_COST_USD = 1;

const UNIQUE_VIOLATION = "23505";
const SUGGESTION_LOOKBACK_ROWS = 2000;

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
const countSchema = z.number();
const previousSuggestionSchema = z.object({
  suggestion_id: z.number(),
  item_id: z.number(),
  council_run_id: z.number().nullable(),
  source_suggestion_id: z.number().nullable(),
});

type PreviousSuggestion = z.infer<typeof previousSuggestionSchema>;

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

export async function executeSyncRun(syncRunId: number): Promise<void> {
  try {
    const stockAsOf = await runPipeline(syncRunId);
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

async function runPipeline(syncRunId: number): Promise<string | null> {
  await setStage(syncRunId, "fetching_news");
  const ingest = await ingestNews(syncRunId);
  if (ingest.failedSources.length > 0) {
    console.error(`Sync run ${syncRunId}: news sources failed`, ingest.failedSources);
  }

  if (ingest.newArticleIds.length === 0 && (await countPendingArticles()) === 0) {
    await setStage(syncRunId, "reusing_last_verdict");
    return reuseLastSuggestions(syncRunId);
  }

  await setStage(syncRunId, "screening");
  await screenPendingArticles(syncRunId);
  await assertWithinCostCap(syncRunId);

  await setStage(syncRunId, "cycle1");
  await runCycle1(syncRunId);
  await assertWithinCostCap(syncRunId);

  await setStage(syncRunId, "cycle2");
  const cycle2 = await runCycle2(syncRunId);
  return cycle2.stockAsOf;
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

async function reuseLastSuggestions(syncRunId: number): Promise<string | null> {
  const [previous, forecasts, stockAsOf] = await Promise.all([
    findLatestSuggestionPerItem(),
    findLatestForecasts(),
    findLatestInventoryDate(),
  ]);
  const rows = previous.flatMap((suggestion) => {
    const forecast = forecasts.get(suggestion.item_id);
    if (!forecast) return [];
    return [
      {
        sync_run_id: syncRunId,
        item_id: suggestion.item_id,
        forecast_id: forecast.forecast_id,
        source_suggestion_id: suggestion.council_run_id ? suggestion.suggestion_id : suggestion.source_suggestion_id,
      },
    ];
  });
  if (rows.length > 0) {
    const { error } = await getDb().from("ai_suggestions").insert(rows);
    if (error) throw error;
  }
  return stockAsOf;
}

async function findLatestSuggestionPerItem(): Promise<PreviousSuggestion[]> {
  const { data, error } = await getDb()
    .from("ai_suggestions")
    .select("suggestion_id, item_id, council_run_id, source_suggestion_id")
    .order("suggestion_id", { ascending: false })
    .limit(SUGGESTION_LOOKBACK_ROWS);
  if (error) throw error;
  const latest = new Map<number, PreviousSuggestion>();
  for (const row of z.array(previousSuggestionSchema).parse(data)) {
    if (!latest.has(row.item_id)) latest.set(row.item_id, row);
  }
  return [...latest.values()];
}
