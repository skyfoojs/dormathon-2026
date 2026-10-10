"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { ProvenanceTag, Tag, type ProvenanceKind } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import type { PredictionRunDetail, RunModel } from "@/lib/mock/predictionDetail";

const MODEL_BADGE = ["bg-navy text-white", "bg-blue-light text-ink", "bg-amber-border text-ink"];

export function ChatView({ detail }: { detail: PredictionRunDetail }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(detail.models[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {detail.models.map((model, i) => (
          <button
            key={model.id}
            type="button"
            onClick={() => setExpandedId((prev) => (prev === model.id ? null : model.id))}
            aria-pressed={expandedId === model.id}
            className={cn(
              "flex min-h-11 flex-col gap-2 rounded-md border-[1.5px] p-3 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
              expandedId === model.id ? "border-navy bg-blue-tint" : "border-line bg-card hover:bg-page",
            )}
          >
            <span className="flex items-center gap-2.5">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold", MODEL_BADGE[i])}>
                {model.name[0]}
              </span>
              <span className="text-sm font-semibold">{model.name}</span>
            </span>
            <Tag tone="grey" className="self-start">
              {model.role}
            </Tag>
            <span className="flex items-center gap-2">
              <Tag tone="green">{model.vote}</Tag>
              <span className="font-mono text-sm">{model.confidence}%</span>
            </span>
            <span className="text-xs font-semibold text-navy">
              {expandedId === model.id ? "Hide trail" : "Show trail"} {"·"} 5 steps
            </span>
          </button>
        ))}
      </div>

      {detail.models
        .filter((m) => m.id === expandedId)
        .map((model) => (
          <ModelChatDetail key={model.id} model={model} />
        ))}
    </div>
  );
}

function ModelChatDetail({ model }: { model: RunModel }) {
  const provenanceChips = Array.from(new Set(model.steps.map((s) => s.provenance))) as ProvenanceKind[];

  return (
    <Card className="flex flex-col gap-3 border-navy p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-semibold">{model.name}</span>
        <Tag tone="grey">{model.role}</Tag>
        <Tag tone="green">
          {model.vote}, {model.confidence}%
        </Tag>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Research trail</p>
          <ul className="flex flex-col gap-1 text-sm text-strong-muted">
            {model.steps.map((s) => (
              <li key={s.id}>{s.label}: {s.finding}</li>
            ))}
          </ul>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-page"
          role="img"
          aria-label={`Confidence ${model.confidence} percent`}
        >
          <div className="h-full rounded-full bg-navy" style={{ width: `${model.confidence}%` }} />
        </div>

        <p className="text-sm">{model.reasoning}</p>
        <p className="text-sm text-green-text">
          <span className="font-semibold">Supports. </span>
          {model.supports}
        </p>
        <p className="text-sm text-amber-text">
          <span className="font-semibold">Insufficient. </span>
          {model.insufficient}
        </p>
        <div className="flex flex-wrap gap-2">
          {provenanceChips.map((p) => (
            <ProvenanceTag key={p} kind={p} />
          ))}
        </div>
      </div>
    </Card>
  );
}
