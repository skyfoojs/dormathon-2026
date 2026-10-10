"use client";

import * as React from "react";
import { Check, FileText, Maximize, Minus, Plus, Search, ShieldCheck } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { GraphSidePanel, type GraphSelection } from "@/components/predictions/GraphSidePanel";
import { MODEL_COLOR } from "@/components/predictions/ModelBadge";
import { cn, focusRingClasses } from "@/lib/cn";
import type { PredictionRunDetail } from "@/lib/mock/predictionDetail";
import type { useReplay } from "@/components/predictions/useReplay";

// Coordinate space the diagram is laid out in. The world element is exactly
// this size (h-165 w-225) and is panned and zoomed as a whole.
const WORLD = { w: 900, h: 660 };
const CENTER = { x: 450, y: 360 };
const MODEL_ORBIT = 210;
const STEP_ORBIT = 104;
const MODEL_ANGLES = [-90, 30, 150];
const STEP_COUNT = 5;
// Half sizes of the nodes, for placing them and trimming the edges.
const STEP_HALF = 20;
const MODEL_HALF = 40;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.2;

const STEP_ICON_COLOR = ["text-navy", "text-strong-muted", "text-amber-text"];
const MODEL_RING_COLOR = ["to-blue-light", "to-blue-border", "to-amber-border"];

type Point = { x: number; y: number };
type View = { zoom: number; x: number; y: number };

// One decimal keeps server- and client-rendered coordinates identical.
function r1(value: number): number {
  return Math.round(value * 10) / 10;
}

function polar(origin: Point, radius: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: r1(origin.x + radius * Math.cos(radians)), y: r1(origin.y + radius * Math.sin(radians)) };
}

function segment(from: Point, to: Point, trimStart: number, trimEnd: number): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  return `M${r1(from.x + ux * trimStart)} ${r1(from.y + uy * trimStart)} L${r1(to.x - ux * trimEnd)} ${r1(to.y - uy * trimEnd)}`;
}

// Each model sits on a circle around the consensus node; its five steps sit
// on a smaller circle around the model, starting on the side facing the centre.
const LAYOUT = MODEL_ANGLES.map((angle) => {
  const model = polar(CENTER, MODEL_ORBIT, angle);
  const stepAngles = Array.from({ length: STEP_COUNT }, (_, k) => angle + 180 + 50 + 65 * k);
  const steps = stepAngles.map((a) => polar(model, STEP_ORBIT, a));
  const arcs = stepAngles.slice(1).map((a, k) => {
    const from = polar(model, STEP_ORBIT, stepAngles[k] + 12);
    const to = polar(model, STEP_ORBIT, a - 12);
    return `M${from.x} ${from.y} A${STEP_ORBIT} ${STEP_ORBIT} 0 0 1 ${to.x} ${to.y}`;
  });
  return {
    model,
    steps,
    arcs,
    spoke: segment(steps[STEP_COUNT - 1], model, STEP_HALF + 2, MODEL_HALF + 6),
    link: segment(model, CENTER, MODEL_HALF + 6, MODEL_HALF + 10),
  };
});

function clampZoom(zoom: number): number {
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) * 100) / 100;
}

function fitView(stage: HTMLElement): View {
  return { zoom: clampZoom(Math.min(1, stage.clientWidth / 680, stage.clientHeight / 630)), x: 0, y: 0 };
}

export function GraphView({
  detail,
  replay,
}: {
  detail: PredictionRunDetail;
  replay: ReturnType<typeof useReplay>;
}) {
  const [selection, setSelection] = React.useState<GraphSelection>({ type: "model", modelIndex: 0 });
  const [view, setView] = React.useState<View>({ zoom: 0.78, x: 0, y: 0 });
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const gridId = React.useId();

  // The wheel listener must be non-passive to stop the page scrolling while
  // zooming, which React's onWheel cannot do.
  const attachStage = React.useCallback((stage: HTMLDivElement | null) => {
    if (!stage) return;
    stageRef.current = stage;
    setView(fitView(stage));
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      setView((v) => ({ ...v, zoom: clampZoom(v.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)) }));
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("button")) return;
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, x: view.x, y: view.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setView((v) => ({
      ...v,
      x: drag.x + event.clientX - drag.pointerX,
      y: drag.y + event.clientY - drag.pointerY,
    }));
  }

  function endDrag() {
    dragRef.current = null;
  }

  const yesCount = detail.models.filter((m) => m.vote === "YES").length;
  const consensusYes = yesCount * 2 > detail.models.length;
  const consensusPercent = Math.round(
    detail.models.reduce((sum, m) => sum + m.confidence, 0) / detail.models.length,
  );
  const consensusShown = replay.isConsensusRevealed;
  const status = replay.playing ? "Replaying run" : consensusShown ? "Panel complete" : "Replay paused";

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <div
        ref={attachStage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-128 w-full min-w-0 flex-1 cursor-grab touch-none overflow-hidden rounded-card border border-line bg-page select-none active:cursor-grabbing"
      >
        <div
          className="absolute top-0 left-1/2 h-165 w-225 origin-top"
          style={{ transform: `translate(calc(-50% + ${view.x}px), ${view.y}px) scale(${view.zoom})` }}
        >
          <svg
            viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <pattern id={gridId} width={20} height={20} patternUnits="userSpaceOnUse">
                <path d="M20 0H0V20" fill="none" stroke="var(--color-line)" strokeWidth={1} />
              </pattern>
            </defs>
            <rect
              x={-2 * WORLD.w}
              y={-2 * WORLD.h}
              width={5 * WORLD.w}
              height={5 * WORLD.h}
              fill={`url(#${gridId})`}
              opacity={0.5}
            />
            {LAYOUT.map((layout, modelIndex) => {
              const voteShown = replay.isVoteRevealed(modelIndex);
              const edges = [
                ...layout.arcs.map((d, k) => ({ d, shown: replay.isStepRevealed(modelIndex, k + 1), vote: false })),
                { d: layout.spoke, shown: replay.isStepRevealed(modelIndex, STEP_COUNT - 1), vote: false },
                { d: layout.link, shown: voteShown, vote: true },
              ];
              return (
                <g key={modelIndex}>
                  <circle
                    cx={layout.model.x}
                    cy={layout.model.y}
                    r={STEP_ORBIT}
                    fill="none"
                    stroke="var(--color-line)"
                    strokeWidth={1.2}
                    strokeDasharray="2 7"
                    strokeLinecap="round"
                    className={cn(
                      "transition-opacity duration-700",
                      replay.isStepRevealed(modelIndex, 0) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {edges.map((edge) => (
                    <g
                      key={edge.d}
                      className={cn("transition-opacity duration-700", edge.shown ? "opacity-100" : "opacity-0")}
                    >
                      <path
                        d={edge.d}
                        fill="none"
                        stroke={edge.vote ? "var(--color-green-border)" : "var(--color-calc-border)"}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                      />
                      <path
                        d={edge.d}
                        fill="none"
                        stroke="var(--color-blue-light)"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeDasharray="4 10"
                        className="motion-reduce:hidden"
                      >
                        <animate attributeName="stroke-dashoffset" from="14" to="0" dur="0.9s" repeatCount="indefinite" />
                      </path>
                    </g>
                  ))}
                  {voteShown ? (
                    <circle r={3.4} fill="var(--color-navy)" opacity={0.85} className="motion-reduce:hidden">
                      <animateMotion dur="2.2s" begin={`${modelIndex * 0.5}s`} repeatCount="indefinite" path={layout.link} />
                    </circle>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {detail.models.map((model, modelIndex) => {
            const layout = LAYOUT[modelIndex];
            const voteShown = replay.isVoteRevealed(modelIndex);
            const modelSelected = selection.type === "model" && selection.modelIndex === modelIndex;
            return (
              <React.Fragment key={model.id}>
                {model.steps.map((step, stepIndex) => {
                  const shown = replay.isStepRevealed(modelIndex, stepIndex);
                  const selected =
                    selection.type === "step" &&
                    selection.modelIndex === modelIndex &&
                    selection.stepIndex === stepIndex;
                  const Icon = step.icon === "search" ? Search : FileText;
                  const at = layout.steps[stepIndex];
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "absolute h-10 w-10 transition-opacity duration-700 motion-safe:animate-floaty",
                        shown ? "opacity-100" : "opacity-0",
                      )}
                      style={{
                        left: at.x - STEP_HALF,
                        top: at.y - STEP_HALF,
                        animationDelay: `${((stepIndex * 3 + modelIndex) * 0.37) % 2.4}s`,
                      }}
                    >
                      <button
                        type="button"
                        disabled={!shown}
                        title={step.label}
                        aria-label={`${model.name} step ${stepIndex + 1}: ${step.label}`}
                        aria-pressed={selected}
                        onClick={() => setSelection({ type: "step", modelIndex, stepIndex })}
                        className={cn(
                          "relative flex h-full w-full items-center justify-center rounded-xl border-2 bg-card shadow-sm transition duration-200 hover:border-blue-light hover:shadow-md",
                          focusRingClasses,
                          STEP_ICON_COLOR[modelIndex],
                          selected ? "border-navy ring-4 ring-blue-light/30" : "border-calc-border",
                          shown ? "scale-100" : "scale-50",
                        )}
                      >
                        <Icon size={18} aria-hidden="true" />
                        {shown ? <DoneMark small /> : null}
                      </button>
                    </div>
                  );
                })}

                <div
                  className={cn(
                    "absolute h-20 w-20 transition-opacity duration-700 motion-safe:animate-floaty",
                    voteShown ? "opacity-100" : "opacity-0",
                  )}
                  style={{
                    left: layout.model.x - MODEL_HALF,
                    top: layout.model.y - MODEL_HALF,
                    animationDelay: `${modelIndex * 0.5}s`,
                  }}
                >
                  {voteShown ? <OrbitRing color={MODEL_RING_COLOR[modelIndex]} /> : null}
                  <button
                    type="button"
                    disabled={!voteShown}
                    title={model.name}
                    aria-label={`${model.name}, ${model.vote} ${model.confidence} percent`}
                    aria-pressed={modelSelected}
                    onClick={() => setSelection({ type: "model", modelIndex })}
                    className={cn(
                      "relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-3xl border-2 text-2xl leading-none font-bold shadow-sm transition duration-200 hover:shadow-md",
                      focusRingClasses,
                      MODEL_COLOR[modelIndex],
                      modelSelected ? "border-ink ring-4 ring-blue-light/30" : "border-transparent",
                      voteShown ? "scale-100" : "scale-50",
                    )}
                  >
                    {model.name[0]}
                    <span className="rounded-full bg-card/90 px-1.5 py-0.5 font-mono text-xs font-medium text-ink">
                      {model.vote} {model.confidence}%
                    </span>
                    {voteShown ? <DoneMark /> : null}
                  </button>
                </div>
              </React.Fragment>
            );
          })}

          <div
            className={cn(
              "absolute h-20 w-20 transition-opacity duration-700 motion-safe:animate-floaty",
              consensusShown ? "opacity-100" : "opacity-0",
            )}
            style={{ left: CENTER.x - MODEL_HALF, top: CENTER.y - MODEL_HALF }}
          >
            {consensusShown ? <OrbitRing color={consensusYes ? "to-green-border" : "to-red"} /> : null}
            <button
              type="button"
              disabled={!consensusShown}
              aria-label={`Consensus, ${consensusYes ? "YES" : "NO"} ${consensusPercent} percent. Show summary of all evidence.`}
              aria-pressed={selection.type === "consensus"}
              onClick={() => setSelection({ type: "consensus" })}
              className={cn(
                "relative flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-3xl border-2 text-white shadow-lg transition duration-200",
                focusRingClasses,
                consensusYes ? "border-green-border bg-green-text" : "border-red bg-red-dark",
                "ring-4",
                selection.type === "consensus"
                  ? "ring-blue-light/40"
                  : consensusYes
                    ? "ring-green-border/40"
                    : "ring-red/30",
                consensusShown ? "scale-100" : "scale-50",
              )}
            >
              <ShieldCheck size={26} aria-hidden="true" />
              <span className="text-sm leading-none font-bold">{consensusYes ? "YES" : "NO"}</span>
              <span className="font-mono text-xs">{consensusPercent}%</span>
            </button>
            <div className="absolute top-full left-1/2 flex -translate-x-1/2 flex-col items-center pt-2 text-center whitespace-nowrap">
              <span className="text-xs font-semibold text-ink">Consensus</span>
              <span className="font-mono text-xs tracking-wide text-muted uppercase">
                {detail.models.length} models voted
              </span>
            </div>
          </div>
        </div>

        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full border border-calc-border bg-card px-3 py-1 font-mono text-xs tracking-wide text-strong-muted uppercase">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-text opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-text" />
          </span>
          {status}
        </div>

        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-card shadow-sm">
          <IconButton
            aria-label="Zoom in"
            onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.2) }))}
          >
            <Plus size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            aria-label="Zoom out"
            onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.2) }))}
          >
            <Minus size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            aria-label="Fit to view"
            onClick={() => {
              if (stageRef.current) setView(fitView(stageRef.current));
            }}
          >
            <Maximize size={18} aria-hidden="true" />
          </IconButton>
          <span className="w-14 text-center font-mono text-xs text-muted">{Math.round(view.zoom * 100)}%</span>
        </div>

        <span className="absolute right-3 bottom-3 hidden rounded bg-card/90 px-2 py-0.5 text-xs text-muted sm:block">
          Scroll to zoom, drag to move
        </span>
      </div>

      <GraphSidePanel detail={detail} selection={selection} onSelect={setSelection} />
    </div>
  );
}

function DoneMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full border-2 border-card bg-green-text text-white motion-safe:animate-pop",
        small ? "h-4 w-4" : "h-5 w-5",
      )}
    >
      <Check size={small ? 8 : 10} strokeWidth={4} aria-hidden="true" />
    </span>
  );
}

// A highlight that sweeps around a node once its result is in.
function OrbitRing({ color }: { color: string }) {
  return (
    <span className="pointer-events-none absolute -inset-1 overflow-hidden rounded-3xl" aria-hidden="true">
      <span
        className={cn("absolute -inset-8 bg-conic from-transparent from-50% motion-safe:animate-orbit", color)}
      />
    </span>
  );
}
