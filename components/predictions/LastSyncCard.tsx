import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

export function LastSyncCard({
  latestRun,
  onSyncNow,
}: {
  latestRun: PredictionRunSummary;
  onSyncNow: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Last sync</span>
        <div className="text-2xl font-semibold">
          <span className="font-mono">{latestRun.ranAtClock}</span>{" "}
          <span className="text-base font-normal text-muted">
            {"·"} {latestRun.ranAtLabel} {"·"} {latestRun.trigger.toLowerCase()}
          </span>
        </div>
        <p className="text-sm text-strong-muted">
          Next scheduled sync at the top of the hour. Also runs when you save new input.
        </p>
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <Button variant="primary" onClick={onSyncNow}>
          Sync now
        </Button>
        <span className="text-xs text-muted">Use when you see news before the next hourly run.</span>
      </div>
    </Card>
  );
}
