"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WarningCard } from "@/components/warnings/WarningCard";
import { KIND_LABEL } from "@/components/warnings/KindTag";
import { SeverityPill } from "@/components/ui/SeverityPill";
import { useWarnings } from "@/components/providers/WarningsProvider";
import type { WarningKind } from "@/lib/data/warnings";
import { cn } from "@/lib/cn";

type Filter = "all" | WarningKind;

const SEVERITY_RANK: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export default function WarningsView() {
  const { openWarnings, resolvedOrSnoozed, resolve, snooze, reopen, reopenAll } = useWarnings();
  const [filter, setFilter] = React.useState<Filter>("all");

  const sorted = [...openWarnings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const filtered = filter === "all" ? sorted : sorted.filter((w) => w.kind === filter);

  const counts: Record<Filter, number> = {
    all: openWarnings.length,
    restock: openWarnings.filter((w) => w.kind === "restock").length,
    manage: openWarnings.filter((w) => w.kind === "manage").length,
    "check-input": openWarnings.filter((w) => w.kind === "check-input").length,
  };

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "restock", label: KIND_LABEL.restock },
    { id: "manage", label: KIND_LABEL.manage },
    { id: "check-input", label: KIND_LABEL["check-input"] },
  ];

  return (
    <>
      <PageHeader
        title="Warnings"
        subtitle={`${openWarnings.length} to resolve. Restock what is running out, manage what is at risk.`}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter warnings">
        {chips.map((chip) => {
          const pressed = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilter(chip.id)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md border-[1.5px] px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
                pressed
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-card text-ink hover:bg-blue-tint",
              )}
            >
              {chip.label}
              <span
                className={cn(
                  "rounded-full px-1.5 font-mono text-xs",
                  pressed ? "bg-white/20" : "bg-page",
                )}
              >
                {counts[chip.id]}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted">Nothing to resolve in this view.</Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((w) => (
            <WarningCard
              key={w.id}
              warning={w}
              onResolve={() => resolve(w.id)}
              onSnooze={() => snooze(w.id)}
            />
          ))}
        </div>
      )}

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Resolved or snoozed {resolvedOrSnoozed.length}
          </h2>
          {resolvedOrSnoozed.length > 0 ? (
            <Button variant="ghost" onClick={reopenAll}>
              Reopen all
            </Button>
          ) : null}
        </div>
        {resolvedOrSnoozed.length === 0 ? (
          <p className="text-sm text-muted">Nothing resolved or snoozed yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {resolvedOrSnoozed.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <SeverityPill severity={w.severity} />
                  <span className="text-sm">{w.title}</span>
                  <span className="text-xs text-muted">
                    {w.status === "resolved" ? "Resolved" : "Snoozed until tomorrow"}
                  </span>
                </div>
                <Button variant="ghost" onClick={() => reopen(w.id)}>
                  Reopen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
