"use client";

import * as React from "react";
import { Search, FileText, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProvenanceTag, Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import type { PredictionRunDetail, RunModel, RunStep } from "@/lib/mock/predictionDetail";
import type { useReplay } from "@/components/predictions/useReplay";

type Selected =
  | { type: "consensus" }
  | { type: "model"; modelId: string }
  | { type: "step"; modelId: string; stepId: string };

// Canvas coordinate space the layout below is computed in, matching the
// design reference's fixed 640x560 diagram exactly; positions are converted
// to percentages so the container itself can stay fluid.
const W = 640;
const H = 560;
const CENTER = { x: 320, y: 270 };
const MODEL_CENTERS = [
  { x: 150, y: 150 },
  { x: 490, y: 150 },
  { x: 320, y: 430 },
];
const MODEL_COLOR = ["bg-navy text-white", "bg-blue-light text-ink", "bg-amber-border text-ink"];

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

export function GraphView({
  detail,
  replay,
}: {
  detail: PredictionRunDetail;
  replay: ReturnType<typeof useReplay>;
}) {
  const [selected, setSelected] = React.useState<Selected>({ type: "consensus" });

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="relative mx-auto w-full max-w-2xl" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          {detail.models.map((model, modelIndex) => {
            const mc = MODEL_CENTERS[modelIndex];
            const edgeDone = replay.isVoteRevealed(modelIndex);
            const lines = [
              <line
                key={`core-${model.id}`}
                x1={mc.x}
                y1={mc.y}
                x2={CENTER.x}
                y2={CENTER.y}
                stroke="var(--color-navy)"
                strokeWidth={2}
                opacity={edgeDone ? 1 : 0.25}
              />,
            ];
            const outward = Math.atan2(mc.y - CENTER.y, mc.x - CENTER.x);
            model.steps.forEach((step, stepIndex) => {
              const angle = outward + (stepIndex - 2) * 0.55;
              const sx = mc.x + 96 * Math.cos(angle);
              const sy = mc.y + 96 * Math.sin(angle);
              const visible = replay.isStepRevealed(modelIndex, stepIndex);
              lines.push(
                <line
                  key={step.id}
                  x1={mc.x}
                  y1={mc.y}
                  x2={sx}
                  y2={sy}
                  stroke="var(--color-line-strong)"
                  strokeWidth={1.5}
                  strokeDasharray="3 4"
                  opacity={visible ? 1 : 0.18}
                />,
              );
            });
            return lines;
          })}
        </svg>

        <button
          type="button"
          onClick={() => setSelected({ type: "consensus" })}
          aria-pressed={selected.type === "consensus"}
          aria-label={`Consensus node. ${replay.isConsensusRevealed ? detail.consensusLabel : "Not yet revealed"}`}
          className={cn(
            "absolute flex flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-green-border bg-green-tint text-xs font-semibold text-green-text transition-opacity duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
            selected.type === "consensus" && "ring-2 ring-navy",
          )}
          style={{
            left: pct(CENTER.x - 40, W),
            top: pct(CENTER.y - 40, H),
            width: pct(80, W),
            height: pct(80, H),
            opacity: replay.isConsensusRevealed ? 1 : 0.25,
          }}
        >
          <ShieldCheck size={22} aria-hidden="true" />
          Consensus
        </button>

        {detail.models.map((model, modelIndex) => (
          <GraphModelNode
            key={model.id}
            model={model}
            modelIndex={modelIndex}
            replay={replay}
            selected={selected}
            onSelectModel={() => setSelected({ type: "model", modelId: model.id })}
            onSelectStep={(stepId) => setSelected({ type: "step", modelId: model.id, stepId })}
          />
        ))}
      </div>

      <DetailPanel detail={detail} selected={selected} />
    </div>
  );
}

function GraphModelNode({
  model,
  modelIndex,
  replay,
  selected,
  onSelectModel,
  onSelectStep,
}: {
  model: RunModel;
  modelIndex: number;
  replay: ReturnType<typeof useReplay>;
  selected: Selected;
  onSelectModel: () => void;
  onSelectStep: (stepId: string) => void;
}) {
  const mc = MODEL_CENTERS[modelIndex];
  const voteRevealed = replay.isVoteRevealed(modelIndex);
  const isModelSelected = selected.type === "model" && selected.modelId === model.id;
  const outward = Math.atan2(mc.y - CENTER.y, mc.x - CENTER.x);
  const voteX = mc.x + (CENTER.x - mc.x) * 0.42;
  const voteY = mc.y + (CENTER.y - mc.y) * 0.42;

  return (
    <>
      <button
        type="button"
        onClick={onSelectModel}
        aria-pressed={isModelSelected}
        aria-label={`${model.name}, role ${model.role}`}
        className={cn(
          "absolute flex items-center justify-center rounded-full border-2 text-lg font-bold transition-opacity duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
          MODEL_COLOR[modelIndex],
          isModelSelected ? "border-ink" : "border-transparent",
        )}
        style={{ left: pct(mc.x - 32, W), top: pct(mc.y - 32, H), width: pct(64, W), height: pct(64, H) }}
      >
        {model.name[0]}
      </button>
      <div
        className="absolute text-center text-xs font-semibold text-ink"
        style={{ left: pct(mc.x - 60, W), top: pct(mc.y + 38, H), width: pct(120, W) }}
      >
        {model.name}
      </div>

      <div
        className={cn(
          "absolute flex items-center justify-center gap-1 rounded-md border-[1.5px] font-mono text-xs font-medium transition-opacity duration-150",
          voteRevealed ? "border-green-border bg-green-tint text-green-text" : "border-line bg-card text-muted",
        )}
        style={{ left: pct(voteX - 32, W), top: pct(voteY - 20, H), width: pct(64, W), height: pct(40, H), opacity: voteRevealed ? 1 : 0.3 }}
      >
        {voteRevealed ? `${model.vote} ${model.confidence}%` : "Sealed"}
      </div>

      {model.steps.map((step, stepIndex) => {
        const angle = outward + (stepIndex - 2) * 0.55;
        const sx = mc.x + 96 * Math.cos(angle);
        const sy = mc.y + 96 * Math.sin(angle);
        const visible = replay.isStepRevealed(modelIndex, stepIndex);
        const isStepSelected = selected.type === "step" && selected.modelId === model.id && selected.stepId === step.id;
        const Icon = step.icon === "search" ? Search : FileText;
        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => onSelectStep(step.id)}
              aria-pressed={isStepSelected}
              aria-label={`${model.name} step: ${step.label}${visible ? "" : ", not yet revealed"}`}
              className={cn(
                "absolute flex items-center justify-center rounded-full border-[1.5px] bg-card text-navy transition-opacity duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
                isStepSelected ? "border-navy ring-2 ring-navy" : "border-line",
              )}
              style={{ left: pct(sx - 17, W), top: pct(sy - 17, H), width: pct(34, W), height: pct(34, H), opacity: visible ? 1 : 0.25 }}
            >
              <Icon size={14} aria-hidden="true" />
            </button>
            <div
              className="absolute text-center text-xs text-strong-muted"
              style={{
                left: pct(Math.min(Math.max(sx - 56, 2), W - 114), W),
                top: pct(sy + 20, H),
                width: pct(112, W),
                opacity: visible ? 1 : 0.25,
              }}
            >
              {step.label}
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
}

function DetailPanel({ detail, selected }: { detail: PredictionRunDetail; selected: Selected }) {
  return (
    <Card className="flex w-full flex-col gap-3 p-5 lg:w-80 lg:shrink-0">
      {selected.type === "consensus" ? (
        <>
          <h3 className="text-base font-semibold">Consensus</h3>
          <Tag tone="green" className="self-start">
            {detail.consensusLabel}
          </Tag>
          <p className="text-sm text-strong-muted">{detail.claim}</p>
        </>
      ) : null}
      {selected.type === "model" ? <ModelDetail model={detail.models.find((m) => m.id === selected.modelId)!} /> : null}
      {selected.type === "step" ? (
        <StepDetail
          model={detail.models.find((m) => m.id === selected.modelId)!}
          step={detail.models
            .find((m) => m.id === selected.modelId)!
            .steps.find((s) => s.id === selected.stepId)!}
        />
      ) : null}
    </Card>
  );
}

function ModelDetail({ model }: { model: RunModel }) {
  return (
    <>
      <h3 className="text-base font-semibold">{model.name}</h3>
      <p className="text-xs text-muted">{model.version} {"·"} {model.role}</p>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Outcome</p>
        <p className="text-sm">{model.outcome}</p>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Confidence</p>
        <p className="font-mono text-sm">{model.vote} {model.confidence}%</p>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Research feed</p>
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {model.steps.map((s) => (
            <li key={s.id}>{s.label}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

function StepDetail({ model, step }: { model: RunModel; step: RunStep }) {
  return (
    <>
      <p className="text-xs text-muted">{model.name}</p>
      <h3 className="text-base font-semibold">{step.label}</h3>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">What it looked at</p>
        <p className="text-sm">{step.detail}</p>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">What it found</p>
        <p className="text-sm">{step.finding}</p>
      </div>
      <ProvenanceTag kind={step.provenance} className="self-start" />
    </>
  );
}
