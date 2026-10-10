"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { STATUS_LABEL, STATUS_TAG_TONE } from "@/lib/data/reportStatus";
import { formatClock } from "@/lib/data/reportFormat";
import type { Report } from "@/lib/db/types";

export function ReviewDialog({
  report,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onRetry,
  backLabel,
}: {
  report: Report | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onRetry: (id: number) => void;
  backLabel?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30" />
        <Dialog.Content className="fixed inset-8 z-50 m-auto flex h-fit max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-card border border-line bg-card p-6 shadow-lg focus:outline-none">
          {report ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted">
                    {report.report_code} {"·"} {report.report_type === "purchase_order_report" ? "Purchase order report" : "Analytics report"}
                  </p>
                  <Dialog.Title className="text-lg font-semibold">{report.title}</Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-navy hover:bg-blue-tint focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Status</p>
                  <Tag tone={STATUS_TAG_TONE[report.status]} className="mt-1">
                    {STATUS_LABEL[report.status]}
                  </Tag>
                </div>
                <div>
                  <p className="font-mono text-xs font-medium tracking-wide text-muted uppercase">To</p>
                  <p className="mt-1 text-sm font-semibold">{report.recipient}</p>
                </div>
              </div>

              <p className="text-sm text-strong-muted">
                Generated {formatClock(report.generated_at)}
                {report.note ? ` · ${report.note}` : ""}
              </p>

              {report.body_lines.length > 0 ? (
                <div className="flex flex-col gap-1 rounded-md border border-line bg-page p-3.5">
                  <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">
                    What will be sent
                  </span>
                  {report.body_lines.map((line) => (
                    <p key={line.label} className="text-sm">
                      {line.label}: {line.value}
                    </p>
                  ))}
                </div>
              ) : null}

              {report.reason ? <p className="text-sm text-strong-muted">Why: {report.reason}</p> : null}

              <div className="flex items-center gap-2">
                {report.status === "pending_approval" ? (
                  <>
                    <Button variant="primary" onClick={() => onApprove(report.report_id)}>
                      Approve and send
                    </Button>
                    <Button variant="ghost" onClick={() => onReject(report.report_id)}>
                      Reject
                    </Button>
                  </>
                ) : null}
                {report.status === "delivery_failed" ? (
                  <Button variant="primary" onClick={() => onRetry(report.report_id)}>
                    Retry send
                  </Button>
                ) : null}
                <Dialog.Close asChild>
                  <Button variant="ghost">{backLabel ?? "Close"}</Button>
                </Dialog.Close>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
