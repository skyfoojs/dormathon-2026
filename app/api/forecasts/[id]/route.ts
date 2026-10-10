import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";
import { dayNumber, holtOnDay, sumUsage, usageOnDay, type UsageOnDay } from "@/lib/forecast/demand";
import { aiUsageOnDay, buildAiForecast } from "@/lib/forecast/aiForecast";
import { projectStock, stockHistory } from "@/lib/forecast/runout";
import { loadForecastInputs, type ForecastInputs } from "@/lib/forecast/run";
import {
  findForecastMadeBetween,
  findForecastsByIds,
  findLatestForecasts,
  toForecastBasis,
  type ForecastRow,
} from "@/lib/ai/algorithmic";
import { SYNC_RUN_COLUMNS, syncRunSchema, type SyncRun } from "@/lib/ai/sync";
import { getDb } from "@/lib/db";
import {
  findLatestAiForecasts,
  findRunAiForecasts,
  toUsageAdjustment,
  type LatestAiForecast,
} from "@/lib/ai/aiForecasts";
import type { ForecastItem } from "@/lib/queries/forecastInputs";

const idParamSchema = z.coerce.number().int().min(1);
const querySchema = z.object({ sync_run_id: z.coerce.number().int().min(1).optional() });

type Ctx = { params: Promise<{ id: string }> };

type ItemData = {
  item: ForecastItem;
  inputs: ForecastInputs;
  dayOffset: number;
};

// One item's demand forecast and its stock run-down projection.
export async function GET(req: Request, ctx: Ctx) {
  try {
    const itemId = idParamSchema.parse((await ctx.params).id);
    const { sync_run_id } = querySchema.parse({
      sync_run_id: new URL(req.url).searchParams.get("sync_run_id") ?? undefined,
    });
    return ok(await buildItemProjection(itemId, sync_run_id));
  } catch (err) {
    return errorResponse(err);
  }
}

async function buildItemProjection(itemId: number, syncRunId: number | undefined) {
  const [inputs, { forecast, latestAi }] = await Promise.all([
    loadForecastInputs(itemId),
    findForecastSources(itemId, syncRunId),
  ]);
  const item = inputs.items[0];
  if (!item) throw new NotFoundError(`Item ${itemId} not found`);
  const dailyRows = inputs.dailyByItem.get(itemId) ?? [];
  const history = stockHistory(dailyRows, dailyRows.length);
  if (history.length === 0) throw new NotFoundError(`Item ${itemId} has no stock history`);

  const data = forecast ? { item, inputs, dayOffset: daysSinceForecast(history, forecast) } : null;

  return {
    itemId,
    itemName: item.item_name,
    unit: item.unit,
    thresholdSource: item.reorder_level === null ? "reorder_point" : "reorder_level",
    history,
    algorithmic: forecast && data ? toAlgorithmicLine(forecast, data) : null,
    ai: forecast && data && latestAi ? toAiLine(forecast, latestAi, data) : null,
  };
}

async function findForecastSources(
  itemId: number,
  syncRunId: number | undefined,
): Promise<{ forecast: ForecastRow | null; latestAi: LatestAiForecast | null }> {
  if (syncRunId === undefined) {
    const [forecasts, aiForecasts] = await Promise.all([findLatestForecasts(itemId), findLatestAiForecasts(itemId)]);
    return { forecast: forecasts.get(itemId) ?? null, latestAi: aiForecasts.get(itemId) ?? null };
  }
  const latestAi = (await findRunAiForecasts(syncRunId, itemId)).get(itemId) ?? null;
  if (latestAi) {
    const forecast = (await findForecastsByIds([latestAi.forecastId])).get(latestAi.forecastId) ?? null;
    return { forecast, latestAi };
  }
  return { forecast: await findRunOwnForecast(itemId, await findRun(syncRunId)), latestAi: null };
}

async function findRun(syncRunId: number): Promise<SyncRun> {
  const { data, error } = await getDb()
    .from("sync_runs")
    .select(SYNC_RUN_COLUMNS)
    .eq("sync_run_id", syncRunId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError("Sync run not found");
  return syncRunSchema.parse(data);
}

async function findRunOwnForecast(itemId: number, run: SyncRun): Promise<ForecastRow | null> {
  if (run.scope !== "full") return null;
  return findForecastMadeBetween(itemId, run.started_at, run.finished_at ?? new Date().toISOString());
}

function daysSinceForecast(history: { date: string }[], forecast: ForecastRow): number {
  const lastActual = history[history.length - 1].date;
  return Math.max(0, dayNumber(lastActual) + 1 - dayNumber(forecast.forecast_date));
}

function toAlgorithmicLine(forecast: ForecastRow, { item, inputs, dayOffset }: ItemData) {
  const basis = toForecastBasis(forecast, item.cover_days);
  const usage = (h: number) => usageOnDay(basis, h + dayOffset);
  const threshold = item.reorder_level ?? forecast.threshold ?? sumUsage(usage, basis.leadDays) + basis.safetyStock;
  const project = (lineUsage: UsageOnDay) =>
    projectStock({
      dailyRows: inputs.dailyByItem.get(item.item_id) ?? [],
      purchaseOrders: inputs.purchaseOrdersByItem.get(item.item_id) ?? [],
      usage: lineUsage,
      threshold,
    });
  const projection = project(usage);
  if (!projection) return null;
  const holtPerDay = holtOnDay(basis, 1 + dayOffset);
  const wmaPerDay = basis.wmaQty;

  return {
    forecastId: forecast.forecast_id,
    madeAt: forecast.created_at,
    usagePerDay: usage(1),
    holtPerDay,
    wmaPerDay,
    holtWeight: basis.holtWeight,
    holtProjection: holtPerDay === null ? null : (project((h) => holtOnDay(basis, h + dayOffset) ?? 0)?.projection ?? null),
    wmaProjection: wmaPerDay === null ? null : (project(() => wmaPerDay)?.projection ?? null),
    weeklyForecastQty: sumUsage(usage, 7),
    coverDays: basis.coverDays,
    safetyStock: basis.safetyStock,
    buyQty: sumUsage(usage, basis.coverDays) + basis.safetyStock,
    projection: projection.projection,
    arrivals: projection.arrivals,
    threshold: projection.threshold,
    trigger: projection.trigger,
    stockoutDate: projection.stockoutDate,
  };
}

function toAiLine(forecast: ForecastRow, latestAi: LatestAiForecast, { item, inputs, dayOffset }: ItemData) {
  const basis = toForecastBasis(forecast, item.cover_days);
  const adjustment = toUsageAdjustment(latestAi, forecast.forecast_date);
  const aiForecast = buildAiForecast({
    basis,
    adjustment,
    reorderLevel: item.reorder_level ?? latestAi.threshold,
    dailyRows: inputs.dailyByItem.get(item.item_id) ?? [],
    purchaseOrders: inputs.purchaseOrdersByItem.get(item.item_id) ?? [],
    dayOffset,
  });
  if (!aiForecast) return null;
  const usage = (h: number) => aiUsageOnDay(basis, adjustment, h + dayOffset);
  const { projection } = aiForecast;

  return {
    aiForecastId: latestAi.aiForecastId,
    syncRunId: latestAi.syncRunId,
    reused: latestAi.reused,
    usageMultiplier: latestAi.usageMultiplier,
    fadeDays: latestAi.fadeDays,
    confidence: latestAi.confidence,
    reasoning: latestAi.reasoning,
    usagePerDay: usage(1),
    weeklyForecastQty: sumUsage(usage, 7),
    buyQty: aiForecast.buyQty,
    projection: projection.projection,
    arrivals: projection.arrivals,
    threshold: projection.threshold,
    trigger: projection.trigger,
    stockoutDate: projection.stockoutDate,
  };
}
