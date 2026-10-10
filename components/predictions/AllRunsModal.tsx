"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30" />
        <Dialog.Content className="fixed inset-8 z-50 m-auto flex h-fit max-h-full w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-card border border-line bg-card p-6 shadow-lg focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">All runs</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-md text-navy hover:bg-blue-tint focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto">
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
