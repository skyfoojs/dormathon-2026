import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import type { PredictionRunDetail } from "@/lib/mock/predictionDetail";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";
import type { ReplaySpeed } from "@/components/predictions/useReplay";
import { cn } from "@/lib/cn";

const SPEEDS: ReplaySpeed[] = [1, 5, 10, 30];

export function DetailLeftPanel({
  run,
  detail,
  revealedVoteCount,
  totalEvents,
  revealedCount,
  setRevealedCount,
  playing,
  onTogglePlay,
  speed,
  setSpeed,
}: {
  run: PredictionRunSummary;
  detail: PredictionRunDetail;
  revealedVoteCount: number;
  totalEvents: number;
  revealedCount: number;
  setRevealedCount: (n: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  speed: ReplaySpeed;
  setSpeed: (s: ReplaySpeed) => void;
}) {
  const replayLabel = playing ? "Pause" : revealedCount >= totalEvents ? "Replay" : "Play";

  return (
    <Card className="flex w-full flex-col gap-4 p-5 lg:w-72 lg:shrink-0">
      <div>
        <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Prediction</span>
        <p className="mt-1 text-lg leading-snug font-semibold text-ink">{detail.claim}</p>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-dashed border-line-strong pt-3">
        <Tag tone="green" className="self-start">
          {detail.consensusLabel}
        </Tag>
        <p className="text-sm text-strong-muted">
          Ran for <span className="font-mono">{run.durationLabel}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-md border border-line p-3">
          <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Sealed</span>
          <div className="font-mono text-2xl font-medium">3/3</div>
        </div>
        <div className="rounded-md border border-line p-3">
          <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Revealed</span>
          <div className="font-mono text-2xl font-medium">{revealedVoteCount}/3</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-blue-border bg-blue-tint p-4">
        <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Risk score</span>
        <div className="font-mono text-4xl leading-none font-medium text-navy">{run.riskScore}/100</div>
        <span className="w-fit rounded border border-line bg-card px-2 py-1 font-mono text-xs text-strong-muted">
          RUN {run.id}
        </span>
        <p className="text-xs text-strong-muted">Mean of the three model confidences.</p>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-dashed border-line-strong pt-3">
        <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Replay</span>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-sm text-strong-muted">Watch this run at {speed}X</span>
          <Button variant="primary" onClick={onTogglePlay}>
            {replayLabel}
          </Button>
        </div>
        <label className="sr-only" htmlFor="replay-scrubber">
          Replay position
        </label>
        <input
          id="replay-scrubber"
          type="range"
          min={0}
          max={totalEvents}
          value={revealedCount}
          onChange={(e) => setRevealedCount(Number(e.target.value))}
          className="h-11 w-full accent-navy"
        />
        <div className="flex items-center gap-1.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
              className={cn(
                "min-h-11 flex-1 rounded-md border-[1.5px] font-mono text-xs font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
                speed === s ? "border-navy bg-navy text-white" : "border-line text-ink hover:bg-blue-tint",
              )}
            >
              {s}X
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-line bg-page p-3.5">
        <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">What to do</span>
        <p className="text-sm font-semibold text-ink">{detail.whatToDo}</p>
      </div>
    </Card>
  );
}
