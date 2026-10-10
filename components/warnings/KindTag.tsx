import { Tag } from "@/components/ui/Tag";
import type { WarningKind } from "@/lib/data/warnings";

const KIND_LABEL: Record<WarningKind, string> = {
  restock: "Restock",
  manage: "Manage",
  "check-input": "Check input",
};

export function KindTag({ kind }: { kind: WarningKind }) {
  return <Tag tone="grey">{KIND_LABEL[kind]}</Tag>;
}

export { KIND_LABEL };
