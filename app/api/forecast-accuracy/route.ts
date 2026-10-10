import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";
import { buildItemAccuracy, type ItemAccuracy, type SavedForecast } from "@/lib/forecast/accuracy";
import type { DailyStockRow } from "@/lib/forecast/demand";
import { findDailyStockRows, findForecastItems } from "@/lib/queries/forecastInputs";

type ForecastRunRow = { forecast_id: number; item_id: number; forecast_date: string; usage_per_day: number };
type AiRunRow = { forecast_id: number | null; usage_multiplier: number | null; created_at: string };

// Weekly prediction accuracy for every item, most accurate first.
export async function GET(req: Request) {
  try {
    const pagination = parsePagination(new URL(req.url).searchParams);
    const accuracy = await buildAccuracyForAllItems();
    const [from, to] = toRange(pagination);
    return ok(accuracy.slice(from, to + 1), { ...pagination, total: accuracy.length });
  } catch (err) {
    return errorResponse(err);
  }
}

async function buildAccuracyForAllItems(): Promise<ItemAccuracy[]> {
  const [items, dailyRows, forecastRuns, aiRuns] = await Promise.all([
    findForecastItems(),
    findDailyStockRows(),
    findForecastRuns(),
    findAiRuns(),
  ]);
  const dailyByItem = groupByItem(dailyRows);
  const savedByItem = toSavedForecastsByItem(forecastRuns, aiRuns);

  return items
    .map((item) =>
      buildItemAccuracy({
        itemId: item.item_id,
        itemName: item.item_name,
        dailyRows: dailyByItem.get(item.item_id) ?? [],
        savedForecasts: savedByItem.get(item.item_id) ?? [],
      }),
    )
    .filter((a) => a.weeksScored > 0)
    .sort((a, b) => b.accuracy - a.accuracy);
}

async function findForecastRuns(): Promise<ForecastRunRow[]> {
  const { data, error } = await getDb()
    .from("demand_forecasts")
    .select("forecast_id, item_id, forecast_date, usage_per_day")
    .not("usage_per_day", "is", null)
    .order("forecast_id");
  if (error) throw error;
  return data ?? [];
}

async function findAiRuns(): Promise<AiRunRow[]> {
  const { data, error } = await getDb()
    .from("ai_forecasts")
    .select("forecast_id, usage_multiplier, created_at")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

function groupByItem(rows: DailyStockRow[]): Map<number, DailyStockRow[]> {
  const groups = new Map<number, DailyStockRow[]>();
  for (const row of rows) {
    const list = groups.get(row.item_id);
    if (list) list.push(row);
    else groups.set(row.item_id, [row]);
  }
  return groups;
}

// Pairs each forecast run with the newest AI run that used it. aiRuns arrive
// oldest first, so a later one overwrites an earlier one.
function toSavedForecastsByItem(forecastRuns: ForecastRunRow[], aiRuns: AiRunRow[]): Map<number, SavedForecast[]> {
  const multiplierByForecast = new Map<number, number | null>();
  for (const run of aiRuns) {
    if (run.forecast_id !== null) multiplierByForecast.set(run.forecast_id, run.usage_multiplier);
  }
  const byItem = new Map<number, SavedForecast[]>();
  for (const run of forecastRuns) {
    const saved: SavedForecast = {
      forecastDate: run.forecast_date.slice(0, 10),
      usagePerDay: run.usage_per_day,
      usageMultiplier: multiplierByForecast.get(run.forecast_id) ?? null,
    };
    const list = byItem.get(run.item_id);
    if (list) list.push(saved);
    else byItem.set(run.item_id, [saved]);
  }
  return byItem;
}
