"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { ModelBadge } from "@/components/predictions/ModelBadge";
import { cn, focusRingClasses } from "@/lib/cn";
import type { PredictionRunDetail, RunModel } from "@/lib/mock/predictionDetail";

function voteTone(model: RunModel) {
  return model.vote === "YES" ? "green" : "red";
}

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
              "flex min-h-11 flex-col gap-2 rounded-md border-2 p-3 text-left transition-colors duration-150",
              focusRingClasses,
              expandedId === model.id ? "border-navy bg-blue-tint" : "border-line bg-card hover:bg-page",
            )}
          >
            <span className="flex items-center gap-2.5">
              <ModelBadge name={model.name} modelIndex={i} />
              <span className="text-sm font-semibold">{model.name}</span>
            </span>
            <Tag tone="grey" className="self-start">
              {model.role}
            </Tag>
            <span className="flex items-center gap-2">
              <Tag tone={voteTone(model)}>{model.vote}</Tag>
              <span className="font-mono text-sm">{model.confidence} percent</span>
            </span>
            <span className="text-xs font-semibold text-navy">
              {expandedId === model.id ? "Hide trail" : "Show trail"} {"·"} {model.steps.length} steps
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
  return (
    <Card className="flex flex-col gap-3.5 border-navy p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-semibold">{model.name}</span>
        <Tag tone="grey">{model.role}</Tag>
        <Tag tone={voteTone(model)}>
          {model.vote}, {model.confidence} percent
        </Tag>
      </div>

      <ul className="flex flex-col gap-2.5">
        {model.steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-muted" aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2.5 border-t border-line pt-3">
        <div className="flex items-center gap-3">
          <Tag tone={voteTone(model)}>{model.vote}</Tag>
          <span className="font-mono text-sm text-muted">{model.confidence} percent</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-page"
          role="img"
          aria-label={`Confidence ${model.confidence} percent`}
        >
          <div className="h-full rounded-full bg-green-text" style={{ width: `${model.confidence}%` }} />
        </div>

        <p className="text-sm">{model.reasoning}</p>
        <p className="flex flex-wrap items-baseline gap-2 text-sm">
          <Tag tone="green">Supports</Tag>
          {model.supports}
        </p>
        <p className="flex flex-wrap items-baseline gap-2 text-sm">
          <Tag tone="amber">Insufficient</Tag>
          {model.insufficient}
        </p>
        <div className="flex flex-wrap gap-2">
          {model.sources.map((source) => (
            <Tag key={source} tone="blue">
              {source}
            </Tag>
          ))}
        </div>
      </div>
    </Card>
  );
}
