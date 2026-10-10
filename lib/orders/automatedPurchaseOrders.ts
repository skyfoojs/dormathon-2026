import "server-only";
import { getDb } from "@/lib/db";
import { ConflictError, ServiceUnavailableError } from "@/lib/errors";
import { planRestockOrders, type PlannedOrder, type RestockPlan } from "@/lib/orders/restockPlan";
import { loadRestockInputs } from "@/lib/queries/restockInputs";

export type AutomatedOrdersResult = RestockPlan & {
  dryRun: boolean;
  // PO numbers of the orders written. Empty on a dry run.
  createdPoIds: number[];
};

const OPEN_STATUSES = ["Pending", "In transit"];
const UNIQUE_VIOLATION = "23505";

// A real run that has not finished yet. A second request that arrives in the
// meantime (a double press) is given this run's result instead of starting
// its own, which would plan the same orders before the first had saved them.
let activeRun: Promise<AutomatedOrdersResult> | null = null;

// Works out which items need restocking and raises a purchase order for each
// supplier involved, as "Pending" and created by AiGIS. With dryRun it
// returns the same plan without writing anything.
export async function runAutomatedPurchaseOrders(options: { dryRun: boolean }): Promise<AutomatedOrdersResult> {
  if (options.dryRun) {
    return { ...(await buildRestockPlan()), dryRun: true, createdPoIds: [] };
  }
  if (!activeRun) {
    activeRun = raisePlannedOrders().finally(() => {
      activeRun = null;
    });
  }
  return activeRun;
}

async function raisePlannedOrders(): Promise<AutomatedOrdersResult> {
  const plan = await withoutItemsAlreadyOnOrder(await buildRestockPlan());
  if (plan.orders.length === 0) {
    return { ...plan, dryRun: false, createdPoIds: [] };
  }
  const createdPoIds = await insertPlannedOrders(plan.orders);
  return { ...plan, dryRun: false, createdPoIds };
}

async function buildRestockPlan(): Promise<RestockPlan> {
  const inputs = await loadRestockInputs();
  return planRestockOrders({ ...inputs, today: new Date().toISOString().slice(0, 10) });
}

// Planning takes a while, so another server may have raised orders since the
// rows were read. This looks again just before writing and drops any line
// whose item now has an open order.
async function withoutItemsAlreadyOnOrder(plan: RestockPlan): Promise<RestockPlan> {
  const plannedItemIds = plan.orders.flatMap((order) => order.lines.map((line) => line.itemId));
  if (plannedItemIds.length === 0) return plan;
  const onOrder = await findItemIdsOnOrder(plannedItemIds);
  if (onOrder.size === 0) return plan;

  const dropped: RestockPlan["skipped"] = plan.orders
    .flatMap((order) => order.lines.filter((line) => onOrder.has(line.itemId)))
    .map((line) => ({ itemId: line.itemId, itemName: line.itemName, reason: "open-order" }));
  return {
    orders: plan.orders
      .map((order) => ({ ...order, lines: order.lines.filter((line) => !onOrder.has(line.itemId)) }))
      .filter((order) => order.lines.length > 0),
    skipped: [...plan.skipped, ...dropped],
  };
}

async function findItemIdsOnOrder(itemIds: number[]): Promise<Set<number>> {
  const { data, error } = await getDb()
    .from("purchase_orders")
    .select("item_id")
    .in("item_id", itemIds)
    .in("status", OPEN_STATUSES);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.item_id));
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
  if (error) throw toInsertError(error);
  const docIdByNumber = new Map((data ?? []).map((d) => [d.po_number, d.po_doc_id]));
  return new Map(multiLine.map(({ anchorPoId }) => [anchorPoId, docIdByNumber.get(`PO-${anchorPoId}`) as number]));
}

// PGRST204 is PostgREST's "column not found". Here it means purchase_orders
// has no created_by column yet, which is worth saying plainly. A unique
// violation means another request took the same PO numbers first.
function toInsertError(error: { code?: string; message?: string }): unknown {
  if (error.code === UNIQUE_VIOLATION) {
    return new ConflictError("Purchase orders are already being raised. Refresh to see them.");
  }
  if (error.code === "PGRST204" && error.message?.includes("created_by")) {
    return new ServiceUnavailableError(
      "The purchase_orders table has no created_by column yet, so AiGIS orders cannot be saved.",
    );
  }
  return error;
}
