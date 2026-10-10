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

  const predictions = new Map<number, SavedPrediction>();
  for (const [itemId, forecast] of forecasts) {
    const ai = aiForecasts.get(itemId);
    predictions.set(itemId, {
      forecastDate: forecast.forecast_date,
      basis: toForecastBasis(forecast),
      threshold: forecast.threshold,
      buyQty: forecast.buy_qty,
      ai: ai
        ? { adjustment: toUsageAdjustment(ai, forecast.forecast_date), threshold: ai.threshold, buyQty: ai.buyQty }
        : null,
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
