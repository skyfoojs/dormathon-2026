"use client";

import { Modal } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

export function AllRunsModal({
  open,
  onOpenChange,
  runs,
  onOpenRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runs: PredictionRunSummary[];
  onOpenRun: (id: string) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="All runs">
      <div className="flex flex-col gap-2">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3"
          >
            <div className="flex flex-col gap-1">
              <span className="font-mono text-sm font-medium">{run.ranAtLabel}</span>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Tag tone={run.status === "OK" ? "blue" : "amber"}>{run.status}</Tag>
                <span>{run.trigger}</span>
                <span className="font-mono">Risk {run.riskScore}/100</span>
                <span>{run.warningsRaised} warnings</span>
              </div>
            </div>
            <Button variant="secondary" onClick={() => onOpenRun(run.id)}>
              Open
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
