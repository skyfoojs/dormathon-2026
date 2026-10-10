import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

export function RunTile({
  run,
  selected,
  onSelect,
}: {
  run: PredictionRunSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 flex-col gap-1 rounded-md border-[1.5px] p-3 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
        selected ? "border-navy bg-blue-tint" : "border-line bg-card hover:bg-page",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium">{run.ranAtClock}</span>
        <Tag tone={run.status === "OK" ? "blue" : "amber"}>{run.status}</Tag>
      </div>
      <span className="text-xs text-strong-muted">
        {run.trigger} {"·"} risk <span className="font-mono">{run.riskScore}</span>
      </span>
    </button>
  );
}

export function RunTilesSection({
  runs,
  totalToday,
  selectedRunId,
  onSelect,
  onViewAll,
}: {
  runs: PredictionRunSummary[];
  totalToday: number;
  selectedRunId: string;
  onSelect: (id: string) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Previous runs <span className="font-normal text-muted">{totalToday} today</span>
        </h2>
        <Button variant="ghost" onClick={onViewAll}>
          View all {totalToday} runs
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {runs.slice(0, 5).map((run) => (
          <RunTile
            key={run.id}
            run={run}
            selected={run.id === selectedRunId}
            onSelect={() => onSelect(run.id)}
          />
        ))}
      </div>
    </section>
  );
}
