import { Card } from "@/components/ui/Card";
import { ProvenanceTag, type ProvenanceKind } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";

export type KpiValueTone = "default" | "red" | "amber" | "green" | "violet";

const TONE_TEXT: Record<KpiValueTone, string> = {
  default: "text-ink",
  red: "text-red",
  amber: "text-amber-text",
  green: "text-green-text",
  violet: "text-violet-text",
};

export type KpiLabelTone = "muted" | "green";

const LABEL_TONE: Record<KpiLabelTone, string> = {
  muted: "font-medium text-muted",
  green: "font-semibold text-green-text",
};

export function KpiCard({
  label,
  labelTone = "muted",
  provenance,
  value,
  valueTone = "default",
  sub,
}: {
  label: string;
  labelTone?: KpiLabelTone;
  provenance?: ProvenanceKind;
  value: string;
  valueTone?: KpiValueTone;
  sub: string;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("font-mono text-xs tracking-wide uppercase", LABEL_TONE[labelTone])}>
          {label}
        </span>
        {provenance ? <ProvenanceTag kind={provenance} /> : null}
      </div>
      <div className={cn("font-mono text-3xl leading-tight font-medium", TONE_TEXT[valueTone])}>
        {value}
      </div>
      <div className="text-sm text-strong-muted">{sub}</div>
    </Card>
  );
}
