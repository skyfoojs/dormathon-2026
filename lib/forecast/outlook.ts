import { dayNumber, type DailyStockRow, type SupplyOrderRow } from "@/lib/forecast/demand";
import { buildAiForecast, type ForecastBasis } from "@/lib/forecast/aiForecast";

export type UsageOutlook =
  | { kind: "until"; usage: number; days: number; date: string; threshold: number }
  | { kind: "already"; threshold: number }
  | { kind: "beyond"; threshold: number };

export function usageOutlook(input: {
  basis: ForecastBasis;
  forecastDate: string;
  usageMultiplier: number;
  fadeDays: number | null;
  reorderLevel: number | null;
  dailyRows: DailyStockRow[];
  purchaseOrders: SupplyOrderRow[];
}): UsageOutlook | null {
  const lastDate = input.dailyRows.reduce<string | null>(
    (latest, row) => (latest === null || row.inventory_date > latest ? row.inventory_date : latest),
    null,
  );
  if (lastDate === null) return null;
  const forecast = buildAiForecast({
    basis: input.basis,
    adjustment: { usageMultiplier: input.usageMultiplier, fadeDays: input.fadeDays, elapsedDays: 0 },
    reorderLevel: input.reorderLevel,
    dailyRows: input.dailyRows,
    purchaseOrders: input.purchaseOrders,
    dayOffset: Math.max(0, dayNumber(lastDate) + 1 - dayNumber(input.forecastDate)),
  });
  if (!forecast) return null;
  const { trigger, threshold } = forecast.projection;
  if (!trigger) return { kind: "beyond", threshold };
  if (trigger.alreadyReached) return { kind: "already", threshold };
  return { kind: "until", usage: trigger.demandUntilTrigger, days: trigger.daysFromLastActual, date: trigger.date, threshold };
}
