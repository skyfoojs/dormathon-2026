import type { ReportStatus } from "@/lib/db/types";
import type { TagTone } from "@/components/ui/Tag";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  pending_approval: "Pending approval",
  sent: "Sent",
  confirmed_by_supplier: "Confirmed by supplier",
  delivery_failed: "Delivery failed",
  rejected: "Rejected",
};

export const STATUS_TAG_TONE: Record<ReportStatus, TagTone> = {
  pending_approval: "amber",
  sent: "blue",
  confirmed_by_supplier: "green",
  delivery_failed: "red",
  rejected: "grey",
};

// CSS variable references to existing theme tokens, not new colors: used
// for the donut chart's SVG strokes, where a Tailwind class can't apply.
export const STATUS_DOT_VAR: Record<ReportStatus, string> = {
  pending_approval: "var(--color-amber-border)",
  sent: "var(--color-blue-light)",
  confirmed_by_supplier: "var(--color-green-text)",
  delivery_failed: "var(--color-red)",
  rejected: "var(--color-line-strong)",
};

export const STATUS_DOT_CLASS: Record<ReportStatus, string> = {
  pending_approval: "bg-amber-border",
  sent: "bg-blue-light",
  confirmed_by_supplier: "bg-green-text",
  delivery_failed: "bg-red",
  rejected: "bg-line-strong",
};
