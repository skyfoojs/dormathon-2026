import { Tag, type TagTone } from "@/components/ui/Tag";
import type { WarningSeverity } from "@/lib/data/warnings";

const SEVERITY: Record<WarningSeverity, { tone: TagTone; label: string }> = {
  high: { tone: "red", label: "High" },
  medium: { tone: "amber", label: "Medium" },
  low: { tone: "blue", label: "Low" },
};

export function SeverityPill({ severity }: { severity: WarningSeverity }) {
  const { tone, label } = SEVERITY[severity];
  return <Tag tone={tone}>{label}</Tag>;
}
