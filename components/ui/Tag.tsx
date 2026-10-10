import { cn } from "@/lib/cn";

export type TagTone =
  | "navy"
  | "blue"
  | "amber"
  | "violet"
  | "grey"
  | "dashed"
  | "red"
  | "green";

export const TONE_CLASSES: Record<TagTone, string> = {
  navy: "bg-navy text-white border-navy",
  blue: "bg-blue-tint text-navy border-blue-border",
  amber: "bg-amber-bg text-amber-text border-amber-border",
  violet: "bg-violet-tint text-violet-text border-violet-border",
  grey: "bg-calc-tint text-calc-text border-calc-border",
  dashed: "bg-transparent text-strong-muted border-muted border-dashed",
  red: "bg-red text-white border-red",
  green: "bg-green-tint text-green-text border-green-border",
};

export function Tag({
  tone,
  className,
  children,
}: {
  tone: TagTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded font-mono text-xs font-medium tracking-wide uppercase",
        "border px-2 py-0.5",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type ProvenanceKind =
  | "database"
  | "public-evidence"
  | "scenario-assumption"
  | "manual-input"
  | "model-output"
  | "synthetic-data";

const PROVENANCE: Record<ProvenanceKind, { tone: TagTone; label: string }> = {
  database: { tone: "navy", label: "Database" },
  "public-evidence": { tone: "blue", label: "Public evidence" },
  "scenario-assumption": { tone: "amber", label: "Scenario assumption" },
  "manual-input": { tone: "violet", label: "Manual input" },
  "model-output": { tone: "grey", label: "Model output" },
  "synthetic-data": { tone: "dashed", label: "Synthetic data" },
};

export function ProvenanceTag({
  kind,
  count,
  className,
}: {
  kind: ProvenanceKind;
  // Shown after the label, e.g. "Database 3".
  count?: number;
  className?: string;
}) {
  const { tone, label } = PROVENANCE[kind];
  return (
    <Tag tone={tone} className={className}>
      {count === undefined ? label : `${label} ${count}`}
    </Tag>
  );
}
