"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { useReplay } from "@/components/predictions/useReplay";
import { DetailLeftPanel } from "@/components/predictions/DetailLeftPanel";
import { GraphView } from "@/components/predictions/GraphView";
import { ChatView } from "@/components/predictions/ChatView";
import type { PredictionRunDetail } from "@/lib/mock/predictionDetail";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

export function RunDetail({ run, detail }: { run: PredictionRunSummary; detail: PredictionRunDetail }) {
  const [view, setView] = React.useState<"graph" | "chat">("graph");
  const replay = useReplay();

  function togglePlay() {
    if (!replay.playing && replay.revealedCount >= replay.totalEvents) {
      replay.reset();
    } else {
      replay.setPlaying((p) => !p);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-semibold">
            Run at <span className="font-mono">{run.ranAtClock}</span> {"·"} {run.trigger}
          </h2>
          <Tag tone={run.status === "OK" ? "blue" : "amber"}>{run.status}</Tag>
        </div>
        <div role="tablist" aria-label="Run view" className="flex">
          {(["chat", "graph"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "min-h-11 border-[1.5px] px-4 text-sm font-semibold capitalize transition-colors duration-150 first:rounded-l-md last:rounded-r-md first:border-r-0 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
                view === v ? "border-navy bg-navy text-white" : "border-line text-ink hover:bg-blue-tint",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <DetailLeftPanel
          run={run}
          detail={detail}
          revealedVoteCount={replay.revealedVoteCount}
          totalEvents={replay.totalEvents}
          revealedCount={replay.revealedCount}
          setRevealedCount={replay.setRevealedCount}
          playing={replay.playing}
          onTogglePlay={togglePlay}
          speed={replay.speed}
          setSpeed={replay.setSpeed}
        />
        <div className="min-w-0 flex-1">
          {view === "graph" ? <GraphView detail={detail} replay={replay} /> : <ChatView detail={detail} />}
        </div>
      </div>
    </Card>
  );
}
