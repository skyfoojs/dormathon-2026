"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate } from "@/lib/data/dates";
import type { ReceiptBar } from "@/lib/data/insights";

export function ReceiptsVsOrdersChart({ bars }: { bars: ReceiptBar[] }) {
  const chartData = bars.map((b) => ({
    label: formatShortDate(b.week),
    matched: b.matched,
    unmatched: b.unmatched,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
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
          <Bar dataKey="matched" stackId="r" fill="var(--color-navy)" name="Matched to an order" isAnimationActive={false} />
          <Bar
            dataKey="unmatched"
            stackId="r"
            fill="var(--color-amber-border)"
            name="No linked order"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
