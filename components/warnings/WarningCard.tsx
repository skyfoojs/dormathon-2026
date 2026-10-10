import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SeverityPill } from "@/components/ui/SeverityPill";
import { ProvenanceTag } from "@/components/ui/Tag";
import { KindTag } from "@/components/warnings/KindTag";
import { cn } from "@/lib/cn";
import type { WarningRecord } from "@/lib/data/warnings";

const SEVERITY_BORDER: Record<WarningRecord["severity"], string> = {
  high: "border-l-red",
  medium: "border-l-amber-border",
  low: "border-l-blue-light",
};

export function WarningCard({
  warning,
  onResolve,
  onSnooze,
}: {
  warning: WarningRecord;
  onResolve: () => void;
  onSnooze: () => void;
}) {
  return (
    <Card className={cn("flex flex-col gap-3 border-l-4 p-5", SEVERITY_BORDER[warning.severity])}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityPill severity={warning.severity} />
        <KindTag kind={warning.kind} />
        <ProvenanceTag kind={warning.provenance} />
      </div>
      <div>
        <h3 className="text-base font-semibold">{warning.title}</h3>
        <p className="mt-1 text-sm text-strong-muted">{warning.detail}</p>
      </div>
      <p className="text-sm text-muted">
        <span className="font-semibold text-strong-muted">AI check. </span>
        {warning.aiCheck}
      </p>
      <div className="rounded-md bg-page px-3 py-2 text-sm">
        <span className="font-semibold">Suggested action. </span>
        {warning.suggestedAction}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={onResolve}>
          Mark resolved
        </Button>
        <Button variant="ghost" onClick={onSnooze}>
          Snooze 24 hours
        </Button>
      </div>
    </Card>
  );
}
