import { ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ProvenanceTag, type ProvenanceKind } from "@/components/ui/Tag";
import { ModelBadge } from "@/components/predictions/ModelBadge";
import { StatTile } from "@/components/predictions/StatTile";
import { cn, focusRingClasses } from "@/lib/cn";
import type { PredictionRunDetail, RunModel, RunStep } from "@/lib/mock/predictionDetail";

export type GraphSelection =
  | { type: "consensus" }
  | { type: "model"; modelIndex: number }
  | { type: "step"; modelIndex: number; stepIndex: number };

function evidenceMix(steps: RunStep[]): { kind: ProvenanceKind; count: number }[] {
  const counts = new Map<ProvenanceKind, number>();
  for (const step of steps) {
    if (!step.draft) counts.set(step.provenance, (counts.get(step.provenance) ?? 0) + 1);
  }
  return [...counts].map(([kind, count]) => ({ kind, count }));
}

function PanelSection({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-md border border-line p-3", className)}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  );
}

function FeedButton({
  selected = false,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink transition-colors duration-150 hover:bg-blue-tint",
        focusRingClasses,
        selected && "bg-blue-tint",
      )}
    >
      {children}
    </button>
  );
}

export function GraphSidePanel({
  detail,
  selection,
  onSelect,
}: {
  detail: PredictionRunDetail;
  selection: GraphSelection;
  onSelect: (selection: GraphSelection) => void;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5 xl:w-72 xl:shrink-0">
      {selection.type === "consensus" ? (
        <ConsensusPanel detail={detail} onSelect={onSelect} />
      ) : (
        <ModelPanel
          model={detail.models[selection.modelIndex]}
          modelIndex={selection.modelIndex}
          stepIndex={selection.type === "step" ? selection.stepIndex : null}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function ModelPanel({
  model,
  modelIndex,
  stepIndex,
  onSelect,
}: {
  model: RunModel;
  modelIndex: number;
  stepIndex: number | null;
  onSelect: (selection: GraphSelection) => void;
}) {
  const step = stepIndex === null ? null : model.steps[stepIndex];

  return (
    <>
      <div className="flex items-center gap-3">
        <ModelBadge name={model.name} modelIndex={modelIndex} size="lg" />
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{model.name}</h3>
          <p className="font-mono text-xs text-muted">{model.version}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Outcome" value={model.vote} mono={false} />
        <StatTile label="Confidence" value={`${model.confidence}%`} />
      </div>

      <PanelSection title="Sources summary">
        <div className="flex flex-wrap gap-1.5">
          {evidenceMix(model.steps).map(({ kind, count }) => (
            <ProvenanceTag key={kind} kind={kind} count={count} />
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {model.steps
            .filter((s) => !s.draft)
            .map((s) => (
              <li key={s.id} className="flex flex-col items-start gap-1 py-2 text-sm last:pb-0">
                <ProvenanceTag kind={s.provenance} />
                {s.finding}
              </li>
            ))}
        </ul>
      </PanelSection>

      <PanelSection title="Research feed" className="bg-page">
        <ul className="flex flex-col">
          {model.steps.map((s, i) => (
            <li key={s.id}>
              <FeedButton selected={stepIndex === i} onClick={() => onSelect({ type: "step", modelIndex, stepIndex: i })}>
                <span className="h-2 w-2 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                {s.label}
              </FeedButton>
            </li>
          ))}
        </ul>
      </PanelSection>

      {step ? (
        <div className="flex flex-col gap-2 rounded-md border-2 border-navy bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>
              Step {(stepIndex as number) + 1} of {model.steps.length}
            </Eyebrow>
            <ProvenanceTag kind={step.provenance} />
          </div>
          <p className="text-sm font-semibold">{step.label}</p>
          <div className="flex flex-col text-sm">
            <Eyebrow>Looked at</Eyebrow>
            {step.detail}
          </div>
          <div className="flex flex-col text-sm">
            <Eyebrow>Found</Eyebrow>
            {step.finding}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConsensusPanel({
  detail,
  onSelect,
}: {
  detail: PredictionRunDetail;
  onSelect: (selection: GraphSelection) => void;
}) {
  const { models } = detail;
  const yesCount = models.filter((m) => m.vote === "YES").length;
  const yes = yesCount * 2 > models.length;
  const percent = Math.round(models.reduce((sum, m) => sum + m.confidence, 0) / models.length);

  return (
    <>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white",
            yes ? "bg-green-text" : "bg-red",
          )}
        >
          <ShieldCheck size={26} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold">Consensus</h3>
          <p className="font-mono text-xs text-muted">
            {yesCount} of {models.length} models voted YES
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Outcome" value={yes ? "YES" : "NO"} mono={false} />
        <StatTile label="Confidence" value={`${percent}%`} />
      </div>

      <p className="text-sm">{detail.consensusSummary}</p>

      <PanelSection title="How each model voted" className="bg-page">
        <ul className="flex flex-col">
          {models.map((m, i) => (
            <li key={m.id}>
              <FeedButton onClick={() => onSelect({ type: "model", modelIndex: i })}>
                <ModelBadge name={m.name} modelIndex={i} size="sm" />
                <span className="flex-1">{m.name}</span>
                <span className="font-mono">
                  {m.vote} {m.confidence}%
                </span>
              </FeedButton>
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection title="Evidence summary">
        <div className="flex flex-wrap gap-1.5">
          {evidenceMix(models.flatMap((m) => m.steps)).map(({ kind, count }) => (
            <ProvenanceTag key={kind} kind={kind} count={count} />
          ))}
        </div>
        <ul className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto">
          {models.flatMap((m, i) =>
            m.steps
              .filter((s) => !s.draft)
              .map((s) => (
                <li key={s.id} className="flex items-start gap-2 py-2 text-sm">
                  <ModelBadge name={m.name} modelIndex={i} size="sm" />
                  <span className="flex flex-col items-start gap-1">
                    <ProvenanceTag kind={s.provenance} />
                    {s.finding}
                  </span>
                </li>
              )),
          )}
        </ul>
      </PanelSection>
    </>
  );
}
