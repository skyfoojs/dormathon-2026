import type { Batch, HazeApiWeekly, Item, PurchaseOrder, Supplier, WeeklyInventory } from "@/lib/db/types";
import { mean, pearsonCorrelation, stdDev, linearFit } from "@/lib/data/stats";
import { daysFromToday } from "@/lib/data/dates";

export type InsightsDataset = {
  weeklyInventory: WeeklyInventory[];
  hazeRows: HazeApiWeekly[];
  purchaseOrders: PurchaseOrder[];
  items: Item[];
  suppliers: Supplier[];
  batches: Batch[];
  facilityName: string;
};

function weeklyTotals(data: InsightsDataset) {
  const weeks = Array.from(new Set(data.weeklyInventory.map((r) => r.week_start))).sort();
  return weeks.map((week) => {
    const rows = data.weeklyInventory.filter((r) => r.week_start === week);
    const issued = rows.reduce((sum, r) => sum + r.issued_qty, 0);
    const received = rows.reduce((sum, r) => sum + r.received_qty, 0);
    const haze = data.hazeRows.find((h) => h.week_start === week);
    return { week, issued, received, apiAvg: haze?.api_avg ?? null };
  });
}

export type HazeDemandPoint = { week: string; apiAvg: number; issued: number };

export function getHazeDemandSeries(
  data: InsightsDataset,
): { points: HazeDemandPoint[]; r: number; fit: { slope: number; intercept: number } } {
  const totals = weeklyTotals(data).filter((t) => t.apiAvg !== null) as {
    week: string;
    apiAvg: number;
    issued: number;
    received: number;
  }[];
  const points = totals.map((t) => ({ week: t.week, apiAvg: t.apiAvg, issued: t.issued }));
  const r = pearsonCorrelation(points.map((p) => p.apiAvg), points.map((p) => p.issued));
  const fit = linearFit(points.map((p) => p.apiAvg), points.map((p) => p.issued));
  return { points, r, fit };
}

export type UnusualWeekPoint = { week: string; issued: number; isOutlier: boolean };

export function getUnusualWeeks(data: InsightsDataset): { points: UnusualWeekPoint[]; mean: number; stdDev: number } {
  const totals = weeklyTotals(data);
  const issuedValues = totals.map((t) => t.issued);
  const m = mean(issuedValues);
  const sd = stdDev(issuedValues);
  const points = totals.map((t) => ({
    week: t.week,
    issued: t.issued,
    isOutlier: Math.abs(t.issued - m) > 2 * sd,
  }));
  return { points, mean: m, stdDev: sd };
}

export type ReceiptBar = { week: string; received: number; matched: number; unmatched: number };

export function getReceiptsVsOrders(data: InsightsDataset): { bars: ReceiptBar[]; matchedShare: number } {
  const totals = weeklyTotals(data);
  const pos = data.purchaseOrders.filter((po) => po.actual_receipt_date);

  const bars = totals.map((t) => {
    const matched = pos
      .filter((po) => po.actual_receipt_date === t.week)
      .reduce((sum, po) => sum + (po.qty_received ?? 0), 0);
    const matchedCapped = Math.min(matched, t.received);
    return {
      week: t.week,
      received: t.received,
      matched: matchedCapped,
      unmatched: Math.max(0, t.received - matchedCapped),
    };
  });

  const totalReceived = bars.reduce((s, b) => s + b.received, 0);
  const totalMatched = bars.reduce((s, b) => s + b.matched, 0);
  const matchedShare = totalReceived === 0 ? 0 : totalMatched / totalReceived;

  return { bars, matchedShare };
}

export type CoverBar = { itemId: number; itemName: string; weeksOfCover: number };

export function getCoverByItem(data: InsightsDataset): CoverBar[] {
  const latestWeek = data.weeklyInventory.map((r) => r.week_start).sort().at(-1);
  if (!latestWeek) return [];
  return data.weeklyInventory
    .filter((r) => r.week_start === latestWeek)
    .map((r) => ({
      itemId: r.item_id,
      itemName: data.items.find((i) => i.item_id === r.item_id)?.item_name ?? "Unknown item",
      weeksOfCover: r.weeks_of_cover,
    }))
    .sort((a, b) => a.weeksOfCover - b.weeksOfCover);
}

export type KeyFigures = {
  seriesScanned: number;
  concerningFlags: number;
  hazeCorrelation: number;
  receiptsMatchedShare: number;
};

export function getKeyFigures(data: InsightsDataset, findingsCount: { concerning: number }): KeyFigures {
  const seriesScanned = new Set(data.weeklyInventory.map((r) => r.item_id)).size;
  const { r } = getHazeDemandSeries(data);
  const { matchedShare } = getReceiptsVsOrders(data);
  return {
    seriesScanned,
    concerningFlags: findingsCount.concerning,
    hazeCorrelation: r,
    receiptsMatchedShare: matchedShare,
  };
}

export type RelationshipNode = { id: string; label: string; kind: "supplier" | "item" | "problem" };
export type RelationshipLink = { source: string; target: string; concern: "high" | "medium" | "normal" };

export function getRelationshipGraph(data: InsightsDataset): { nodes: RelationshipNode[]; links: RelationshipLink[] } {
  const nodes: RelationshipNode[] = [];
  const links: RelationshipLink[] = [];
  const itemIdsHere = new Set(data.weeklyInventory.map((r) => r.item_id));
  const itemsHere = data.items.filter((i) => itemIdsHere.has(i.item_id));
  const suppliersHere = data.suppliers.filter((s) => itemsHere.some((i) => i.primary_supplier_id === s.supplier_id));

  for (const s of suppliersHere) {
    nodes.push({ id: `s${s.supplier_id}`, label: s.supplier_name, kind: "supplier" });
  }
  for (const i of itemsHere) {
    nodes.push({ id: `i${i.item_id}`, label: i.item_name, kind: "item" });
    links.push({
      source: `s${i.primary_supplier_id}`,
      target: `i${i.item_id}`,
      concern: i.is_critical === 1 ? "medium" : "normal",
    });
  }

  const coverRows = getCoverByItem(data);
  for (const row of coverRows.filter((r) => r.weeksOfCover < 2)) {
    const id = `p-cover-${row.itemId}`;
    nodes.push({ id, label: `${row.itemName}: low cover`, kind: "problem" });
    links.push({ source: `i${row.itemId}`, target: id, concern: row.weeksOfCover < 1 ? "high" : "medium" });
  }

  const delayedPOs = data.purchaseOrders.filter(
    (po) => po.status === "In transit" && daysFromToday(po.expected_receipt_date) < 0,
  );
  for (const po of delayedPOs) {
    const id = `p-late-${po.po_id}`;
    nodes.push({ id, label: `PO-${po.po_id}: delayed`, kind: "problem" });
    links.push({ source: `s${po.supplier_id}`, target: id, concern: "high" });
  }

  const expiring = data.batches.filter((b) => b.expiry_date && daysFromToday(b.expiry_date) < 30);
  for (const b of expiring) {
    const id = `p-expiry-${b.batch_id}`;
    nodes.push({ id, label: `Lot ${b.lot_no}: near expiry`, kind: "problem" });
    links.push({ source: `i${b.item_id}`, target: id, concern: "medium" });
  }

  return { nodes, links };
}

export type Finding = {
  id: string;
  kind: "Receipt" | "Outlier" | "Concentration" | "Pattern" | "Correlation";
  category: "concerning" | "pattern" | "data-quality";
  confidence: "low" | "medium" | "high";
  provenance: "model-output";
  title: string;
  explanation: string;
  evidence: string;
  nextStep: string;
};

export function getFindings(data: InsightsDataset): Finding[] {
  const findings: Finding[] = [];
  const { bars } = getReceiptsVsOrders(data);
  const unmatchedWeeks = bars.filter((b) => b.unmatched > 0);
  if (unmatchedWeeks.length > 0) {
    findings.push({
      id: "f-unmatched-receipts",
      kind: "Receipt",
      category: "data-quality",
      confidence: "medium",
      provenance: "model-output",
      title: "Some receipts have no linked purchase order",
      explanation: `${unmatchedWeeks.length} week(s) show received stock that does not fully match an open order's receipt for this facility.`,
      evidence: `weekly_inventory.received_qty vs purchase_orders.qty_received, weeks: ${unmatchedWeeks
        .slice(0, 8)
        .map((w) => w.week)
        .join(", ")}${unmatchedWeeks.length > 8 ? ", …" : ""}.`,
      nextStep: "Check whether these receipts belong to an order placed outside the system, or a data entry gap.",
    });
  }

  const { points: unusualPoints } = getUnusualWeeks(data);
  const outliers = unusualPoints.filter((p) => p.isOutlier);
  if (outliers.length > 0) {
    findings.push({
      id: "f-outlier-weeks",
      kind: "Outlier",
      category: "concerning",
      confidence: "medium",
      provenance: "model-output",
      title: "An issue-volume week looks like a possible typing error",
      explanation: "One or more weeks fall more than 2 standard deviations from the mean total issued quantity.",
      evidence: `weekly_inventory, weeks: ${outliers.map((o) => o.week).join(", ")}.`,
      nextStep: "Check the source rows for that week for a misplaced decimal or duplicate entry.",
    });
  }

  const itemIdsHere = new Set(data.weeklyInventory.map((r) => r.item_id));
  const concentrationSuppliers = data.suppliers.filter(
    (s) =>
      data.items.filter((i) => i.primary_supplier_id === s.supplier_id && i.is_critical === 1 && itemIdsHere.has(i.item_id))
        .length >= 2,
  );
  for (const s of concentrationSuppliers) {
    const criticalItems = data.items.filter(
      (i) => i.primary_supplier_id === s.supplier_id && i.is_critical === 1 && itemIdsHere.has(i.item_id),
    );
    findings.push({
      id: `f-concentration-${s.supplier_id}`,
      kind: "Concentration",
      category: "concerning",
      confidence: "high",
      provenance: "model-output",
      title: `${s.supplier_name} supplies several critical items`,
      explanation: `${criticalItems.length} critical items depend on this single supplier, with no backup on file.`,
      evidence: `items.primary_supplier_id = ${s.supplier_id}: ${criticalItems.map((i) => i.item_name).join(", ")}.`,
      nextStep: "Identify and record a backup supplier for at least one of these items.",
    });
  }

  const { r } = getHazeDemandSeries(data);
  findings.push({
    id: "f-haze-correlation",
    kind: "Correlation",
    category: "pattern",
    confidence: Math.abs(r) > 0.4 ? "medium" : "low",
    provenance: "model-output",
    title: Math.abs(r) > 0.4 ? "Haze appears linked to demand" : "Haze shows a weak link to demand so far",
    explanation: `Pearson correlation between weekly haze API and weekly units issued is r = ${r.toFixed(2)} across the available weeks.`,
    evidence: `haze_api_weekly.api_avg vs sum(weekly_inventory.issued_qty) per week, ${data.facilityName}.`,
    nextStep:
      Math.abs(r) > 0.4
        ? "Treat haze as a usable demand signal for respiratory items once more weeks accumulate."
        : "Keep collecting weeks before relying on haze as a demand driver; the sample is still small.",
  });

  const coverRows = getCoverByItem(data).filter((r) => r.weeksOfCover < 1);
  if (coverRows.length > 0) {
    findings.push({
      id: "f-recurring-dip",
      kind: "Pattern",
      category: "pattern",
      confidence: "medium",
      provenance: "model-output",
      title: `${coverRows.length} critical item(s) are under 1 week of cover`,
      explanation: "These items are closest to running out based on the latest weekly record.",
      evidence: `weekly_inventory, latest week, items: ${coverRows.map((r) => r.itemName).join(", ")}.`,
      nextStep: "Cross-check against open purchase orders due this week before escalating.",
    });
  }

  return findings;
}
