"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/Card";
import { ProvenanceTag, Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/data/dates";
import type { ExpectedVsActualPoint, ProductAccuracy } from "@/lib/data/dashboardReports";

function barColor(accuracy: number): string {
  if (accuracy >= 90) return "bg-green-text";
  if (accuracy >= 80) return "bg-amber-border";
  return "bg-red";
}

export function ExpectedVsActualCard({
  itemName,
  points,
  stats,
  products,
  selectedItemId,
  onSelectItem,
  sample = false,
}: {
  itemName: string;
  points: ExpectedVsActualPoint[];
  stats: ProductAccuracy | null;
  products: ProductAccuracy[];
  selectedItemId: number | null;
  onSelectItem: (itemId: number) => void;
  sample?: boolean;
}) {
  const forecastStart = points.find((p) => p.actual === null)?.weekStart;
  const forecastEnd = points[points.length - 1]?.weekStart;
  const chartData = points.map((p) => ({
    label: formatShortDate(p.weekStart),
    weekStart: p.weekStart,
    actual: p.actual,
    expected: p.expected,
  }));

  const summary = stats
    ? `${itemName}: accuracy ${stats.accuracy.toFixed(1)} percent, average miss ${stats.avgMissUnits.toFixed(1)} units per week, ${stats.weeksWithin10Pct} of ${stats.weeksScored} weeks within 10 percent.`
    : `${itemName}: not enough history to score accuracy yet.`;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{itemName}: expected vs actual</CardTitle>
          <p className="text-sm text-muted">Units issued each week, against what the LLM expected.</p>
        </div>
        <div className="flex items-center gap-2">
          {sample ? (
            <Tag tone="dashed">Sample data</Tag>
          ) : (
            <>
              <ProvenanceTag kind="database" />
              <ProvenanceTag kind="synthetic-data" />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-green-border bg-green-tint p-3.5">
              <p className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Accuracy</p>
              <p className="font-mono text-2xl font-medium text-green-text">
                {stats ? `${stats.accuracy.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="rounded-md border border-blue-border bg-blue-tint p-3.5">
              <p className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Avg miss per week</p>
              <p className="font-mono text-2xl font-medium text-navy">
                {stats ? `${Math.round(stats.avgMissUnits)} units` : "—"}
              </p>
            </div>
            <div className="rounded-md border border-blue-border bg-blue-tint p-3.5">
              <p className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Weeks within 10%</p>
              <p className="font-mono text-2xl font-medium text-navy">
                {stats ? `${stats.weeksWithin10Pct} of ${stats.weeksScored}` : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-strong-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 border-t-2 border-navy" aria-hidden="true" />
              Actual issued
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 border-t-2 border-amber-text" aria-hidden="true" />
              Expected (LLM)
            </span>
          </div>

          <div role="img" aria-label={summary} className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                {forecastStart && forecastEnd ? (
                  <ReferenceArea
                    x1={formatShortDate(forecastStart)}
                    x2={formatShortDate(forecastEnd)}
                    fill="var(--color-amber-bg)"
                    fillOpacity={0.5}
                    label={{ value: "Next 4 weeks", position: "insideTopRight", fontSize: 11, fill: "var(--color-amber-text)" }}
                  />
                ) : null}
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
                  axisLine={{ stroke: "var(--color-line-strong)" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={40}
                  tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 8,
                    fontSize: 12.5,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--color-navy)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  isAnimationActive={false}
                  name="Actual issued"
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="var(--color-amber-text)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  name="Expected (LLM)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">{summary}</p>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-72 lg:shrink-0">
          <p className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Accuracy by product</p>
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {products.map((p) => (
              <button
                key={p.itemId}
                type="button"
                onClick={() => onSelectItem(p.itemId)}
                aria-pressed={p.itemId === selectedItemId}
                className={cn(
                  "flex min-h-11 flex-col gap-1.5 rounded-md border-[1.5px] px-3 py-2 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
                  p.itemId === selectedItemId ? "border-navy bg-blue-tint" : "border-line bg-card hover:bg-page",
                )}
              >
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{p.itemName}</span>
                  <span className="font-mono text-xs">{p.accuracy.toFixed(0)}%</span>
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-page">
                  <span
                    className={cn("block h-full rounded-full", barColor(p.accuracy))}
                    style={{ width: `${Math.min(100, p.accuracy)}%` }}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
