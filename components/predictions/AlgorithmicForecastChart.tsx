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
import { FORECAST_WEEKS, HISTORY_WEEKS, type AlgoItemForecast } from "@/lib/mock/algorithmicForecast";

const AXIS_TICK = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted)" };
const LABEL_FONT = { fontSize: 11.5, fontFamily: "var(--font-mono)" };
const TICK_WEEKS = [0, 3, 6, 9, 12, 15, 17];
const Y_STEP = 20;

export function AlgorithmicForecastChart({
  forecast,
  windowDays,
}: {
  forecast: AlgoItemForecast;
  windowDays: number;
}) {
  const { points } = forecast;
  const last = points[points.length - 1];
  const values = points.flatMap((p) => (p.actual === undefined ? [p.holt, p.wma] : [p.actual, p.holt, p.wma]));
  const low = Math.max(0, Math.floor((Math.min(...values) - 5) / Y_STEP) * Y_STEP);
  const high = Math.ceil((Math.max(...values) + 5) / Y_STEP) * Y_STEP;
  const summary =
    `Weekly units issued for ${HISTORY_WEEKS} weeks with three forecast lines for the next ${FORECAST_WEEKS} weeks. ` +
    `Holt linear trend ends at ${last.holt}, the ${windowDays} day weighted moving average at ${last.wma}, ` +
    `and their average at ${last.average}.`;

  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={summary} className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis
              dataKey="week"
              ticks={TICK_WEEKS.map((k) => points[k].week)}
              interval={0}
              tick={AXIS_TICK}
              axisLine={{ stroke: "var(--color-line-strong)" }}
              tickLine={false}
            />
            <YAxis width={52} domain={[low, high]} tickCount={5} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => (typeof value === "number" ? value.toLocaleString() : value)}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
                fontSize: 12.5,
              }}
            />
            <ReferenceArea
              x1={points[HISTORY_WEEKS - 1].week}
              x2={last.week}
              fill="var(--color-blue-tint)"
              fillOpacity={0.6}
              label={{
                value: `Next ${FORECAST_WEEKS} weeks`,
                position: "insideTop",
                fill: "var(--color-strong-muted)",
                ...LABEL_FONT,
              }}
            />
            <Line
              type="linear"
              dataKey="actual"
              name="Actual weekly issue"
              stroke="var(--color-line-strong)"
              strokeWidth={1.5}
              dot={{ r: 4, fill: "var(--color-line-strong)", stroke: "var(--color-card)", strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="wma"
              name="Weighted moving average"
              stroke="var(--color-blue-light)"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="holt"
              name="Holt linear trend"
              stroke="var(--color-red)"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="average"
              name="Average of the two"
              stroke="var(--color-ink)"
              strokeWidth={3.5}
              strokeDasharray="1 7"
              strokeLinecap="round"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">{summary}</p>
    </div>
  );
}
