import "server-only";
import { findLatestAiForecasts, toUsageAdjustment } from "@/lib/ai/aiForecasts";
import { findLatestForecasts, toForecastBasis } from "@/lib/ai/algorithmic";
import { loadForecastInputs } from "@/lib/forecast/run";
import type { RestockInput, SavedPrediction } from "@/lib/orders/restockPlan";

// Everything the restock rules need: stock, orders, and each item's latest
// saved prediction (the same rows the Predictions page reads).
export async function loadRestockInputs(): Promise<RestockInput> {
  const [inputs, forecasts, aiForecasts] = await Promise.all([
    loadForecastInputs(),
    findLatestForecasts(),
    findLatestAiForecasts(),
  ]);

  const coverDaysByItem = new Map(inputs.items.map((item) => [item.item_id, item.cover_days]));
  const predictions = new Map<number, SavedPrediction>();
  for (const [itemId, forecast] of forecasts) {
    const ai = aiForecasts.get(itemId);
    predictions.set(itemId, {
      forecastDate: forecast.forecast_date,
      basis: toForecastBasis(forecast, coverDaysByItem.get(itemId)),
      threshold: forecast.threshold,
      ai: ai ? { adjustment: toUsageAdjustment(ai, forecast.forecast_date), threshold: ai.threshold } : null,
    });
  }

  return {
    items: inputs.items,
    suppliers: inputs.suppliers,
    dailyByItem: inputs.dailyByItem,
    ordersByItem: inputs.purchaseOrdersByItem,
    predictions,
  };
}
