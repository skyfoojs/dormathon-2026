import type { PurchaseOrder } from "@/lib/db/types";
import { daysFromToday, formatDueLabel, formatShortDate } from "@/lib/data/dates";

export type PurchaseOrderDisplayStatus =
  | "Draft"
  | "On the way"
  | "Due today"
  | "Delayed"
  | "Received"
  | "Cancelled";

export function getPurchaseOrderDisplayStatus(po: PurchaseOrder): {
  label: PurchaseOrderDisplayStatus;
  note: string;
} {
  if (po.status === "Delivered") {
    const short = po.qty_received !== null ? po.qty_ordered - po.qty_received : 0;
    const parts = [
      po.actual_receipt_date ? `On ${formatShortDate(po.actual_receipt_date)}` : null,
      short > 0 ? `${short} short` : null,
    ].filter(Boolean);
    return { label: "Received", note: parts.join(", ") };
  }
  if (po.status === "Draft") {
    return { label: "Draft", note: "Not sent yet" };
  }
  if (po.status === "Cancelled") {
    return { label: "Cancelled", note: "" };
  }
  // status === "In transit"
  const days = daysFromToday(po.expected_receipt_date);
  if (days < 0) {
    return {
      label: "Delayed",
      note: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`,
    };
  }
  if (days === 0) {
    return { label: "Due today", note: "" };
  }
  return { label: "On the way", note: formatDueLabel(po.expected_receipt_date) };
}

export function isPurchaseOrderDelayed(po: PurchaseOrder): boolean {
  return po.status === "In transit" && daysFromToday(po.expected_receipt_date) < 0;
}
