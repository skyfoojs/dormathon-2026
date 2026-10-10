"use client";

import * as React from "react";
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear } from "date-fns";
import {
  Brush,
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
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import type { StockPoint } from "@/lib/forecast/runout";

export type ChartSeries = {
  key: string;
  name: string;
  points: StockPoint[];
  color: string;
  swatch: string;
  dashed?: "dash" | "dot";
};

export type ChartThreshold = { value: number; label: string; color: string; swatch: string };
export type ChartMarker = { date: string; value: number; color: string };

type Timeframe = "daily" | "monthly" | "yearly" | "all";
type ChartPoint = { ts: number } & Record<string, number>;

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "all", label: "All time" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const AXIS_TICK = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" };
const LABEL_FONT = { fontSize: 11.5, fontFamily: "var(--font-mono)" };
const DASH: Record<NonNullable<ChartSeries["dashed"]>, string> = { dash: "7 5", dot: "1 6" };
const SWATCH_DASH: Record<NonNullable<ChartSeries["dashed"]>, string> = { dash: "border-dashed", dot: "border-dotted" };

function toTs(isoDate: string): number {
  return Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

function tsLabel(ts: number): string {
  return format(new Date(ts), "d MMM yy");
}

function todayTs(): number {
  return toTs(format(new Date(), "yyyy-MM-dd"));
}

function buildPoints(series: ChartSeries[], today: number): ChartPoint[] {
  const byTs = new Map<number, ChartPoint>([[today, { ts: today } as ChartPoint]]);
  for (const s of series) {
    for (const p of s.points) {
      const ts = toTs(p.date);
      const point = byTs.get(ts) ?? ({ ts } as ChartPoint);
      point[s.key] = Math.round(p.stock);
      byTs.set(ts, point);
    }
  }
  return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}

function seriesSignature(series: ChartSeries[]): string {
  return series
    .map((s) => `${s.key}:${s.points.length}:${s.points[0]?.date}:${s.points.at(-1)?.date}:${s.points.at(-1)?.stock}`)
    .join("|");
}

function windowFor(timeframe: Timeframe, today: number): [number, number] | null {
  const now = new Date(today);
  if (timeframe === "daily") return [today - 3 * DAY_MS, today + 3 * DAY_MS];
  if (timeframe === "monthly") return [startOfMonth(now).getTime(), endOfMonth(now).getTime()];
  if (timeframe === "yearly") return [startOfYear(now).getTime(), endOfYear(now).getTime()];
  return null;
}

function indexRange(points: ChartPoint[], window: [number, number] | null): [number, number] {
  const last = points.length - 1;
  if (!window) return [0, last];
  const start = points.findIndex((p) => p.ts >= window[0]);
  const end = points.findLastIndex((p) => p.ts <= window[1]);
  if (start === -1 || end === -1 || end - start < 1) return [0, last];
  return [start, end];
}

export function StockChartLegend({ series, thresholds }: { series: ChartSeries[]; thresholds: ChartThreshold[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-strong-muted">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("inline-block w-5 border-t-2", s.swatch, s.dashed && SWATCH_DASH[s.dashed])} />
          {s.name}
        </li>
      ))}
      {thresholds.map((t) => (
        <li key={t.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("inline-block w-5 border-t-2", t.swatch)} />
          {t.label}
        </li>
      ))}
    </ul>
  );
}

export function StockChart({
  series,
  thresholds = [],
  markers = [],
  summary,
}: {
  series: ChartSeries[];
  thresholds?: ChartThreshold[];
  markers?: ChartMarker[];
  summary: string;
}) {
  const [timeframe, setTimeframe] = React.useState<Timeframe>("monthly");
  const [today] = React.useState(todayTs);
  const [range, setRange] = React.useState<[number, number] | null>(null);
  const signature = seriesSignature(series);
  const points = React.useMemo(() => buildPoints(series, today), [series, today]);
  const yMax = Math.max(0, ...thresholds.map((t) => Math.round(t.value)));
  const [startIndex, endIndex] = range ?? [0, points.length - 1];

  React.useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      setRange(null);
      inner = requestAnimationFrame(() => setRange(indexRange(points, windowFor(timeframe, today))));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [points, timeframe, today]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StockChartLegend series={series} thresholds={thresholds} />
        <Segmented
          label="Timeframe"
          options={TIMEFRAMES}
          value={timeframe}
          onChange={setTimeframe}
          className="max-w-full overflow-x-auto"
        />
      </div>
      <div role="img" aria-label={summary} className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 20, right: 48, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tsLabel}
              minTickGap={24}
              tick={AXIS_TICK}
              axisLine={{ stroke: "var(--color-line-strong)" }}
              tickLine={false}
            />
            <YAxis
              width={52}
              domain={[0, (dataMax: number) => Math.max(dataMax, yMax)]}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
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
            {thresholds.map((t) => (
              <ReferenceLine
                key={t.label}
                y={Math.round(t.value)}
                stroke={t.color}
                strokeWidth={1.5}
                label={{ value: Math.round(t.value).toLocaleString(), position: "right", fill: t.color, ...LABEL_FONT }}
              />
            ))}
            <ReferenceLine
              x={today}
              stroke="var(--color-navy)"
              strokeDasharray="4 4"
              label={{ value: "Today", position: "top", fill: "var(--color-navy)", ...LABEL_FONT }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2.5}
                strokeDasharray={s.dashed ? DASH[s.dashed] : undefined}
                strokeLinecap="round"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {markers.map((m) => (
              <ReferenceDot
                key={`${m.date}-${m.color}`}
                x={toTs(m.date)}
                y={Math.round(m.value)}
                r={6}
                fill={m.color}
                stroke="var(--color-card)"
                strokeWidth={2}
              />
            ))}
            <Brush
              key={signature}
              dataKey="ts"
              height={28}
              startIndex={startIndex}
              endIndex={endIndex}
              travellerWidth={10}
              tickFormatter={tsLabel}
              stroke="var(--color-navy)"
              fill="var(--color-page)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">{summary}</p>
    </div>
  );
}
