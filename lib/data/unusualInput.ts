// Rule-based checks shown as an amber "Check this" notice before saving.
// They never block the save; see the Insights anomaly logic for the fuller
// version of this idea.

export function checkReorderLevel(previous: number | null, next: number): string | null {
  if (previous === null || previous <= 0) return null;
  if (next >= previous * 5) {
    return `This reorder level is ${Math.round(next / previous)}× the saved value (${previous}). Check this looks right.`;
  }
  return null;
}

export function checkPurchaseOrderQuantity(qtyOrdered: number, meanWeeklyIssue: number): string | null {
  if (meanWeeklyIssue <= 0) return null;
  const weeksOfUsage = qtyOrdered / meanWeeklyIssue;
  if (weeksOfUsage > 26) {
    return `This quantity covers about ${Math.round(weeksOfUsage)} weeks of usual issue. Check for an extra zero.`;
  }
  return null;
}

export function checkPurchaseOrderDates(orderDate: string, expectedReceiptDate: string): string | null {
  if (!orderDate || !expectedReceiptDate) return null;
  if (expectedReceiptDate < orderDate) {
    return "The expected receipt date is before the order date.";
  }
  return null;
}
