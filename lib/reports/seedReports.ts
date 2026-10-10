import "server-only";
import { getDb } from "@/lib/db";
import type { Report, ReportBodyLine } from "@/lib/db/types";

// Builds illustrative "generated report" rows from this facility's real
// items, suppliers and purchase orders. Reports are a proposed feature with
// no real generation pipeline yet (see Step 0 gap), so these stand in for
// what that pipeline would produce - tagged Synthetic in the UI, and never
// inventing a real supplier contact: unknown recipients stay as
// "[SUPPLIER]" / "[RECIPIENT EMAILS]" placeholders, matching the brief.
export async function seedReportsForFacility(facilityId: number, madeAt: string): Promise<number> {
  const db = getDb();

  const [itemsRes, suppliersRes, weeklyRes, posRes] = await Promise.all([
    db.from("items").select("item_id, item_name, primary_supplier_id, is_critical"),
    db.from("suppliers").select("supplier_id, supplier_name"),
    db
      .from("weekly_inventory")
      .select("item_id, week_start, closing_stock, weeks_of_cover, reorder_level")
      .eq("facility_id", facilityId)
      .order("week_start", { ascending: false })
      .limit(200),
    db
      .from("purchase_orders")
      .select("po_id, item_id, supplier_id, qty_ordered, status")
      .eq("facility_id", facilityId)
      .order("po_id", { ascending: false })
      .limit(50),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (suppliersRes.error) throw suppliersRes.error;
  if (weeklyRes.error) throw weeklyRes.error;
  if (posRes.error) throw posRes.error;

  const items = itemsRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const weekly = weeklyRes.data ?? [];
  const pos = posRes.data ?? [];
  const itemName = (id: number) => items.find((i) => i.item_id === id)?.item_name ?? "Item";
  const supplierName = (id: number | null) =>
    id ? (suppliers.find((s) => s.supplier_id === id)?.supplier_name ?? "[SUPPLIER]") : "[SUPPLIER]";

  const latestWeekByItem = new Map<number, (typeof weekly)[number]>();
  for (const row of weekly) {
    if (!latestWeekByItem.has(row.item_id)) latestWeekByItem.set(row.item_id, row);
  }
  const lowCoverItems = items
    .filter((i) => i.is_critical === 1 && latestWeekByItem.has(i.item_id))
    .map((i) => ({ item: i, row: latestWeekByItem.get(i.item_id)! }))
    .filter((x) => x.row.weeks_of_cover < 1.5)
    .sort((a, b) => a.row.weeks_of_cover - b.row.weeks_of_cover);

  const openPo = pos.find((p) => p.status === "In transit");
  const deliveredPo = pos.find((p) => p.status === "Delivered");

  const bodyLines = (lines: ReportBodyLine[]) => lines;

  const now = new Date(madeAt);
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

  const rows: Omit<Report, "report_id">[] = [];
  let seq = 405;

  const pick = (i: number) => lowCoverItems[i % Math.max(1, lowCoverItems.length)];

  // Pending approval (2 purchase order reports + 1 analytics report)
  for (let i = 0; i < 2 && lowCoverItems.length > 0; i++) {
    const { item, row } = pick(i);
    const qty = Math.max(100, Math.round((row.reorder_level - row.closing_stock) * 2));
    rows.push({
      report_code: `R-0${seq++}`,
      facility_id: facilityId,
      report_type: "purchase_order_report",
      title: `${itemName(item.item_id)}, ${qty} units`,
      recipient: supplierName(item.primary_supplier_id),
      status: "pending_approval",
      generated_at: minutesAgo(2),
      approved_by: null,
      approved_at: null,
      note: "waiting for the pharmacy manager",
      body_lines: bodyLines([
        { label: "Item", value: itemName(item.item_id) },
        { label: "Quantity", value: `${qty} units` },
        { label: "Deliver to", value: "facility pharmacy" },
        { label: "Needed by", value: "[DATE]" },
      ]),
      reason: `${row.closing_stock} on hand and ${row.weeks_of_cover.toFixed(1)} week${row.weeks_of_cover === 1 ? "" : "s"} of cover.`,
      item_id: item.item_id,
      supplier_id: item.primary_supplier_id,
      po_id: null,
    });
  }
  rows.push({
    report_code: `R-0${seq++}`,
    facility_id: facilityId,
    report_type: "analytics_report",
    title: "Weekly stock risk summary",
    recipient: "[RECIPIENT EMAILS]",
    status: "pending_approval",
    generated_at: minutesAgo(360),
    approved_by: null,
    approved_at: null,
    note: "waiting for the pharmacy manager",
    body_lines: bodyLines([
      { label: "Critical items under 2 weeks of cover", value: String(lowCoverItems.length) },
      { label: "Scope", value: "This facility, this week" },
    ]),
    reason: "Scheduled weekly summary for the supply team.",
    item_id: null,
    supplier_id: null,
    po_id: null,
  });

  // Delivery failed
  if (lowCoverItems.length > 1) {
    const { item } = lowCoverItems[1];
    rows.push({
      report_code: `R-0${seq++}`,
      facility_id: facilityId,
      report_type: "purchase_order_report",
      title: `${itemName(item.item_id)}, resend`,
      recipient: supplierName(item.primary_supplier_id),
      status: "delivery_failed",
      generated_at: minutesAgo(600),
      approved_by: "pharmacy manager",
      approved_at: minutesAgo(580),
      note: "Email bounced: mailbox unavailable.",
      body_lines: bodyLines([
        { label: "Item", value: itemName(item.item_id) },
        { label: "Deliver to", value: "facility pharmacy" },
      ]),
      reason: "Delivery to the supplier's mail server failed after 3 attempts.",
      item_id: item.item_id,
      supplier_id: item.primary_supplier_id,
      po_id: null,
    });
  }

  // Sent x2
  for (let i = 0; i < 2; i++) {
    const po = i === 0 ? openPo : deliveredPo;
    rows.push({
      report_code: `R-0${seq++}`,
      facility_id: facilityId,
      report_type: "purchase_order_report",
      title: po ? `${itemName(po.item_id)}, PO-${po.po_id}` : "Routine restock report",
      recipient: po ? supplierName(po.supplier_id) : "[SUPPLIER]",
      status: "sent",
      generated_at: minutesAgo(1200),
      approved_by: "pharmacy manager",
      approved_at: minutesAgo(1190),
      note: null,
      body_lines: bodyLines(po ? [{ label: "Item", value: itemName(po.item_id) }] : []),
      reason: "Routine reorder.",
      item_id: po?.item_id ?? null,
      supplier_id: po?.supplier_id ?? null,
      po_id: po?.po_id ?? null,
    });
  }

  // Confirmed by supplier
  rows.push({
    report_code: `R-0${seq++}`,
    facility_id: facilityId,
    report_type: "purchase_order_report",
    title: deliveredPo ? `${itemName(deliveredPo.item_id)}, confirmed` : "Order confirmed",
    recipient: deliveredPo ? supplierName(deliveredPo.supplier_id) : "[SUPPLIER]",
    status: "confirmed_by_supplier",
    generated_at: minutesAgo(2000),
    approved_by: "pharmacy manager",
    approved_at: minutesAgo(1990),
    note: null,
    body_lines: [],
    reason: "Supplier confirmed receipt of the order.",
    item_id: deliveredPo?.item_id ?? null,
    supplier_id: deliveredPo?.supplier_id ?? null,
    po_id: deliveredPo?.po_id ?? null,
  });

  // Rejected
  rows.push({
    report_code: `R-0${seq++}`,
    facility_id: facilityId,
    report_type: "purchase_order_report",
    title: "Duplicate order, rejected",
    recipient: "[SUPPLIER]",
    status: "rejected",
    generated_at: minutesAgo(2800),
    approved_by: "pharmacy manager",
    approved_at: minutesAgo(2790),
    note: "Duplicate of an order already in transit.",
    body_lines: [],
    reason: "Rejected as a duplicate.",
    item_id: null,
    supplier_id: null,
    po_id: null,
  });

  const { error } = await db.from("reports").insert(rows);
  if (error) throw error;
  return rows.length;
}
