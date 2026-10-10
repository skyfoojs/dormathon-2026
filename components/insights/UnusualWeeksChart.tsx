"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/data/dates";
import type { UnusualWeekPoint } from "@/lib/data/insights";

export function UnusualWeeksChart({
  points,
  mean,
  stdDev,
}: {
  points: UnusualWeekPoint[];
  mean: number;
  stdDev: number;
}) {
  const chartData = points.map((p) => ({
    label: formatShortDate(p.week),
    issued: p.issued,
    bandLow: Math.max(0, mean - 2 * stdDev),
    bandHeight: 4 * stdDev,
  }));
  const outliers = points
    .map((p) => ({ label: formatShortDate(p.week), issued: p.issued, isOutlier: p.isOutlier }))
    .filter((p) => p.isOutlier);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
            axisLine={{ stroke: "var(--color-line-strong)" }}
            tickLine={false}
          />
          <YAxis
            width={44}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip />
          <Area
            dataKey="bandLow"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            dataKey="bandHeight"
            stackId="band"
            stroke="none"
            fill="var(--color-blue-light)"
            fillOpacity={0.15}
            isAnimationActive={false}
          />
          <ReferenceLine y={mean} stroke="var(--color-line-strong)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="issued"
            stroke="var(--color-navy)"
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Scatter data={outliers} dataKey="issued" fill="var(--color-red)" shape="circle" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
