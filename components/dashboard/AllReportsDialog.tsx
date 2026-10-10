"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { STATUS_LABEL, STATUS_TAG_TONE } from "@/lib/data/reportStatus";
import { formatClock } from "@/lib/data/reportFormat";
import type { Report, ReportStatus } from "@/lib/db/types";
import { cn } from "@/lib/cn";

type Filter = "all" | ReportStatus;

export function AllReportsDialog({
  open,
  onOpenChange,
  reports,
  initialFilter = "all",
  onReview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: Report[];
  initialFilter?: Filter;
  onReview: (report: Report) => void;
}) {
  const [filter, setFilter] = React.useState<Filter>(initialFilter);
  // Reset the filter each time the dialog opens with a new initialFilter,
  // without an effect (React's "adjust state while rendering" pattern).
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setFilter(initialFilter);
  }

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const filters: Filter[] = ["all", "pending_approval", "sent", "confirmed_by_supplier", "delivery_failed", "rejected"];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30" />
        <Dialog.Content className="fixed inset-8 z-50 m-auto flex h-fit max-h-full w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-card border border-line bg-card p-6 shadow-lg focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">All reports</Dialog.Title>
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

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reports">
            {filters.map((f) => {
              const count = f === "all" ? reports.length : reports.filter((r) => r.status === f).length;
              const pressed = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md border-[1.5px] px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
                    pressed ? "border-navy bg-navy text-white" : "border-line bg-card text-ink hover:bg-blue-tint",
                  )}
                >
                  {f === "all" ? "All" : STATUS_LABEL[f]}
                  <span className={cn("rounded-full px-1.5 font-mono text-xs", pressed ? "bg-white/20" : "bg-page")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No reports in this view.</p>
            ) : (
              filtered.map((r) => (
                <div
                  key={r.report_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-muted">
                      {r.report_code} {"·"} {formatClock(r.generated_at)}
                    </span>
                    <span className="text-sm font-semibold">{r.title}</span>
                    <Tag tone={STATUS_TAG_TONE[r.status]} className="w-fit">
                      {STATUS_LABEL[r.status]}
                    </Tag>
                  </div>
                  <Button variant="secondary" onClick={() => onReview(r)}>
                    Review
                  </Button>
                </div>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
