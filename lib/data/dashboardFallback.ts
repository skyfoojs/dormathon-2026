import type { Item, Report, ReportStatus } from "@/lib/db/types";
import type { ExpectedVsActualPoint, ProductAccuracy } from "@/lib/data/dashboardReports";
import { REPORT_STATUSES } from "@/lib/data/dashboardReports";

// Hand-picked sample data shown only when the real `reports` /
// `demand_forecast_backtests` tables are empty or not migrated yet, so the
// dashboard has something to demo instead of all zeros. Every consumer of
// this module is expected to show a visible "Sample data" tag alongside it -
// never silently presented as real. Report ids start at this offset so
// approve/reject/retry can recognize and no-op on them instead of hitting
// the real API with a row that doesn't exist.
export const SAMPLE_REPORT_ID_BASE = 900000;

export function isSampleReportId(id: number): boolean {
  return id >= SAMPLE_REPORT_ID_BASE;
}

const SAMPLE_STATUS_COUNTS: Record<ReportStatus, number> = {
  pending_approval: 5,
  delivery_failed: 1,
  sent: 2,
  confirmed_by_supplier: 1,
  rejected: 1,
};

export function sampleStatusBreakdown(): { status: ReportStatus; count: number }[] {
  return REPORT_STATUSES.map((status) => ({ status, count: SAMPLE_STATUS_COUNTS[status] }));
}

export const SAMPLE_TOTAL_REPORTS = Object.values(SAMPLE_STATUS_COUNTS).reduce((a, b) => a + b, 0);
export const SAMPLE_PENDING_COUNT = SAMPLE_STATUS_COUNTS.pending_approval;

// Full 8-row sample set matching SAMPLE_STATUS_COUNTS exactly, so the donut,
// the "View all" dialog's filter counts, and the pending table all agree.
export function sampleReports(): Report[] {
  const now = Date.now();
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
  const base = (overrides: Partial<Report> & Pick<Report, "report_id" | "report_code" | "status" | "title">): Report => ({
    facility_id: 0,
    report_type: "purchase_order_report",
    recipient: "[SUPPLIER]",
    generated_at: minutesAgo(60),
    approved_by: null,
    approved_at: null,
    note: null,
    body_lines: [],
    reason: "Sample row.",
    item_id: null,
    supplier_id: null,
    po_id: null,
    ...overrides,
  });

  return [
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 1,
      report_code: "R-0501",
      status: "pending_approval",
      title: "Paracetamol 500mg, 2,400 units",
      generated_at: minutesAgo(12),
      note: "waiting for the pharmacy manager",
      body_lines: [
        { label: "Item", value: "Paracetamol 500mg" },
        { label: "Quantity", value: "2,400 units" },
        { label: "Deliver to", value: "facility pharmacy" },
        { label: "Needed by", value: "[DATE]" },
      ],
      reason: "Sample row: 180 on hand and 1.1 weeks of cover.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 2,
      report_code: "R-0502",
      status: "pending_approval",
      title: "Amoxicillin 250mg, 1,100 units",
      generated_at: minutesAgo(45),
      note: "waiting for the pharmacy manager",
      body_lines: [
        { label: "Item", value: "Amoxicillin 250mg" },
        { label: "Quantity", value: "1,100 units" },
        { label: "Deliver to", value: "facility pharmacy" },
        { label: "Needed by", value: "[DATE]" },
      ],
      reason: "Sample row: 90 on hand and 1.4 weeks of cover.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 3,
      report_code: "R-0503",
      report_type: "analytics_report",
      status: "pending_approval",
      title: "Weekly stock risk summary",
      recipient: "[RECIPIENT EMAILS]",
      generated_at: minutesAgo(360),
      note: "waiting for the pharmacy manager",
      body_lines: [
        { label: "Critical items under 2 weeks of cover", value: "4" },
        { label: "Scope", value: "This facility, this week" },
      ],
      reason: "Sample row: scheduled weekly summary for the supply team.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 4,
      report_code: "R-0504",
      status: "pending_approval",
      title: "Metformin 500mg, 3,000 units",
      generated_at: minutesAgo(90),
      note: "waiting for the pharmacy manager",
      body_lines: [
        { label: "Item", value: "Metformin 500mg" },
        { label: "Quantity", value: "3,000 units" },
        { label: "Deliver to", value: "facility pharmacy" },
        { label: "Needed by", value: "[DATE]" },
      ],
      reason: "Sample row: 140 on hand and 1.3 weeks of cover.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 5,
      report_code: "R-0505",
      status: "pending_approval",
      title: "Salbutamol 100mcg MDI inhaler, 600 units",
      generated_at: minutesAgo(150),
      note: "waiting for the pharmacy manager",
      body_lines: [
        { label: "Item", value: "Salbutamol 100mcg MDI inhaler" },
        { label: "Quantity", value: "600 units" },
        { label: "Deliver to", value: "facility pharmacy" },
        { label: "Needed by", value: "[DATE]" },
      ],
      reason: "Sample row: 60 on hand and 1.6 weeks of cover.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 6,
      report_code: "R-0506",
      status: "delivery_failed",
      title: "Ibuprofen 400mg, resend",
      generated_at: minutesAgo(600),
      approved_by: "pharmacy manager",
      approved_at: minutesAgo(580),
      note: "Email bounced: mailbox unavailable.",
      reason: "Sample row: delivery to the supplier's mail server failed after 3 attempts.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 7,
      report_code: "R-0507",
      status: "sent",
      title: "Routine restock report",
      generated_at: minutesAgo(1200),
      approved_by: "pharmacy manager",
      approved_at: minutesAgo(1190),
      reason: "Sample row: routine reorder.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 8,
      report_code: "R-0508",
      status: "sent",
      title: "Insulin glargine 100IU/mL, PO-sample",
      generated_at: minutesAgo(1260),
      approved_by: "pharmacy manager",
      approved_at: minutesAgo(1250),
      reason: "Sample row: routine reorder.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 9,
      report_code: "R-0509",
      status: "confirmed_by_supplier",
      title: "Order confirmed",
      generated_at: minutesAgo(2000),
      approved_by: "pharmacy manager",
      approved_at: minutesAgo(1990),
      reason: "Sample row: supplier confirmed receipt of the order.",
    }),
    base({
      report_id: SAMPLE_REPORT_ID_BASE + 10,
      report_code: "R-0510",
      status: "rejected",
      title: "Duplicate order, rejected",
      generated_at: minutesAgo(2800),
      approved_by: "pharmacy manager",
      approved_at: minutesAgo(2790),
      note: "Duplicate of an order already in transit.",
      reason: "Sample row: rejected as a duplicate.",
    }),
  ];
}

export function samplePendingReports(): Report[] {
  return sampleReports().filter((r) => r.status === "pending_approval");
}

// Deterministic per-item pseudo-numbers (same item -> same values every
// load), not Math.random(), so the sample doesn't visibly reshuffle.
function seeded(itemId: number, spread: number, base: number): number {
  const x = Math.sin(itemId * 999.17) * 10000;
  return base + Math.abs(x - Math.floor(x)) * spread;
}

export function sampleProductAccuracy(items: Item[]): ProductAccuracy[] {
  return items.map((item) => {
    const accuracy = Math.min(98, seeded(item.item_id, 35, 62));
    const avgMissUnits = seeded(item.item_id + 1, 40, 5);
    const weeksScored = 12;
    const weeksWithin10Pct = Math.round((accuracy / 100) * weeksScored * 0.8);
    return {
      itemId: item.item_id,
      itemName: item.item_name,
      accuracy,
      avgMissUnits,
      weeksWithin10Pct,
      weeksScored,
    };
  });
}

export function sampleExpectedVsActual(itemId: number): ExpectedVsActualPoint[] {
  const points: ExpectedVsActualPoint[] = [];
  const today = new Date();
  today.setUTCDate(today.getUTCDate() - (today.getUTCDate() % 7)); // snap to a week boundary
  const weekStart = (weeksAgo: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
    return d.toISOString().slice(0, 10);
  };
  const baseline = 80 + (itemId % 5) * 20;
  for (let i = 10; i >= 1; i--) {
    const actual = Math.round(baseline + seeded(itemId + i, 30, -15));
    const expected = Math.round(baseline + seeded(itemId + i + 50, 20, -10));
    points.push({ weekStart: weekStart(i), actual, expected });
  }
  const lastExpected = points[points.length - 1]?.expected ?? baseline;
  for (let k = 1; k <= 4; k++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + k * 7);
    points.push({ weekStart: d.toISOString().slice(0, 10), actual: null, expected: lastExpected });
  }
  return points;
}
