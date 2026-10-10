"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { Button, IconButton } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { cn, focusRingClasses } from "@/lib/cn";
import { formatDateTime } from "@/lib/data/dates";
import type { SyncRun, SyncScope } from "@/lib/api/resources";

const RUNS_PER_PAGE = 5;

export type RunFilter = { kind: "both" | "manual" | "auto"; auto: "both" | "hourly" | "daily" };

const SCOPE_LABEL: Record<SyncScope, string> = { news: "News sync", full: "Full sync" };
const TRIGGER_LABEL: Record<SyncRun["trigger"], string> = { manual: "Manual", hourly: "Hourly", daily: "Daily" };
const STATUS: Record<SyncRun["status"], { tone: TagTone; label: string }> = {
  queued: { tone: "grey", label: "Queued" },
  running: { tone: "blue", label: "Running" },
  succeeded: { tone: "green", label: "Succeeded" },
  failed: { tone: "red", label: "Failed" },
};
const STAGE_LABEL: Record<string, string> = {
  algorithmic_forecast: "Running the algorithmic forecast",
  fetching_news: "Fetching news",
  screening: "Screening news",
  enriching_moh: "Reading MOH statements",
  rescreening: "Re-screening news",
  cycle1: "Council validating news",
  cycle2: "Council forecasting usage",
  reusing_last_verdict: "No new news, reusing the last verdict",
  raising_orders: "Raising purchase orders",
};

function duration(run: SyncRun): string {
  if (!run.finished_at) return "In progress";
  const seconds = Math.round((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function RunTile({ run, selected, onSelect }: { run: SyncRun; selected: boolean; onSelect: () => void }) {
  const status = STATUS[run.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 flex-col gap-1 rounded-md border-2 p-3 text-left transition-colors duration-150",
        focusRingClasses,
        selected ? "border-navy bg-blue-tint" : "border-line bg-card hover:bg-page",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium">{formatDateTime(run.started_at)}</span>
        <Tag tone={status.tone}>{status.label}</Tag>
      </span>
      <span className="text-xs text-strong-muted">
        {SCOPE_LABEL[run.scope]} {"·"} {TRIGGER_LABEL[run.trigger]}
      </span>
      <span className="font-mono text-xs text-muted">{duration(run)}</span>
    </button>
  );
}

function RunFilters({ filter, onChange }: { filter: RunFilter; onChange: (filter: RunFilter) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="run-kind">Runs</Label>
        <Select
          id="run-kind"
          value={filter.kind}
          onChange={(e) => onChange({ ...filter, kind: e.target.value as RunFilter["kind"] })}
        >
          <option value="both">Manual and auto</option>
          <option value="manual">Manual</option>
          <option value="auto">Auto</option>
        </Select>
      </div>
      {filter.kind === "auto" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-schedule">Schedule</Label>
          <Select
            id="run-schedule"
            value={filter.auto}
            onChange={(e) => onChange({ ...filter, auto: e.target.value as RunFilter["auto"] })}
          >
            <option value="both">Hourly and daily</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </Select>
        </div>
      ) : null}
    </div>
  );
}

export function SyncRunsCard({
  runs,
  selectedRunId,
  onSelect,
  filter,
  onFilterChange,
  onSync,
  activeRun,
  syncError,
  noSyncs,
}: {
  runs: SyncRun[];
  selectedRunId: number | null;
  onSelect: (id: number) => void;
  filter: RunFilter;
  onFilterChange: (filter: RunFilter) => void;
  onSync: (scope: SyncScope) => void;
  activeRun: SyncRun | null;
  syncError: string | null;
  noSyncs: boolean;
}) {
  const [requestedPage, setRequestedPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(runs.length / RUNS_PER_PAGE));
  const page = Math.min(requestedPage, pageCount - 1);
  const first = page * RUNS_PER_PAGE;

  function sync(scope: SyncScope) {
    setRequestedPage(0);
    onSync(scope);
  }

  return (
    <Card as="section" className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold">Previous runs</h2>
          <span className="font-mono text-sm text-muted">{runs.length} shown</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={activeRun !== null} onClick={() => sync("news")}>
            News sync
          </Button>
          <Button variant="primary" disabled={activeRun !== null} onClick={() => sync("full")}>
            Full sync
          </Button>
        </div>
      </div>

      {activeRun ? (
        <p role="status" className="text-sm text-strong-muted">
          {SCOPE_LABEL[activeRun.scope]} running: {STAGE_LABEL[activeRun.stage ?? ""] ?? "Starting"}
          {"…"}
        </p>
      ) : null}
      {syncError ? (
        <p role="alert" className="text-sm text-red-dark">
          {syncError}
        </p>
      ) : null}

      <RunFilters
        filter={filter}
        onChange={(next) => {
          setRequestedPage(0);
          onFilterChange(next);
        }}
      />

      {runs.length === 0 ? (
        <p className="text-sm text-muted">{noSyncs ? "No syncs yet." : "No runs match this filter."}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {runs.slice(first, first + RUNS_PER_PAGE).map((run) => (
            <RunTile
              key={run.sync_run_id}
              run={run}
              selected={run.sync_run_id === selectedRunId}
              onSelect={() => onSelect(run.sync_run_id)}
            />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
          <span className="font-mono text-sm text-muted">
            Showing {first + 1} to {Math.min(runs.length, first + RUNS_PER_PAGE)} of {runs.length} runs
          </span>
          <nav aria-label="Previous runs pages" className="flex items-center gap-1.5">
            <IconButton aria-label="Previous page" disabled={page === 0} onClick={() => setRequestedPage(page - 1)}>
              <ChevronLeft size={16} aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label="Next page"
              disabled={page === pageCount - 1}
              onClick={() => setRequestedPage(page + 1)}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </IconButton>
          </nav>
        </div>
      ) : null}
    </Card>
  );
}
