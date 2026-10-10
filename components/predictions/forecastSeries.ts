import type { ChartArrival, ChartMarker, ChartSeries, ChartThreshold } from "@/components/predictions/StockChart";
import type { ItemStockProjection } from "@/lib/api/resources";
import type { Arrival, RestockTrigger, StockPoint } from "@/lib/forecast/runout";
import { formatQuantity } from "@/lib/data/units";

const THRESHOLD_LABEL: Record<ItemStockProjection["thresholdSource"], string> = {
  reorder_level: "Reorder level (set)",
  reorder_point: "Reorder point",
};

export function actualSeries(data: ItemStockProjection): ChartSeries {
  return {
    key: "actual",
    name: "Actual stock",
    points: data.history,
    color: "var(--color-green-text)",
    swatch: "border-green-text",
  };
}

export function averageSeries(points: StockPoint[], name = "Average of the two (weighted)"): ChartSeries {
  return { key: "average", name, points, color: "var(--color-ink)", swatch: "border-ink", dashed: "dot" };
}

export function holtSeries(points: StockPoint[]): ChartSeries {
  return { key: "holt", name: "Holt linear trend", points, color: "var(--color-red)", swatch: "border-red" };
}

export function wmaSeries(points: StockPoint[]): ChartSeries {
  return {
    key: "wma",
    name: "Weighted moving average",
    points,
    color: "var(--color-blue-light)",
    swatch: "border-blue-light",
  };
}

export function aiSeries(points: StockPoint[]): ChartSeries {
  return {
    key: "ai",
    name: "AI forecast",
    points,
    color: "var(--color-amber-border)",
    swatch: "border-amber-border",
    dashed: "dash",
  };
}

export function thresholdLine(data: ItemStockProjection, value: number): ChartThreshold {
  return {
    value,
    label: THRESHOLD_LABEL[data.thresholdSource],
    color: "var(--color-violet-text)",
    swatch: "border-violet-text",
  };
}

export function triggerMarker(
  projection: StockPoint[],
  trigger: RestockTrigger | null,
  threshold: number,
  color: string,
): ChartMarker[] {
  if (!trigger) return [];
  const value = projection.find((p) => p.date === trigger.date)?.stock ?? threshold;
  return [{ date: trigger.date, value, color }];
}

export function arrivalMarkers(projection: StockPoint[], arrivals: Arrival[]): ChartArrival[] {
  return arrivals.map((a) => ({
    date: a.date,
    value: projection.find((p) => p.date === a.date)?.stock ?? 0,
    label: `+${a.qty.toLocaleString()} · PO #${a.poIds.join(", #")}${a.late ? " (late)" : ""}`,
    late: a.late,
  }));
}

export function formatQty(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined ? "None" : formatQuantity(value, unit);
}
