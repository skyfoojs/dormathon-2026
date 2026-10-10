"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button, IconButton } from "@/components/ui/Button";
import { cn, focusRingClasses } from "@/lib/cn";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

const RUNS_PER_PAGE = 5;

export function RunTile({
  run,
  scoreLabel,
  score,
  selected,
  onSelect,
}: {
  run: PredictionRunSummary;
  scoreLabel: string;
  score: number;
  selected: boolean;
  onSelect: () => void;
}) {
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
      <div className="flex w-full items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium">{run.ranAtClock}</span>
        <Tag tone={run.status === "OK" ? "blue" : "amber"}>{run.status}</Tag>
      </div>
      <span className="text-xs text-strong-muted">
        {run.trigger} {"·"} {scoreLabel} <span className="font-mono">{score}</span>
      </span>
    </button>
  );
}

export function PreviousRunsCard({
  runs,
  selectedRunId,
  onSelect,
  onSyncNow,
  syncing = false,
  nextSyncClock,
  scoreLabel,
  getScore,
}: {
  runs: PredictionRunSummary[];
  selectedRunId: string;
  onSelect: (id: string) => void;
  onSyncNow: () => void;
  syncing?: boolean;
  nextSyncClock: string;
  scoreLabel: string;
  getScore: (run: PredictionRunSummary) => number;
}) {
  const [requestedPage, setRequestedPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(runs.length / RUNS_PER_PAGE));
  const page = Math.min(requestedPage, pageCount - 1);
  const first = page * RUNS_PER_PAGE;
  const latest = runs[0];

  return (
    <Card as="section" className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold">Previous runs</h2>
          <span className="font-mono text-sm text-muted">{runs.length} today</span>
        </div>
        <Button
          variant="primary"
          disabled={syncing}
          onClick={() => {
            setRequestedPage(0);
            onSyncNow();
          }}
        >
          Sync now
        </Button>
      </div>

      <p className="text-sm text-strong-muted">
        Last sync <span className="font-mono font-semibold text-ink">{latest.ranAtClock}</span> {"·"}{" "}
        {latest.ranAtLabel.toLowerCase()} {"·"} {latest.trigger.toLowerCase()}. Next scheduled sync at{" "}
        <span className="font-mono">{nextSyncClock}</span>.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {runs.slice(first, first + RUNS_PER_PAGE).map((run) => (
          <RunTile
            key={run.id}
            run={run}
            scoreLabel={scoreLabel}
            score={getScore(run)}
            selected={run.id === selectedRunId}
            onSelect={() => onSelect(run.id)}
          />
        ))}
      </div>

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
          <span className="font-mono text-sm text-muted">
            Showing {first + 1} to {Math.min(runs.length, first + RUNS_PER_PAGE)} of {runs.length} runs
          </span>
          <nav aria-label="Previous runs pages" className="flex items-center gap-1.5">
            <IconButton aria-label="Previous page" disabled={page === 0} onClick={() => setRequestedPage(page - 1)}>
              <ChevronLeft size={16} aria-hidden="true" />
            </IconButton>
            {Array.from({ length: pageCount }, (_, n) => (
              <Button
                key={n}
                variant={n === page ? "primary" : "secondary"}
                aria-label={`Page ${n + 1}`}
                aria-current={n === page ? "page" : undefined}
                onClick={() => setRequestedPage(n)}
                className="min-w-11"
              >
                {n + 1}
              </Button>
            ))}
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
