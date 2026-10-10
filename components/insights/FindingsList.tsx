"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { ProvenanceTag, Tag, type TagTone } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import type { Finding } from "@/lib/data/insights";

type FilterId = "all" | Finding["category"];

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "concerning", label: "Concerning" },
  { id: "pattern", label: "Patterns" },
  { id: "data-quality", label: "Data quality" },
];

const CONFIDENCE_TONE: Record<Finding["confidence"], TagTone> = {
  low: "blue",
  medium: "amber",
  high: "red",
};

export function FindingsList({ findings }: { findings: Finding[] }) {
  const [filter, setFilter] = React.useState<FilterId>("all");
  const filtered = filter === "all" ? findings : findings.filter((f) => f.category === filter);

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Findings</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter findings">
        {FILTERS.map((f) => {
          const pressed = filter === f.id;
          const count = f.id === "all" ? findings.length : findings.filter((x) => x.category === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md border-[1.5px] px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
                pressed ? "border-navy bg-navy text-white" : "border-line bg-card text-ink hover:bg-blue-tint",
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 font-mono text-xs", pressed ? "bg-white/20" : "bg-page")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No findings in this view.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((f) => (
            <div key={f.id} className="flex flex-col gap-2 rounded-md border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="grey">{f.kind}</Tag>
                <ProvenanceTag kind={f.provenance} />
                <Tag tone={CONFIDENCE_TONE[f.confidence]}>{f.confidence} confidence</Tag>
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="text-sm text-strong-muted">{f.explanation}</p>
              <div className="rounded-md bg-page px-3 py-2 text-sm">
                <span className="font-semibold">Evidence. </span>
                {f.evidence}
              </div>
              <div className="rounded-md border border-blue-border bg-blue-tint px-3 py-2 text-sm text-navy">
                <span className="font-semibold">Suggested next step. </span>
                {f.nextStep}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
