"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type { StockChartData } from "@/lib/data/dashboard";
import { formatShortDate } from "@/lib/data/dates";

type ChartPoint = {
  weekStart: string;
  label: string;
  closingStock: number | null;
  forecastLevel: number | null;
  p10: number | null;
  bandHeight: number | null;
};

function buildChartPoints(data: StockChartData): ChartPoint[] {
  const points: ChartPoint[] = data.history.map((h) => ({
    weekStart: h.weekStart,
    label: formatShortDate(h.weekStart),
    closingStock: h.closingStock,
    forecastLevel: null,
    p10: null,
    bandHeight: null,
  }));

  const bridge = points[points.length - 1];

  data.forecast.forEach((f) => {
    points.push({
      weekStart: f.weekStart,
      label: formatShortDate(f.weekStart),
      closingStock: null,
      forecastLevel: f.forecast,
      p10: f.p10,
      bandHeight: f.p90 - f.p10,
    });
  });

  if (bridge) {
    bridge.forecastLevel = bridge.closingStock;
    bridge.p10 = bridge.closingStock;
    bridge.bandHeight = 0;
  }

  return points;
}

function ReceiptShape({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: { expected: boolean };
}) {
  if (cx === undefined || cy === undefined) return null;
  const size = 7;
  const points = `${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`;
  const expected = payload?.expected ?? false;
  return (
    <polygon
      points={points}
      fill={expected ? "var(--color-card)" : "var(--color-navy)"}
      stroke="var(--color-navy)"
      strokeWidth={2}
    />
  );
}

export function StockChart({ data }: { data: StockChartData }) {
  const points = buildChartPoints(data);
  const maxValue = Math.max(
    data.reorderLevel,
    ...points.map((p) => Math.max(p.closingStock ?? 0, p.forecastLevel ?? 0, (p.p10 ?? 0) + (p.bandHeight ?? 0))),
  );
  const markerOffset = maxValue * 0.06;

  const receiptPoints = data.receipts.map((r) => {
    const point = points.find((p) => p.weekStart === r.weekStart);
    const level = point ? (point.closingStock ?? point.forecastLevel ?? 0) : 0;
    return { label: point?.label ?? formatShortDate(r.weekStart), markerY: level + markerOffset, expected: r.expected };
  });

  const tickLabels = points
    .filter((_, i) => i % 3 === 0 || i === points.length - 1)
    .map((p) => p.label);

  const forecastStart = points.find((p) => p.forecastLevel !== null && p.closingStock === null)?.label;
  const forecastEnd = points[points.length - 1]?.label;

  const summary = buildSummary(data);

  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={summary} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            {forecastStart && forecastEnd ? (
              <ReferenceArea
                x1={forecastStart}
                x2={forecastEnd}
                fill="var(--color-blue-tint)"
                fillOpacity={0.6}
              />
            ) : null}
            <XAxis
              dataKey="label"
              ticks={tickLabels}
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
              axisLine={{ stroke: "var(--color-line-strong)" }}
              tickLine={false}
            />
            <YAxis
              width={44}
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? value.toLocaleString() : value
              }
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
                fontSize: 12.5,
              }}
            />
            <Area
              dataKey="p10"
              stackId="band"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
            />
            <Area
              dataKey="bandHeight"
              stackId="band"
              stroke="var(--color-blue-light)"
              strokeWidth={1}
              fill="var(--color-blue-light)"
              fillOpacity={0.22}
              isAnimationActive={false}
              name="P10 to P90"
            />
            <ReferenceLine
              y={data.reorderLevel}
              stroke="var(--color-red)"
              strokeWidth={1.5}
              strokeDasharray="6 5"
              label={{
                value: `Reorder level ${data.reorderLevel}`,
                position: "insideTopRight",
                fill: "var(--color-red-dark)",
                fontSize: 11.5,
                fontFamily: "var(--font-mono)",
              }}
            />
            <Area
              type="monotone"
              dataKey="closingStock"
              stroke="var(--color-navy)"
              strokeWidth={2.5}
              fill="none"
              connectNulls
              isAnimationActive={false}
              name="Closing stock"
            />
            <Area
              type="monotone"
              dataKey="forecastLevel"
              stroke="var(--color-blue-light)"
              strokeWidth={3}
              fill="none"
              connectNulls
              isAnimationActive={false}
              name="Forecast"
            />
            <Scatter data={receiptPoints} dataKey="markerY" shape={ReceiptShape} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">{summary}</p>
    </div>
  );
}

function buildSummary(data: StockChartData): string {
  const last = data.history[data.history.length - 1];
  const lastForecast = data.forecast[data.forecast.length - 1];
  return (
    `Weekly closing stock for ${data.itemName}, now ${last.closingStock} units, ` +
    `forecast to reach about ${lastForecast.forecast} units ` +
    `(range ${lastForecast.p10} to ${lastForecast.p90}) in 4 weeks, ` +
    `against a reorder level of ${data.reorderLevel} units.`
  );
}
