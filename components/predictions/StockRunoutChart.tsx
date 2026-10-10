"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ItemStockProjection } from "@/lib/api/resources";
import { formatShortDate } from "@/lib/data/dates";
import type { RestockTrigger, StockPoint } from "@/lib/forecast/runout";

type ChartPoint = { ts: number; actual?: number; algorithmic?: number; ai?: number };
type ForecastKey = "algorithmic" | "ai";

const AXIS_TICK = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" };
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LABEL_FONT = { fontSize: 11.5, fontFamily: "var(--font-mono)" };

const LINE_STYLE: Record<ForecastKey, { name: string; color: string; restockLabel: string }> = {
  algorithmic: { name: "Algorithmic forecast", color: "var(--color-blue-light)", restockLabel: "Restock" },
  ai: { name: "AI forecast", color: "var(--color-amber-border)", restockLabel: "AI restock" },
};

function toTs(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

function tsLabel(ts: number): string {
  return formatShortDate(new Date(ts).toISOString().slice(0, 10));
}

function buildChartPoints(data: ItemStockProjection): ChartPoint[] {
  const byTs = new Map<number, ChartPoint>();
  const add = (points: StockPoint[], key: keyof Omit<ChartPoint, "ts">) => {
    for (const p of points) {
      const ts = toTs(p.date);
      byTs.set(ts, { ...(byTs.get(ts) ?? { ts }), [key]: Math.round(p.stock) });
    }
  };
  add(data.history, "actual");
  if (data.algorithmic) add(data.algorithmic.projection, "algorithmic");
  if (data.ai) add(data.ai.projection, "ai");
  return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}

function triggerStock(projection: StockPoint[], trigger: RestockTrigger, threshold: number): number {
  return Math.round(projection.find((p) => p.date === trigger.date)?.stock ?? threshold);
}

export function StockRunoutChart({ data }: { data: ItemStockProjection }) {
  const points = buildChartPoints(data);
  const lastActual = data.history[data.history.length - 1];
  const lines = (["algorithmic", "ai"] as const).flatMap((key) => {
    const line = data[key];
    return line ? [{ key, line, style: LINE_STYLE[key] }] : [];
  });
  const summary = buildSummary(data);
  const weeklyTicks: number[] = [];
  for (let ts = points[0].ts; ts <= points[points.length - 1].ts; ts += WEEK_MS) weeklyTicks.push(ts);

  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={summary} className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 20, right: 48, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tsLabel}
              ticks={weeklyTicks}
              tick={AXIS_TICK}
              axisLine={{ stroke: "var(--color-line-strong)" }}
              tickLine={false}
            />
            <YAxis width={52} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip
              labelFormatter={(ts) => (typeof ts === "number" ? tsLabel(ts) : ts)}
              formatter={(value) => (typeof value === "number" ? value.toLocaleString() : value)}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
                fontSize: 12.5,
              }}
            />
            {lines.map(({ key, line, style }) => (
              <ReferenceLine
                key={`threshold-${key}`}
                y={Math.round(line.threshold)}
                stroke={key === "algorithmic" ? "var(--color-violet-text)" : style.color}
                strokeWidth={1.5}
                strokeDasharray={key === "algorithmic" ? undefined : "3 3"}
                label={{
                  value: Math.round(line.threshold).toLocaleString(),
                  position: "right",
                  fill: key === "algorithmic" ? "var(--color-violet-text)" : "var(--color-amber-text)",
                  ...LABEL_FONT,
                }}
              />
            ))}
            <ReferenceLine
              x={toTs(lastActual.date)}
              stroke="var(--color-line-strong)"
              strokeDasharray="4 4"
              label={{ value: "Last count", position: "top", fill: "var(--color-muted)", ...LABEL_FONT }}
            />
            {lines.map(({ key, line, style }) =>
              line.trigger && !line.trigger.alreadyReached ? (
                <ReferenceLine
                  key={`restock-${key}`}
                  x={toTs(line.trigger.date)}
                  stroke={style.color}
                  strokeDasharray="4 4"
                  label={{
                    value: `${style.restockLabel} ${formatShortDate(line.trigger.date)}`,
                    position: key === "algorithmic" ? "top" : "insideTopRight",
                    fill: key === "algorithmic" ? "var(--color-violet-text)" : "var(--color-amber-text)",
                    ...LABEL_FONT,
                  }}
                />
              ) : null,
            )}
            <Line
              type="linear"
              dataKey="actual"
              name="Actual stock"
              stroke="var(--color-green-text)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            {lines.map(({ key, style }) => (
              <Line
                key={`line-${key}`}
                type="linear"
                dataKey={key}
                name={style.name}
                stroke={style.color}
                strokeWidth={2.5}
                strokeDasharray="7 5"
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {lines.map(({ key, line, style }) =>
              line.trigger ? (
                <ReferenceDot
                  key={`dot-${key}`}
                  x={toTs(line.trigger.date)}
                  y={triggerStock(line.projection, line.trigger, line.threshold)}
                  r={6}
                  fill={key === "algorithmic" ? "var(--color-violet-text)" : style.color}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
              ) : null,
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">{summary}</p>
    </div>
  );
}

function describeLine(label: string, line: NonNullable<ItemStockProjection[ForecastKey]>): string {
  const trigger = line.trigger;
  const triggerText = !trigger
    ? "does not reach its restock trigger in the next 12 weeks"
    : trigger.alreadyReached
      ? "is already at or below its restock trigger"
      : `reaches its restock trigger on ${formatShortDate(trigger.date)}, ${trigger.daysFromLastActual} days after the last count`;
  return `The ${label} falls by about ${Math.round(line.weeklyForecastQty).toLocaleString()} a week and ${triggerText}.`;
}

function buildSummary(data: ItemStockProjection): string {
  const last = data.history[data.history.length - 1];
  const parts = [
    `Stock for ${data.itemName}: ${last.stock.toLocaleString()} ${data.unit} at the last count on ${formatShortDate(last.date)}.`,
    data.algorithmic ? describeLine("algorithmic forecast", data.algorithmic) : "No algorithmic forecast yet.",
    data.ai ? describeLine("AI forecast", data.ai) : "No AI forecast yet.",
  ];
  return parts.join(" ");
}
