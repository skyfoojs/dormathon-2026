"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Label, Select } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { StepList } from "@/components/ui/StepList";
import { ProvenanceTag, Tag, type TagTone } from "@/components/ui/Tag";
import { AlgorithmicForecastChart } from "@/components/predictions/AlgorithmicForecastChart";
import { StatTile } from "@/components/predictions/StatTile";
import { createTableColumnHelper } from "@/lib/table/features";
import {
  ALGO_ITEMS,
  FORECAST_WEEKS,
  HISTORY_WEEKS,
  WMA_WINDOWS,
  forecastAlgoItem,
  wmaWeeks,
  type AlgoTier,
  type AlgoTierRow,
  type WmaWindowDays,
} from "@/lib/mock/algorithmicForecast";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

const TIER_TONE: Record<AlgoTier, TagTone> = { High: "red", Medium: "amber", Low: "grey" };

const WINDOW_OPTIONS = WMA_WINDOWS.map((w) => ({ value: w.days, label: `${w.days} days` }));

const helper = createTableColumnHelper<AlgoTierRow>();

const TIER_COLUMNS = [
  helper.accessor((r) => r.itemName, {
    id: "item",
    header: "Item",
    cell: ({ row }) => <span className="font-semibold">{row.original.itemName}</span>,
  }),
  helper.accessor((r) => r.onHand, {
    id: "onHand",
    header: "On hand",
    cell: ({ row }) => <span className="font-mono">{row.original.onHand.toLocaleString()}</span>,
  }),
  helper.accessor((r) => r.weekly, {
    id: "weekly",
    header: "Forecast per week",
    cell: ({ row }) => <span className="font-mono">{row.original.weekly.toLocaleString()}</span>,
  }),
  helper.accessor((r) => r.coverWeeks, {
    id: "cover",
    header: "Cover",
    cell: ({ row }) => <span className="font-mono font-medium">{row.original.coverWeeks.toFixed(1)} wk</span>,
  }),
  helper.accessor((r) => r.openOrder, { id: "order", header: "Open order" }),
  helper.display({
    id: "tier",
    header: "Tier",
    cell: ({ row }) => <Tag tone={TIER_TONE[row.original.tier]}>{row.original.tier}</Tag>,
  }),
  helper.accessor((r) => r.nextMonth, {
    id: "nextMonth",
    header: "Next month",
    cell: ({ row }) => <span className="font-mono font-semibold">{row.original.nextMonth.toLocaleString()}</span>,
  }),
  helper.display({
    id: "runsOut",
    header: "Runs out about",
    cell: ({ row }) => <span className="font-mono">{row.original.runsOutLabel}</span>,
  }),
];

const LEGEND_ITEMS = [
  { label: "Actual weekly issue", swatch: "border-t-2 border-line-strong" },
  { label: "Holt linear trend", swatch: "border-t-2 border-red" },
  { label: "Weighted moving average", swatch: "border-t-2 border-blue-light" },
  { label: "Average of the two", swatch: "border-t-2 border-dotted border-ink" },
];

function round(value: number): string {
  return Math.round(value).toLocaleString();
}

export function AlgorithmicForecast({
  run,
  windowDays,
  onWindowChange,
  tierRows,
}: {
  run: PredictionRunSummary;
  windowDays: WmaWindowDays;
  onWindowChange: (days: WmaWindowDays) => void;
  tierRows: AlgoTierRow[];
}) {
  const [itemIndex, setItemIndex] = React.useState(0);
  const forecast = React.useMemo(() => forecastAlgoItem(itemIndex, windowDays), [itemIndex, windowDays]);

  const steps = [
    { title: "Read the weekly issue rows", text: `The last ${HISTORY_WEEKS} weeks of units issued, about ${HISTORY_WEEKS * 7} days.` },
    { title: "Holt linear trend", text: `Smooths the level and the weekly trend, then extends the trend ${FORECAST_WEEKS} weeks.` },
    { title: "Weighted moving average", text: `Averages the last ${wmaWeeks(windowDays)} weeks (${windowDays} days), newest weeks counting most.` },
    { title: "Average the two", text: "The dotted line is the planning forecast. A gap between the methods is a warning in itself." },
    { title: "Assign a tier", text: "By weeks of cover on the planning forecast, raised one level if an open order is late." },
  ];

  return (
    <Card as="section" className="flex min-w-0 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-semibold">
            Algorithmic Forecast at <span className="font-mono">{run.ranAtClock}</span> {"·"} {run.trigger}
          </h2>
          <Tag tone={run.status === "OK" ? "blue" : "amber"}>{run.status}</Tag>
        </div>
        <div className="flex flex-wrap gap-2">
          <ProvenanceTag kind="database" />
          <Tag tone="grey">No AI used</Tag>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Holt trend, per week" value={round(forecast.holtWeekly)} />
        <StatTile label={`Moving avg, ${windowDays}d`} value={round(forecast.wmaWeekly)} />
        <StatTile label="Planning forecast" value={round(forecast.planningWeekly)} />
        <StatTile label="Methods differ by" value={`${Math.round(forecast.methodGap * 100)}%`} />
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex w-full max-w-sm flex-col gap-1.5">
              <Label htmlFor="algo-item">Item</Label>
              <Select id="algo-item" value={itemIndex} onChange={(e) => setItemIndex(Number(e.target.value))}>
                {ALGO_ITEMS.map((item, i) => (
                  <option key={item.name} value={i}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Eyebrow id="wma-window-label">Moving average window</Eyebrow>
              <Segmented
                labelledBy="wma-window-label"
                options={WINDOW_OPTIONS}
                value={windowDays}
                onChange={onWindowChange}
              />
            </div>
          </div>

          <h3 className="text-base font-semibold">
            {forecast.itemName}: weekly demand and {FORECAST_WEEKS}-week forecast
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-strong-muted">
            {LEGEND_ITEMS.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`inline-block w-5 ${l.swatch}`} aria-hidden="true" />
                {l.label}
              </span>
            ))}
          </div>

          <AlgorithmicForecastChart forecast={forecast} windowDays={windowDays} />

          <p className="text-xs text-muted">
            Holt settings chosen to minimise one-step error: level weight {forecast.alpha.toFixed(1)}, trend weight{" "}
            {forecast.beta.toFixed(1)}, trend {forecast.trend >= 0 ? "+" : ""}
            {forecast.trend.toFixed(1)} units a week. The moving average gives the newest weeks the most weight and is
            flat going forward. The extract ends 13 Jul 2026.
          </p>
          <div className="flex flex-wrap gap-2">
            <ProvenanceTag kind={forecast.usesSampleRows ? "database" : "synthetic-data"} />
            <ProvenanceTag kind="model-output" />
            <Tag tone="grey">No AI used</Tag>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 xl:w-80 xl:shrink-0">
          <h3 className="text-base font-semibold">How this forecast is made</h3>
          <p className="text-sm text-strong-muted">
            Two methods, then their average. Both use only the weekly issue rows in your database.
          </p>
          <StepList steps={steps} />
        </div>
      </div>

      <DataTable columns={TIER_COLUMNS} data={tierRows} getRowId={(r) => r.itemName} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <ProvenanceTag kind="database" />
        <ProvenanceTag kind="model-output" />
        <span>
          Weekly forecast is the average of the Holt and weighted moving average forecasts over the next{" "}
          {FORECAST_WEEKS} weeks. Cover is on hand divided by that forecast. Tier rule: under 1 week of cover is High,
          under 2 weeks is Medium, otherwise Low, raised one level if an open order is late. Next month is 4.3 times
          the weekly forecast. Only Salbutamol uses the real weekly rows. Other items use invented {HISTORY_WEEKS}-week
          series.
        </span>
      </div>
    </Card>
  );
}
