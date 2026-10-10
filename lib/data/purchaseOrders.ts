import type { PurchaseOrder } from "@/lib/db/types";
import { daysFromToday, formatDueLabel } from "@/lib/data/dates";

export type PurchaseOrderDisplayStatus =
  | "Open"
  | "Due today"
  | "Delayed"
  | "Received"
  | "Cancelled";

export function getPurchaseOrderDisplayStatus(po: PurchaseOrder): {
  label: PurchaseOrderDisplayStatus;
  note: string;
} {
  if (po.status === "Delivered") {
    return { label: "Received", note: po.actual_receipt_date ?? "" };
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
    return { label: "Due today", note: "Due today" };
  }
  return { label: "Open", note: formatDueLabel(po.expected_receipt_date) };
}

export function isPurchaseOrderDelayed(po: PurchaseOrder): boolean {
  return po.status === "In transit" && daysFromToday(po.expected_receipt_date) < 0;
}
