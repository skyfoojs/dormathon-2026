import { created, errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";
import { usageOverDays } from "@/lib/forecast/demand";
import { computeItemForecasts, loadForecastInputs, runForecasts, type ItemForecast } from "@/lib/forecast/run";

// Computes the forecast for every item from live data. Nothing is saved.
export async function GET(req: Request) {
  try {
    const pagination = parsePagination(new URL(req.url).searchParams);
    const rows = computeItemForecasts(await loadForecastInputs()).map(toForecastDto);
    const [from, to] = toRange(pagination);
    return ok(rows.slice(from, to + 1), { ...pagination, total: rows.length });
  } catch (err) {
    return errorResponse(err);
  }
}

// The forecast run: score forecasts whose day has passed, then save the new ones.
export async function POST() {
  try {
    return created(await runForecasts());
  } catch (err) {
    return errorResponse(err);
  }
}

function toForecastDto({ item, forecast, projection }: ItemForecast) {
  return {
    ...forecast,
    weeklyForecastQty: usageOverDays(forecast, 7),
    threshold: projection.threshold,
    thresholdDate: projection.trigger?.date ?? null,
    stockoutDate: projection.stockoutDate,
    itemName: item.item_name,
    unit: item.unit,
    isCritical: item.is_critical === 1,
  };
}
