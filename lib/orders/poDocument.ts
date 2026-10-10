// Fills public/templates/po_template.html (the Pesanan Tempatan form) with
// one order's data and opens it in a new tab ready to save as a PDF.

import type { OrderRow } from "@/lib/data/inventory";

const TEMPLATE_URL = "/templates/po_template.html";
const DEFAULT_PROCUREMENT_METHOD = "PEMBELIAN TERUS";

// Mirrors the po_documents table. Every field is optional because an order
// with a single line has no document row.
export type PoDocument = {
  po_number: string;
  requester_name: string;
  requester_position: string | null;
  description: string | null;
  procurement_method: string | null;
  requested_at: string | null;
  is_repeat_purchase: boolean | null;
  previous_purchase_value_myr: number | null;
  budget_object_code: string | null;
  budget_balance_myr: number | null;
  hod_decision: string | null;
  hod_name: string | null;
  hod_position: string | null;
  hod_decided_at: string | null;
  finance_decision: string | null;
  finance_officer_name: string | null;
  finance_officer_position: string | null;
  finance_decided_at: string | null;
};

type TemplateValue = string | boolean | Record<string, string>[];
type TemplateData = Record<string, TemplateValue>;

const RM = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QTY = new Intl.NumberFormat("en-MY");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ISO date (or timestamp) to dd/mm/yyyy, the format used on the paper form.
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : RM.format(value);
}

// Renders the three template forms the PO template uses: {{name}} (escaped
// value), {{#name}}...{{/name}} (repeat for a list, or show when true) and
// {{^name}}...{{/name}} (show when false or empty).
export function renderTemplate(template: string, data: TemplateData): string {
  const withSections = template.replace(
    /\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g,
    (_match, kind: string, name: string, inner: string) => {
      const value = data[name];
      const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
      if (kind === "^") return isEmpty ? renderTemplate(inner, data) : "";
      if (Array.isArray(value)) return value.map((item) => renderTemplate(inner, { ...data, ...item })).join("");
      return isEmpty ? "" : renderTemplate(inner, data);
    },
  );
  return withSections.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const value = data[name];
    return typeof value === "string" ? escapeHtml(value) : "";
  });
}

export function buildPoTemplateData(order: OrderRow, facilityName: string, doc: PoDocument | null): TemplateData {
  return {
    facility_name: facilityName,
    po_number: doc?.po_number ?? `PO-${order.po.po_id}`,
    requester_name: doc?.requester_name ?? "",
    requester_position: doc?.requester_position ?? "",
    description: doc?.description ?? "",
    supplier_name: order.supplierName,
    order_date: formatDate(order.po.order_date),
    expected_receipt_date: formatDate(order.po.expected_receipt_date),
    procurement_method: doc?.procurement_method ?? DEFAULT_PROCUREMENT_METHOD,
    lines: order.lines.map((line, index) => ({
      bil: String(index + 1),
      description: line.itemName,
      unit_cost: RM.format(line.po.unit_cost_myr),
      qty: QTY.format(line.po.qty_ordered),
      amount: RM.format(line.po.qty_ordered * line.po.unit_cost_myr),
    })),
    total: RM.format(order.totalValue),
    is_repeat_purchase: doc?.is_repeat_purchase ?? false,
    previous_purchase_value: formatMoney(doc?.previous_purchase_value_myr),
    requested_at: formatDate(doc?.requested_at ?? order.po.order_date),
    budget_object_code: doc?.budget_object_code ?? "",
    budget_balance: formatMoney(doc?.budget_balance_myr),
    hod_decision: doc?.hod_decision ?? "",
    hod_name: doc?.hod_name ?? "",
    hod_position: doc?.hod_position ?? "",
    hod_decided_at: formatDate(doc?.hod_decided_at),
    finance_decision: doc?.finance_decision ?? "",
    finance_officer_name: doc?.finance_officer_name ?? "",
    finance_officer_position: doc?.finance_officer_position ?? "",
    finance_decided_at: formatDate(doc?.finance_decided_at),
  };
}

// Opens the filled form in a new tab and brings up the print dialog, where
// "Save as PDF" produces the file. The tab is opened before any awaiting so
// the browser treats it as the result of the click and does not block it.
export async function openPoPdf(input: {
  order: OrderRow;
  facilityName: string;
  loadDocument: (poDocId: number) => Promise<PoDocument>;
}): Promise<void> {
  const tab = window.open("", "_blank");
  if (!tab) throw new Error("The browser blocked the new tab. Allow pop-ups for this site and try again.");
  try {
    const docId = input.order.po.po_doc_id;
    const [template, doc] = await Promise.all([
      fetch(TEMPLATE_URL).then((res) => {
        if (!res.ok) throw new Error("Could not load the purchase order template.");
        return res.text();
      }),
      docId === null || docId === undefined ? null : input.loadDocument(docId),
    ]);
    const html = renderTemplate(template, buildPoTemplateData(input.order, input.facilityName, doc)).replace(
      "</body>",
      '<script>window.addEventListener("load", () => window.print());</script></body>',
    );
    tab.location.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  } catch (err) {
    tab.close();
    throw err;
  }
}
