import { ChevronRight, type LucideIcon } from "lucide-react";
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
    <div className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-line bg-card p-3 text-center">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
          TONE_CLASSES[tone.tag],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
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

// A flow read left to right, wrapping onto new rows. On a narrow screen it
// runs top to bottom.
export function FlowChart({ stages, className }: { stages: FlowStage[]; className?: string }) {
  return (
    <ol className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {stages.map((stage, i) => {
        const nodes = toNodes(stage);
        const isLast = i === stages.length - 1;
        return (
          <li key={nodes[0].title} className="flex flex-col items-center gap-2 sm:flex-row">
            <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
              {nodes.map((node) => (
                <FlowNodeCard key={node.title} node={node} />
              ))}
            </div>
            {/* The last stage keeps the arrow's space so every box is the same width. */}
            <ChevronRight
              className={cn(
                "h-5 w-5 shrink-0 rotate-90 text-line-strong sm:rotate-0",
                isLast && "hidden sm:block sm:invisible",
              )}
              aria-hidden="true"
            />
          </li>
        );
      })}
    </ol>
  );
}
