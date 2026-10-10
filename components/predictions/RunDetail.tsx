"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Segmented } from "@/components/ui/Segmented";
import { useReplay } from "@/components/predictions/useReplay";
import { DetailLeftPanel } from "@/components/predictions/DetailLeftPanel";
import { GraphView } from "@/components/predictions/GraphView";
import { ChatView } from "@/components/predictions/ChatView";
import type { PredictionRunDetail } from "@/lib/mock/predictionDetail";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

const VIEW_OPTIONS: { value: "chat" | "graph"; label: string }[] = [
  { value: "chat", label: "Chat" },
  { value: "graph", label: "Graph" },
];

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
    <Card as="section" className="flex min-w-0 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-semibold">
            Run at <span className="font-mono">{run.ranAtClock}</span> {"·"} {run.trigger}
          </h2>
          <Tag tone={run.status === "OK" ? "blue" : "amber"}>{run.status}</Tag>
        </div>
        <Segmented label="Run view" options={VIEW_OPTIONS} value={view} onChange={setView} />
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
