import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";
import { dayNumber, sumUsage, usageOnDay } from "@/lib/forecast/demand";
import { aiUsageOnDay, buildAiForecast } from "@/lib/forecast/aiForecast";
import { projectStock, stockHistory } from "@/lib/forecast/runout";
import { loadForecastInputs, type ForecastInputs } from "@/lib/forecast/run";
import { findLatestForecasts, toForecastBasis, type ForecastRow } from "@/lib/ai/algorithmic";
import { findLatestAiForecasts, toUsageAdjustment, type LatestAiForecast } from "@/lib/ai/aiForecasts";
import type { ForecastItem } from "@/lib/queries/forecastInputs";

const idParamSchema = z.coerce.number().int().min(1);

type Ctx = { params: Promise<{ id: string }> };

type ItemData = {
  item: ForecastItem;
  inputs: ForecastInputs;
  dayOffset: number;
};

// One item's demand forecast and its stock run-down projection.
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const itemId = idParamSchema.parse((await ctx.params).id);
    return ok(await buildItemProjection(itemId));
  } catch (err) {
    return errorResponse(err);
  }
}

async function buildItemProjection(itemId: number) {
  const [inputs, forecasts, aiForecasts] = await Promise.all([
    loadForecastInputs(itemId),
    findLatestForecasts(itemId),
    findLatestAiForecasts(itemId),
  ]);
  const item = inputs.items[0];
  if (!item) throw new NotFoundError(`Item ${itemId} not found`);
  const history = stockHistory(inputs.dailyByItem.get(itemId) ?? []);
  if (history.length === 0) throw new NotFoundError(`Item ${itemId} has no stock history`);

  const forecast = forecasts.get(itemId) ?? null;
  const latestAi = aiForecasts.get(itemId) ?? null;
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

function daysSinceForecast(history: { date: string }[], forecast: ForecastRow): number {
  const lastActual = history[history.length - 1].date;
  return Math.max(0, dayNumber(lastActual) + 1 - dayNumber(forecast.forecast_date));
}

function toAlgorithmicLine(forecast: ForecastRow, { item, inputs, dayOffset }: ItemData) {
  const basis = toForecastBasis(forecast);
  const usage = (h: number) => usageOnDay(basis, h + dayOffset);
  const projection = projectStock({
    dailyRows: inputs.dailyByItem.get(item.item_id) ?? [],
    purchaseOrders: inputs.purchaseOrdersByItem.get(item.item_id) ?? [],
    usage,
    threshold: item.reorder_level ?? forecast.threshold ?? sumUsage(usage, basis.leadDays) + basis.safetyStock,
  });
  if (!projection) return null;

  return {
    forecastId: forecast.forecast_id,
    madeAt: forecast.created_at,
    usagePerDay: usage(1),
    weeklyForecastQty: sumUsage(usage, 7),
    coverDays: basis.coverDays,
    safetyStock: basis.safetyStock,
    buyQty: forecast.buy_qty,
    projection: projection.projection,
    arrivals: projection.arrivals,
    threshold: projection.threshold,
    trigger: projection.trigger,
    stockoutDate: projection.stockoutDate,
  };
}

function toAiLine(forecast: ForecastRow, latestAi: LatestAiForecast, { item, inputs, dayOffset }: ItemData) {
  const basis = toForecastBasis(forecast);
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
    buyQty: latestAi.buyQty ?? aiForecast.buyQty,
    projection: projection.projection,
    arrivals: projection.arrivals,
    threshold: projection.threshold,
    trigger: projection.trigger,
    stockoutDate: projection.stockoutDate,
  };
}
