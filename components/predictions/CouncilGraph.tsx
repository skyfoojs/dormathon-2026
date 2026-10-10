"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import {
  Check,
  Filter,
  Gavel,
  Maximize,
  Minus,
  Newspaper,
  Plus,
  Scale,
  Sigma,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { cn, focusRingClasses } from "@/lib/cn";
import type { CouncilMember, RunCouncil } from "@/lib/api/resources";

export type NodeStatus = "done" | "running" | "failed" | "pending" | "skipped";

type Look = { kind: "icon"; icon: LucideIcon; tone: "card" | "navy" | "green" } | { kind: "persona"; colorIndex: number; initials: string };

type StepData = {
  title: string;
  subtitle: string;
  look: Look;
  status: NodeStatus;
  selected: boolean;
  delay: number;
  onSelect: (id: string) => void;
};
type StepNode = Node<StepData, "step">;
type FlowData = { status: NodeStatus };
type FlowEdge = Edge<FlowData, "flow">;

const COLUMN_WIDTH = 190;
const ROW_HEIGHT = 140;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;

const PERSONA_COLOR = [
  "bg-navy text-white",
  "bg-blue-light text-ink",
  "bg-amber-border text-ink",
  "bg-violet-text text-white",
];
const ICON_TONE = {
  card: "bg-card text-navy border-calc-border",
  navy: "bg-navy text-white border-navy",
  green: "bg-green-text text-white border-green-border",
};
const ORBIT_COLOR = { card: "to-blue-border", navy: "to-blue-light", green: "to-green-border" };

const STAGE_ORDER: Record<string, number> = {
  algorithmic_forecast: 0,
  fetching_news: 1,
  screening: 2,
  enriching_moh: 2,
  rescreening: 2,
  cycle1: 3,
  cycle2: 4,
  reusing_last_verdict: 4,
  raising_orders: 5,
  done: 6,
};

const RUN_LABEL: Record<string, string> = {
  algorithmic_forecast: "Running algorithmic forecast",
  fetching_news: "Fetching news",
  screening: "Screening news",
  enriching_moh: "Reading MOH statements",
  rescreening: "Re-screening news",
  cycle1: "Council validating news",
  cycle2: "Council forecasting usage",
  reusing_last_verdict: "Reusing last verdict",
  raising_orders: "Raising purchase orders",
};

function DoneMark() {
  return (
    <span className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-green-text text-white motion-safe:animate-pop">
      <Check size={10} strokeWidth={4} aria-hidden="true" />
    </span>
  );
}

function FailMark() {
  return (
    <span className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-red text-white motion-safe:animate-pop">
      <X size={10} strokeWidth={4} aria-hidden="true" />
    </span>
  );
}

function OrbitRing({ color }: { color: string }) {
  return (
    <span className="pointer-events-none absolute -inset-1 overflow-hidden rounded-3xl" aria-hidden="true">
      <span className={cn("absolute -inset-8 bg-conic from-transparent from-50% motion-safe:animate-orbit", color)} />
    </span>
  );
}

function RunningPulse() {
  return (
    <span className="pointer-events-none absolute -top-1 -right-1 flex h-3 w-3" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full rounded-full bg-blue-light opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-light" />
    </span>
  );
}

function NodeFace({ look }: { look: Look }) {
  if (look.kind === "persona") {
    return (
      <span className="text-xl leading-none font-bold">{look.initials}</span>
    );
  }
  const Icon = look.icon;
  return <Icon size={26} aria-hidden="true" />;
}

function StepNodeView({ id, data }: NodeProps<StepNode>) {
  const { look, status } = data;
  const visible = status !== "pending";
  const orbit = status === "done" && look.kind === "icon" && look.tone !== "card";
  return (
    <div
      className={cn(
        "relative h-20 w-20 transition duration-700 motion-safe:animate-floaty",
        visible ? "scale-100 opacity-100" : "scale-50 opacity-0",
        status === "skipped" && "opacity-40",
      )}
      style={{ animationDelay: `${data.delay}s` }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="invisible" />
      {orbit && look.kind === "icon" ? <OrbitRing color={ORBIT_COLOR[look.tone]} /> : null}
      <button
        type="button"
        disabled={!visible}
        aria-label={`${data.title}, ${data.subtitle}, ${status}`}
        aria-pressed={data.selected}
        onClick={() => data.onSelect(id)}
        className={cn(
          "nodrag relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-3xl border-2 shadow-sm transition duration-200 hover:shadow-md",
          focusRingClasses,
          look.kind === "persona" ? PERSONA_COLOR[look.colorIndex % PERSONA_COLOR.length] : ICON_TONE[look.tone],
          look.kind === "persona" && "border-transparent",
          data.selected && "border-ink ring-4 ring-blue-light/30",
          status === "skipped" && "border-dashed",
          status === "failed" && "border-red",
        )}
      >
        <NodeFace look={look} />
        {status === "done" ? <DoneMark /> : null}
        {status === "failed" ? <FailMark /> : null}
        {status === "running" ? <RunningPulse /> : null}
      </button>
      <Handle type="source" position={Position.Right} isConnectable={false} className="invisible" />
      <div className="pointer-events-none absolute top-full left-1/2 flex w-40 -translate-x-1/2 flex-col items-center pt-2 text-center">
        <span className="text-xs leading-tight font-semibold text-ink">{data.title}</span>
        <span className="font-mono text-xs tracking-wide text-muted uppercase">{data.subtitle}</span>
      </div>
    </div>
  );
}

function FlowEdgeView({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<FlowEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });
  const status = data?.status ?? "pending";
  const dotDelay = (id.length % 7) * 0.3;
  return (
    <g className={cn("transition-opacity duration-700", status === "pending" ? "opacity-0" : "opacity-100")}>
      <path
        d={path}
        fill="none"
        stroke={status === "failed" ? "var(--color-red)" : "var(--color-calc-border)"}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeDasharray={status === "skipped" ? "3 6" : undefined}
      />
      {status === "running" ? (
        <path
          d={path}
          fill="none"
          stroke="var(--color-blue-light)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeDasharray="4 10"
          className="motion-reduce:hidden"
        >
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="0.9s" repeatCount="indefinite" />
        </path>
      ) : null}
      {status === "done" ? (
        <circle r={3.4} fill="var(--color-navy)" opacity={0.85} visibility="hidden" className="motion-reduce:hidden">
          <set attributeName="visibility" to="visible" begin={`${dotDelay}s`} fill="freeze" />
          <animateMotion dur="2.4s" begin={`${dotDelay}s`} repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
    </g>
  );
}

const NODE_TYPES = { step: StepNodeView };
const EDGE_TYPES = { flow: FlowEdgeView };

function statusFor(
  council: RunCouncil,
  stageIndex: number,
  hasData: boolean,
  nodeFailed = false,
  ready = true,
): NodeStatus {
  if (nodeFailed) return "failed";
  if (council.reused) return hasData ? "done" : "skipped";
  const { status, stage } = council.run;
  const current = STAGE_ORDER[stage ?? ""] ?? 0;
  if (status === "succeeded" || stageIndex < current) return hasData ? "done" : "skipped";
  if (stageIndex > current) return "pending";
  if (hasData) return "done";
  if (!ready) return "pending";
  return status === "failed" ? "failed" : "running";
}

function initials(persona: string): string {
  const words = persona.split(/[\s/&]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

type GraphNode = { id: string; title: string; subtitle: string; look: Look; status: NodeStatus };
type Column = GraphNode[];

function memberNode(cycle: 1 | 2, member: CouncilMember, index: number, council: RunCouncil): GraphNode {
  return {
    id: `c${cycle}-member-${member.seatId}`,
    title: member.persona,
    subtitle: `Cycle ${cycle}`,
    look: { kind: "persona", colorIndex: index, initials: initials(member.persona) },
    status: statusFor(
      council,
      cycle === 1 ? 3 : 4,
      member.called,
      member.error !== null && (member.called || !isRunning(council)),
    ),
  };
}

function isRunning(council: RunCouncil): boolean {
  return council.run.status === "running" || council.run.status === "queued";
}

function cycleColumns(council: RunCouncil, cycle: 1 | 2): Column[] {
  const data = council.cycles.find((c) => c.cycle === cycle);
  const stageIndex = cycle === 1 ? 3 : 4;
  const prefix = `c${cycle}`;
  const task = cycle === 1 ? "Validate news" : "Forecast usage";
  const members = data?.members ?? [];
  const opinionsDone = members.length > 0 && members.every((m) => m.called);
  const expectedReviews = members.filter((m) => m.called && m.error === null).length;
  const reviewsDone =
    opinionsDone && expectedReviews > 0 && (data?.reviews ?? []).filter((r) => r.called).length >= expectedReviews;
  const chairman = data?.chairman;
  return [
    members.length
      ? members.map((m, i) => memberNode(cycle, m, i, council))
      : [
          {
            id: `${prefix}-members`,
            title: `Cycle ${cycle} personas`,
            subtitle: task,
            look: { kind: "persona", colorIndex: 0, initials: "4" },
            status: statusFor(council, stageIndex, false),
          },
        ],
    [
      {
        id: `${prefix}-review`,
        title: "Peer review",
        subtitle: `Cycle ${cycle}`,
        look: { kind: "icon", icon: Scale, tone: "card" },
        status: statusFor(council, stageIndex, reviewsDone, false, opinionsDone),
      },
    ],
    [
      {
        id: `${prefix}-chairman`,
        title: "Chairman",
        subtitle: task,
        look: { kind: "icon", icon: Gavel, tone: "green" },
        status: statusFor(
          council,
          stageIndex,
          chairman?.called ?? false,
          chairman !== undefined && chairman.called && chairman.error !== null,
          reviewsDone,
        ),
      },
    ],
  ];
}

function buildColumns(council: RunCouncil): Column[] {
  const columns: Column[] = [];
  if (council.run.scope === "full" && !council.reused) {
    columns.push([
      {
        id: "algorithmic",
        title: "Algorithmic forecast",
        subtitle: "Database only",
        look: { kind: "icon", icon: Sigma, tone: "card" },
        status: statusFor(council, 0, council.algorithmic !== null && council.algorithmic.forecastCount > 0),
      },
    ]);
  }
  columns.push(
    [
      {
        id: "news",
        title: "Gather news",
        subtitle: `${council.news.articles.length} new`,
        look: { kind: "icon", icon: Newspaper, tone: "card" },
        status: statusFor(council, 1, true),
      },
    ],
    [
      {
        id: "screener",
        title: "Screener",
        subtitle: council.screener ? `${council.screener.articles.filter((a) => a.selected).length} selected` : "Filter news",
        look: { kind: "icon", icon: Filter, tone: "card" },
        status: statusFor(council, 2, council.screener !== null),
      },
    ],
    ...cycleColumns(council, 1),
    ...cycleColumns(council, 2),
    [
      {
        id: "ai",
        title: "AI forecast",
        subtitle: `${council.aiForecast.length} items`,
        look: { kind: "icon", icon: Sparkles, tone: "navy" },
        status: statusFor(council, 5, council.aiForecast.length > 0),
      },
    ],
  );
  return columns;
}

type Layout = { nodes: StepNode[]; edges: FlowEdge[]; centers: Map<string, { x: number; y: number }> };

function buildGraph(council: RunCouncil, selectedId: string | null, onSelect: (id: string) => void): Layout {
  const columns = buildColumns(council);
  const tallest = Math.max(...columns.map((c) => c.length));
  const centers = new Map<string, { x: number; y: number }>();
  const nodes = columns.flatMap((column, col) =>
    column.map((node, row): StepNode => {
      const center = { x: col * COLUMN_WIDTH, y: (row - (column.length - 1) / 2 + (tallest - 1) / 2) * ROW_HEIGHT };
      centers.set(node.id, center);
      return {
        id: node.id,
        type: "step",
        position: center,
        data: {
          title: node.title,
          subtitle: node.subtitle,
          look: node.look,
          status: node.status,
          selected: node.id === selectedId,
          delay: ((col * 3 + row) * 0.37) % 2.4,
          onSelect,
        },
      };
    }),
  );
  const edges = columns.slice(1).flatMap((column, i) =>
    columns[i].flatMap((source) =>
      column.map(
        (target): FlowEdge => ({
          id: `${source.id}->${target.id}`,
          source: source.id,
          target: target.id,
          type: "flow",
          data: { status: target.status },
        }),
      ),
    ),
  );
  return { nodes, edges, centers };
}

function ZoomControls() {
  const flow = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  return (
    <Panel position="bottom-left" className="flex items-center gap-1 rounded-md bg-card shadow-sm">
      <IconButton aria-label="Zoom in" onClick={() => flow.zoomIn({ duration: 200 })}>
        <Plus size={18} aria-hidden="true" />
      </IconButton>
      <IconButton aria-label="Zoom out" onClick={() => flow.zoomOut({ duration: 200 })}>
        <Minus size={18} aria-hidden="true" />
      </IconButton>
      <IconButton aria-label="Fit to view" onClick={() => flow.fitView({ duration: 300, padding: 0.2 })}>
        <Maximize size={18} aria-hidden="true" />
      </IconButton>
      <span className="w-14 text-center font-mono text-xs text-muted">{Math.round(zoom * 100)}%</span>
    </Panel>
  );
}

function RunStatusPill({ council }: { council: RunCouncil }) {
  const running = isRunning(council);
  const failed = council.run.status === "failed";
  const label = running
    ? (RUN_LABEL[council.run.stage ?? ""] ?? "Starting")
    : failed
      ? "Run failed"
      : council.reused
        ? "Reused last verdict"
        : "Run complete";
  return (
    <Panel
      position="top-left"
      className="flex items-center gap-2 rounded-full border border-calc-border bg-card px-3 py-1 font-mono text-xs tracking-wide text-strong-muted uppercase"
    >
      <span className="relative flex h-2 w-2">
        {running ? (
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-light opacity-75 motion-safe:animate-ping" />
        ) : null}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", failed ? "bg-red" : running ? "bg-blue-light" : "bg-green-text")} />
      </span>
      {label}
    </Panel>
  );
}

function Flow({
  council,
  selectedId,
  onSelect,
}: {
  council: RunCouncil;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const flow = useReactFlow();
  const { nodes, edges, centers } = React.useMemo(
    () => buildGraph(council, selectedId, onSelect),
    [council, selectedId, onSelect],
  );

  React.useEffect(() => {
    const center = selectedId ? centers.get(selectedId) : undefined;
    if (!center) return;
    const frame = requestAnimationFrame(() =>
      flow.setCenter(center.x, center.y, { zoom: flow.getZoom(), duration: 500 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [selectedId, centers, flow]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      nodeOrigin={[0.5, 0.5]}
      fitView
      fitViewOptions={{ padding: 0.2, minZoom: 0.7 }}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable
      aria-label="Council run steps"
    >
      <Background variant={BackgroundVariant.Lines} gap={20} color="var(--color-line)" />
      <RunStatusPill council={council} />
      <ZoomControls />
      <Panel position="bottom-right" className="hidden rounded bg-card/90 px-2 py-0.5 text-xs text-muted sm:block">
        Scroll to zoom, drag to move
      </Panel>
    </ReactFlow>
  );
}

export function CouncilGraph({
  council,
  selectedId,
  onSelect,
}: {
  council: RunCouncil;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="h-128 w-full min-w-0 flex-1 overflow-hidden rounded-card border border-line bg-page">
      <ReactFlowProvider>
        <Flow council={council} selectedId={selectedId} onSelect={onSelect} />
      </ReactFlowProvider>
    </div>
  );
}
