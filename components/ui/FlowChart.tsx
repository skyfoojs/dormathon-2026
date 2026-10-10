import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { TONE_CLASSES, type TagTone } from "@/components/ui/Tag";

// What kind of thing a node is. Each kind colours the node's icon, and its
// name is read out before the node's title.
export type FlowTone = "user" | "data" | "calc" | "external" | "ai" | "check" | "result";

export type FlowNode = {
  title: string;
  text: string;
  icon: LucideIcon;
  tone: FlowTone;
  // Where the flow leaves the chart at this node, e.g. "Yes: skip".
  exit?: string;
};

// One node, or several that happen side by side.
export type FlowStage = FlowNode | FlowNode[];

const TONES: Record<FlowTone, { tag: TagTone; label: string }> = {
  user: { tag: "dashed", label: "You" },
  data: { tag: "navy", label: "Your data" },
  calc: { tag: "grey", label: "Calculation" },
  external: { tag: "blue", label: "Outside source" },
  ai: { tag: "violet", label: "AI" },
  check: { tag: "amber", label: "Check" },
  result: { tag: "green", label: "Result" },
};

function toNodes(stage: FlowStage): FlowNode[] {
  return Array.isArray(stage) ? stage : [stage];
}

// Every box is the same size, with its content centred.
function FlowNodeCard({ node }: { node: FlowNode }) {
  const Icon = node.icon;
  const tone = TONES[node.tone];
  return (
    <div className="flex min-h-28 w-full max-w-64 flex-col items-center justify-center gap-1 rounded-md border border-line bg-card p-2 text-center">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          TONE_CLASSES[tone.tag],
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold">
        <span className="sr-only">{tone.label}: </span>
        {node.title}
      </p>
      <p className="text-sm text-strong-muted">{node.text}</p>
      {node.exit ? <p className="font-mono text-xs text-muted">{node.exit}</p> : null}
    </div>
  );
}

// A flow read top to bottom. Nodes that happen side by side share a row,
// and stack on a narrow screen.
export function FlowChart({ stages, className }: { stages: FlowStage[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col items-center gap-2", className)}>
      {stages.map((stage, i) => {
        const nodes = toNodes(stage);
        return (
          <li key={nodes[0].title} className="flex w-full flex-col items-center gap-2">
            <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:items-stretch">
              {nodes.map((node) => (
                <FlowNodeCard key={node.title} node={node} />
              ))}
            </div>
            {i < stages.length - 1 ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-line-strong" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
