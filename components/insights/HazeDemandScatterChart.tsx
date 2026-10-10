"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HazeDemandPoint } from "@/lib/data/insights";

export function HazeDemandScatterChart({
  points,
  fit,
}: {
  points: HazeDemandPoint[];
  fit: { slope: number; intercept: number };
}) {
  const minX = Math.min(...points.map((p) => p.apiAvg));
  const maxX = Math.max(...points.map((p) => p.apiAvg));
  const fitLine = [
    { apiAvg: minX, fitted: fit.slope * minX + fit.intercept },
    { apiAvg: maxX, fitted: fit.slope * maxX + fit.intercept },
  ];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" />
          <XAxis
            dataKey="apiAvg"
            type="number"
            name="Haze API"
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
            axisLine={{ stroke: "var(--color-line-strong)" }}
            tickLine={false}
          />
          <YAxis
            dataKey="issued"
            type="number"
            name="Units issued"
            width={44}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={points} fill="var(--color-navy)" />
          <Line
            data={fitLine}
            dataKey="fitted"
            stroke="var(--color-blue-light)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
