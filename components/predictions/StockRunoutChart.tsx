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

type ChartPoint = { ts: number; actual?: number; projected?: number };

const AXIS_TICK = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" };
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LABEL_FONT = { fontSize: 11.5, fontFamily: "var(--font-mono)" };

function toTs(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

function tsLabel(ts: number): string {
  return formatShortDate(new Date(ts).toISOString().slice(0, 10));
}

function buildChartPoints(data: ItemStockProjection): ChartPoint[] {
  const byTs = new Map<number, ChartPoint>();
  for (const p of data.history) byTs.set(toTs(p.date), { ts: toTs(p.date), actual: p.stock });
  for (const p of data.projection) {
    const ts = toTs(p.date);
    byTs.set(ts, { ...(byTs.get(ts) ?? { ts }), projected: Math.round(p.stock) });
  }
  return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}

export function StockRunoutChart({ data }: { data: ItemStockProjection }) {
  const points = buildChartPoints(data);
  const lastActual = data.history[data.history.length - 1];
  const threshold = Math.round(data.threshold);
  const trigger = data.trigger;
  const triggerStock = trigger
    ? Math.round(data.projection.find((p) => p.date === trigger.date)?.stock ?? data.threshold)
    : null;
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
            <ReferenceLine
              y={threshold}
              stroke="var(--color-violet-text)"
              strokeWidth={1.5}
              label={{
                value: threshold.toLocaleString(),
                position: "right",
                fill: "var(--color-violet-text)",
                ...LABEL_FONT,
              }}
            />
            <ReferenceLine
              x={toTs(lastActual.date)}
              stroke="var(--color-line-strong)"
              strokeDasharray="4 4"
              label={{ value: "Last count", position: "top", fill: "var(--color-muted)", ...LABEL_FONT }}
            />
            {trigger && !trigger.alreadyReached ? (
              <ReferenceLine
                x={toTs(trigger.date)}
                stroke="var(--color-violet-text)"
                strokeDasharray="4 4"
                label={{
                  value: `Restock ${formatShortDate(trigger.date)}`,
                  position: "top",
                  fill: "var(--color-violet-text)",
                  ...LABEL_FONT,
                }}
              />
            ) : null}
            <Line
              type="linear"
              dataKey="actual"
              name="Actual stock"
              stroke="var(--color-green-text)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="projected"
              name="Projected stock"
              stroke="var(--color-blue-light)"
              strokeWidth={2.5}
              strokeDasharray="7 5"
              dot={false}
              isAnimationActive={false}
            />
            {trigger && triggerStock !== null ? (
              <ReferenceDot
                x={toTs(trigger.date)}
                y={triggerStock}
                r={6}
                fill="var(--color-violet-text)"
                stroke="var(--color-card)"
                strokeWidth={2}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">{summary}</p>
    </div>
  );
}

function buildSummary(data: ItemStockProjection): string {
  const last = data.history[data.history.length - 1];
  const trigger = data.trigger;
  const triggerText = !trigger
    ? "The projection does not reach the restock trigger in the next 12 weeks."
    : trigger.alreadyReached
      ? "Stock is already at or below the restock trigger."
      : `The projection reaches the restock trigger on ${formatShortDate(trigger.date)}, ${trigger.daysFromLastActual} days after the last count.`;
  return (
    `Stock for ${data.itemName}: ${last.stock.toLocaleString()} ${data.unit} at the last count on ` +
    `${formatShortDate(last.date)}, projected to fall by about ${Math.round(data.weeklyForecastQty).toLocaleString()} a week. ` +
    `The restock trigger is ${Math.round(data.threshold).toLocaleString()}. ${triggerText}`
  );
}
