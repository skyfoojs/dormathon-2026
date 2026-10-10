"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CoverBar } from "@/lib/data/insights";

function barColor(weeks: number): string {
  if (weeks < 1) return "var(--color-red)";
  if (weeks < 2) return "var(--color-amber-border)";
  return "var(--color-navy)";
}

export function CoverByItemChart({ rows }: { rows: CoverBar[] }) {
  const chartData = rows.map((r) => ({ name: r.itemName, weeks: r.weeksOfCover }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 20, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--color-line)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" }}
            axisLine={{ stroke: "var(--color-line-strong)" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11, fill: "var(--color-ink)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip />
          <ReferenceLine x={2} stroke="var(--color-red)" strokeDasharray="5 4" />
          <Bar dataKey="weeks" isAnimationActive={false}>
            {chartData.map((d) => (
              <Cell key={d.name} fill={barColor(d.weeks)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
