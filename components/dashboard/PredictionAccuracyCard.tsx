"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/data/dates";
import { accuracyTheme } from "@/lib/data/kpiStyle";
import type { OverallAccuracy, OverallAccuracyPoint } from "@/lib/forecast/accuracy";

const AXIS_TICK = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" };
const CHART_MARGIN = { top: 16, right: 28, bottom: 4, left: 0 };
const QTY = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 });
const COMPACT = new Intl.NumberFormat("en-MY", { notation: "compact", maximumFractionDigits: 1 });

type ChartPoint = OverallAccuracyPoint & { label: string; aiAccuracy: number | null };

function WeekTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md">
      <span className="font-mono text-muted">Week of {formatShortDate(point.weekStart)}</span>
      <span className="font-mono text-sm font-semibold">{point.accuracy.toFixed(1)}% accurate</span>
      <span>Predicted {QTY.format(point.predictedQty)} units</span>
      <span>Actual {QTY.format(point.actualQty)} units</span>
      <span className="text-muted">
        {point.aiItems > 0
          ? `${point.aiItems} of ${point.itemsScored} items use the AI and arithmetic average`
          : `${point.itemsScored} items, arithmetic forecast only`}
      </span>
    </div>
  );
}

function LegendItem({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block ${swatch}`} aria-hidden="true" />
      {children}
    </span>
  );
}

// An accuracy value is coloured by the same bands as the dashboard KPI card
// (90 and over green, 80 and over amber, below that red). Other values stay neutral.
function StatTile({ label, value, accuracy }: { label: string; value: string; accuracy?: number }) {
  const theme = accuracy === undefined ? null : accuracyTheme(accuracy);
  return (
    <div className={cn("rounded-md border p-3.5", theme ? [theme.tileBorder, theme.tint] : "border-line bg-page")}>
      <p className="font-mono text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={cn("font-mono text-2xl font-medium", theme ? theme.valueText : "text-ink")}>{value}</p>
    </div>
  );
}

// Prediction accuracy across every item, week by week, and the predicted
// and actual usage those scores come from.
export function PredictionAccuracyCard({ overall }: { overall: OverallAccuracy }) {
  const chartData: ChartPoint[] = overall.points.map((p) => ({
    ...p,
    label: formatShortDate(p.weekStart),
    aiAccuracy: p.aiItems > 0 ? p.accuracy : null,
  }));
  const hasData = chartData.length > 0;
  const latest = chartData[chartData.length - 1];

  const summary = hasData
    ? `Prediction accuracy across ${overall.itemsScored} items over ${overall.weeksScored} weeks, averaging ${overall.accuracy.toFixed(1)} percent, with ${latest.accuracy.toFixed(1)} percent in the latest week.`
    : "Not enough history to score prediction accuracy yet.";

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <CardTitle>Prediction accuracy</CardTitle>
        <p className="text-sm text-muted">
          How close each week&apos;s predicted usage was to what was actually used, across all items.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Average accuracy"
          value={hasData ? `${overall.accuracy.toFixed(1)}%` : "—"}
          accuracy={hasData ? overall.accuracy : undefined}
        />
        <StatTile
          label="Latest week"
          value={latest ? `${latest.accuracy.toFixed(1)}%` : "—"}
          accuracy={latest?.accuracy}
        />
        <StatTile label="Items scored" value={hasData ? String(overall.itemsScored) : "—"} />
      </div>

      {!hasData ? (
        <p className="rounded-md bg-page p-12 text-center text-sm text-muted">
          Not enough history to score predictions yet.
        </p>
      ) : (
        <div role="img" aria-label={summary} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-base font-semibold">Accuracy by week</h3>
            <div className="flex flex-wrap items-center gap-4 text-xs text-strong-muted">
              <LegendItem swatch="w-5 border-t-2 border-navy">Accuracy</LegendItem>
              <LegendItem swatch="h-3 w-3 rounded-full bg-green-text">Includes AI predictions</LegendItem>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={CHART_MARGIN}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    axisLine={{ stroke: "var(--color-line-strong)" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    width={44}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(value: number) => `${value}%`}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<WeekTooltip />} />
                  <Line
                    type="linear"
                    dataKey="accuracy"
                    stroke="var(--color-navy)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-navy)" }}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="aiAccuracy"
                    stroke="none"
                    dot={{ r: 6, fill: "var(--color-green-text)", stroke: "var(--color-card)", strokeWidth: 2 }}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-base font-semibold">Predicted vs actual usage</h3>
            <div className="flex flex-wrap items-center gap-4 text-xs text-strong-muted">
              <LegendItem swatch="w-5 border-t-2 border-navy">Actual units</LegendItem>
              <LegendItem swatch="w-5 border-t-2 border-dashed border-blue-light">Predicted units</LegendItem>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={CHART_MARGIN}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    axisLine={{ stroke: "var(--color-line-strong)" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    width={44}
                    tickFormatter={(value: number) => COMPACT.format(value)}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<WeekTooltip />} />
                  <Line
                    type="linear"
                    dataKey="actualQty"
                    stroke="var(--color-navy)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--color-navy)" }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="predictedQty"
                    stroke="var(--color-blue-light)"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
      <p className="sr-only">{summary}</p>

    </Card>
  );
}
