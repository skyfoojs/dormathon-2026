"use client";

import * as React from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import type { RelationshipLink, RelationshipNode } from "@/lib/data/insights";

const CONCERN_TONE: Record<RelationshipLink["concern"], TagTone> = {
  high: "red",
  medium: "amber",
  normal: "grey",
};

const CONCERN_LABEL: Record<RelationshipLink["concern"], string> = {
  high: "Worth checking now",
  medium: "Worth a look",
  normal: "Normal",
};

const COLUMN_LABEL: Record<RelationshipNode["kind"], string> = {
  supplier: "Suppliers",
  item: "Items",
  problem: "Flagged problems",
};

function NodeColumn({
  kind,
  nodes,
  selectedId,
  onSelect,
}: {
  kind: RelationshipNode["kind"];
  nodes: RelationshipNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <h3 className="font-mono text-xs font-medium tracking-wide text-muted uppercase">
        {COLUMN_LABEL[kind]}
      </h3>
      <div className="flex flex-col gap-1.5">
        {nodes.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          nodes.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-pressed={selectedId === n.id}
              aria-label={n.label}
              onClick={() => onSelect(n.id)}
              className={cn(
                "min-h-11 rounded-md border-[1.5px] px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
                selectedId === n.id ? "border-navy bg-blue-tint" : "border-line bg-card hover:bg-page",
                n.kind === "problem" && "font-medium",
              )}
            >
              {n.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function RelationshipGraph({
  nodes,
  links,
}: {
  nodes: RelationshipNode[];
  links: RelationshipLink[];
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const byKind = (kind: RelationshipNode["kind"]) => nodes.filter((n) => n.kind === kind);
  const nodeLabel = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;

  const connections = selectedId
    ? links.filter((l) => l.source === selectedId || l.target === selectedId)
    : [];

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardTitle>Relationship graph</CardTitle>
      <p className="text-sm text-muted">
        Suppliers, the items they supply, and any flagged problems. Select a
        node to see its connections.
      </p>
      <div className="flex flex-col gap-5 sm:flex-row">
        <NodeColumn kind="supplier" nodes={byKind("supplier")} selectedId={selectedId} onSelect={setSelectedId} />
        <NodeColumn kind="item" nodes={byKind("item")} selectedId={selectedId} onSelect={setSelectedId} />
        <NodeColumn kind="problem" nodes={byKind("problem")} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      {selectedId ? (
        <div className="flex flex-col gap-2 rounded-md bg-page p-4">
          <p className="text-sm font-semibold">{nodeLabel(selectedId)}: connections</p>
          {connections.length === 0 ? (
            <p className="text-sm text-muted">No connections.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {connections.map((c, i) => {
                const otherId = c.source === selectedId ? c.target : c.source;
                return (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Tag tone={CONCERN_TONE[c.concern]}>{CONCERN_LABEL[c.concern]}</Tag>
                    <span>{nodeLabel(otherId)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </Card>
  );
}
