import "server-only";
import { getDb } from "@/lib/db";
import { ServiceUnavailableError } from "@/lib/errors";
import { planRestockOrders, type PlannedOrder, type RestockPlan } from "@/lib/orders/restockPlan";
import {
  findDailyStockRows,
  findForecastItems,
  findForecastSuppliers,
  findSupplyOrders,
} from "@/lib/queries/forecastInputs";

export type AutomatedOrdersResult = RestockPlan & {
  dryRun: boolean;
  // PO numbers of the orders written. Empty on a dry run.
  createdPoIds: number[];
};

// Works out which items need restocking and raises a purchase order for each
// supplier involved, as "Pending" and created by AiGIS. With dryRun it
// returns the same plan without writing anything.
export async function runAutomatedPurchaseOrders(options: { dryRun: boolean }): Promise<AutomatedOrdersResult> {
  const plan = await buildRestockPlan();
  if (options.dryRun || plan.orders.length === 0) {
    return { ...plan, dryRun: options.dryRun, createdPoIds: [] };
  }
  const createdPoIds = await insertPlannedOrders(plan.orders);
  return { ...plan, dryRun: false, createdPoIds };
}

async function buildRestockPlan(): Promise<RestockPlan> {
  const [items, suppliers, dailyRows, supplyOrders] = await Promise.all([
    findForecastItems(),
    findForecastSuppliers(),
    findDailyStockRows(),
    findSupplyOrders(),
  ]);
  return planRestockOrders({
    items,
    suppliers,
    dailyByItem: groupByItem(dailyRows),
    ordersByItem: groupByItem(supplyOrders),
    today: new Date().toISOString().slice(0, 10),
  });
}

function groupByItem<T extends { item_id: number }>(rows: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const list = groups.get(row.item_id);
    if (list) list.push(row);
    else groups.set(row.item_id, [row]);
  }
  return groups;
}

// Each line is one purchase_orders row. An order with several lines gets a
// po_documents row to tie them together, the same way a manual order does.
// supabase-js has no multi-statement transaction: documents are written
// first, then every line in one insert, so a failure cannot leave half an
// order's lines behind. If the lines fail, the documents are removed again.
async function insertPlannedOrders(orders: PlannedOrder[]): Promise<number[]> {
  const [firstPoId, facilityId] = await Promise.all([findNextPoId(), findFacilityId()]);

  let nextPoId = firstPoId;
  const numbered = orders.map((order) => {
    const anchorPoId = nextPoId;
    nextPoId += order.lines.length;
    return { order, anchorPoId };
  });

  const docIdByAnchor = await insertPoDocuments(numbered.filter((n) => n.order.lines.length > 1));

  const rows = numbered.flatMap(({ order, anchorPoId }) =>
    order.lines.map((line, index) => ({
      po_id: anchorPoId + index,
      facility_id: facilityId,
      po_doc_id: docIdByAnchor.get(anchorPoId) ?? null,
      item_id: line.itemId,
      supplier_id: order.supplierId,
      order_date: order.orderDate,
      expected_receipt_date: order.expectedReceiptDate,
      qty_ordered: line.qtyOrdered,
      unit_cost_myr: line.unitCostMyr,
      status: "Pending",
      created_by: "AiGIS",
    })),
  );

  const { error } = await getDb().from("purchase_orders").insert(rows);
  if (error) {
    // Nothing points at the documents just created, so take them back out.
    await deletePoDocuments([...docIdByAnchor.values()]);
    throw toInsertError(error);
  }
  return numbered.map((n) => n.anchorPoId);
}

async function deletePoDocuments(docIds: number[]): Promise<void> {
  if (docIds.length === 0) return;
  const { error } = await getDb().from("po_documents").delete().in("po_doc_id", docIds);
  if (error) throw error;
}

async function findNextPoId(): Promise<number> {
  const { data, error } = await getDb()
    .from("purchase_orders")
    .select("po_id")
    .order("po_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.po_id ?? 0) + 1;
}

// The Orders page still lists by facility_id, so new rows carry the one the
// existing orders use. Remove this with the facility_id column.
async function findFacilityId(): Promise<number | undefined> {
  const { data, error } = await getDb().from("purchase_orders").select("facility_id").limit(1).maybeSingle();
  if (error) throw error;
  return data?.facility_id ?? undefined;
}

async function insertPoDocuments(
  multiLine: { order: PlannedOrder; anchorPoId: number }[],
): Promise<Map<number, number>> {
  if (multiLine.length === 0) return new Map();
  const { data, error } = await getDb()
    .from("po_documents")
    .insert(
      multiLine.map(({ order, anchorPoId }) => ({
        po_number: `PO-${anchorPoId}`,
        requester_name: "AiGIS",
        description: `Automated restock of ${order.lines.length} items`,
      })),
    )
    .select("po_doc_id, po_number");
  if (error) throw error;
  const docIdByNumber = new Map((data ?? []).map((d) => [d.po_number, d.po_doc_id]));
  return new Map(multiLine.map(({ anchorPoId }) => [anchorPoId, docIdByNumber.get(`PO-${anchorPoId}`) as number]));
}

// PGRST204 is PostgREST's "column not found". Here it means purchase_orders
// has no created_by column yet, which is worth saying plainly.
function toInsertError(error: { code?: string; message?: string }): unknown {
  if (error.code === "PGRST204" && error.message?.includes("created_by")) {
    return new ServiceUnavailableError(
      "The purchase_orders table has no created_by column yet, so AiGIS orders cannot be saved.",
    );
  }
  return error;
}
