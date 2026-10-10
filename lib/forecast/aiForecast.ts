import { sumUsage, usageOnDay, type DailyStockRow, type SupplyOrderRow, type UsageCurve } from "@/lib/forecast/demand";
import { projectStock, type StockProjection } from "@/lib/forecast/runout";

export type UsageAdjustment = {
  usageMultiplier: number;
  fadeDays: number | null;
  elapsedDays: number;
};

export type ForecastBasis = UsageCurve & { safetyStock: number; leadDays: number; coverDays: number };

export type AiForecastProjection = { projection: StockProjection; buyQty: number };

export function multiplierOnDay(adjustment: UsageAdjustment, h: number): number {
  if (adjustment.fadeDays === null) return adjustment.usageMultiplier;
  const remaining = Math.max(0, 1 - (h + adjustment.elapsedDays) / adjustment.fadeDays);
  return 1 + (adjustment.usageMultiplier - 1) * remaining;
}

export function aiUsageOnDay(curve: UsageCurve, adjustment: UsageAdjustment, h: number): number {
  return usageOnDay(curve, h) * multiplierOnDay(adjustment, h);
}

export function buildAiForecast(input: {
  basis: ForecastBasis;
  adjustment: UsageAdjustment;
  reorderLevel: number | null;
  dailyRows: DailyStockRow[];
  purchaseOrders: SupplyOrderRow[];
  dayOffset?: number;
}): AiForecastProjection | null {
  const { basis, adjustment } = input;
  const dayOffset = input.dayOffset ?? 0;
  const usage = (h: number) => aiUsageOnDay(basis, adjustment, h + dayOffset);
  const threshold = input.reorderLevel ?? sumUsage(usage, basis.leadDays) + basis.safetyStock;
  const projection = projectStock({
    dailyRows: input.dailyRows,
    purchaseOrders: input.purchaseOrders,
    usage,
    threshold,
  });
  if (!projection) return null;
  return { projection, buyQty: sumUsage(usage, basis.coverDays) + basis.safetyStock };
}
