import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, noContent, ok } from "@/lib/response";


const idParamSchema = z.coerce.number().int().min(1);

const updatePurchaseOrderSchema = z.object({
  facility_id: z.coerce.number().int().min(1),
  item_id: z.coerce.number().int().min(1),
  supplier_id: z.coerce.number().int().min(1),
  order_date: z.string().min(1),
  qty_ordered: z.coerce.number().int().min(1),
  unit_cost_myr: z.coerce.number().min(0),
  expected_receipt_date: z.string().min(1),
  actual_receipt_date: z.string().nullable().optional(),
  qty_received: z.coerce.number().int().min(0).nullable().optional(),
  status: z.enum(["Pending", "In transit", "Delivered", "Cancelled"]),
});

const orderLineSchema = z.object({
  po_id: z.coerce.number().int().min(1).optional(),
  item_id: z.coerce.number().int().min(1),
  qty_ordered: z.coerce.number().int().min(1),
  unit_cost_myr: z.coerce.number().min(0),
  qty_received: z.coerce.number().int().min(0).nullable(),
});

const saveOrderSchema = z.object({
  supplier_id: z.coerce.number().int().min(1),
  order_date: z.string().min(1),
  expected_receipt_date: z.string().min(1),
  status: z.enum(["Pending", "In transit", "Delivered", "Cancelled"]),
  actual_receipt_date: z.string().nullable(),
  lines: z.array(orderLineSchema).min(1).max(100),
});

type SaveOrderInput = z.infer<typeof saveOrderSchema>;
type OrderLineRow = { po_id: number; facility_id?: number | null; po_doc_id: number | null };

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    return ok(await findPoById(id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const input = updatePurchaseOrderSchema.parse(await req.json());
    return ok(await updatePo(id, input));
  } catch (err) {
    return errorResponse(err);
  }
}

// Saves a whole order: the header fields are written to every line, lines
// without a po_id are added, and existing lines left out are removed.
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const input = saveOrderSchema.parse(await req.json());
    return ok(await saveOrder(id, input));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    await deletePo(id);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}

async function findPoById(id: number) {
  const db = getDb();
  const { data, error } = await db.from("purchase_orders").select().eq("po_id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Purchase order ${id} not found`);
  return data;
}

async function updatePo(id: number, input: z.infer<typeof updatePurchaseOrderSchema>) {
  await findPoById(id);
  const db = getDb();
  const { data, error } = await db.from("purchase_orders").update(input).eq("po_id", id).select().single();
  if (error) throw error;
  return data;
}

async function deletePo(id: number) {
  await findPoById(id);
  const db = getDb();
  const { error } = await db.from("purchase_orders").delete().eq("po_id", id);
  if (error) throw error;
}

// supabase-js has no multi-statement transaction, so these steps run in an
// order that leaves nothing orphaned if one fails: the lines are written
// before any are removed.
async function saveOrder(id: number, input: SaveOrderInput) {
  const anchor: OrderLineRow = await findPoById(id);
  const existing = await findOrderLines(anchor);
  const existingIds = new Set(existing.map((line) => line.po_id));
  const keptIds = new Set(input.lines.flatMap((line) => (line.po_id && existingIds.has(line.po_id) ? [line.po_id] : [])));

  // A single-line order needs no document; a second line needs one to tie
  // the rows together.
  const docId = anchor.po_doc_id ?? (input.lines.length > 1 ? await insertPoDocument(id) : null);
  let nextId = input.lines.some((line) => !line.po_id || !keptIds.has(line.po_id)) ? await nextPoId() : 0;

  const rows = input.lines.map((line) => ({
    po_id: line.po_id && keptIds.has(line.po_id) ? line.po_id : nextId++,
    facility_id: anchor.facility_id,
    po_doc_id: docId,
    item_id: line.item_id,
    supplier_id: input.supplier_id,
    order_date: input.order_date,
    expected_receipt_date: input.expected_receipt_date,
    status: input.status,
    actual_receipt_date: input.status === "Delivered" ? input.actual_receipt_date : null,
    qty_ordered: line.qty_ordered,
    unit_cost_myr: line.unit_cost_myr,
    qty_received: input.status === "Delivered" ? (line.qty_received ?? line.qty_ordered) : null,
  }));

  const saved = await upsertOrderLines(rows);
  await deleteOrderLines([...existingIds].filter((lineId) => !keptIds.has(lineId)));
  return saved;
}

async function findOrderLines(anchor: OrderLineRow): Promise<OrderLineRow[]> {
  if (anchor.po_doc_id === null) return [anchor];
  const db = getDb();
  const { data, error } = await db
    .from("purchase_orders")
    .select("po_id, po_doc_id")
    .eq("po_doc_id", anchor.po_doc_id);
  if (error) throw error;
  return data ?? [];
}

// po_number and requester_name are required by po_documents. This form does
// not collect a requester, so the row records that it was entered by hand.
async function insertPoDocument(poId: number): Promise<number> {
  const db = getDb();
  const { data, error } = await db
    .from("po_documents")
    .insert({ po_number: `PO-${poId}`, requester_name: "Manual entry" })
    .select("po_doc_id")
    .single();
  if (error) throw error;
  return data.po_doc_id;
}

async function nextPoId(): Promise<number> {
  const db = getDb();
  const { data, error } = await db
    .from("purchase_orders")
    .select("po_id")
    .order("po_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.po_id ?? 0) + 1;
}

async function upsertOrderLines(rows: { po_id: number }[]) {
  const db = getDb();
  const { data, error } = await db.from("purchase_orders").upsert(rows, { onConflict: "po_id" }).select();
  if (error) throw error;
  return data ?? [];
}

async function deleteOrderLines(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();
  const { error } = await db.from("purchase_orders").delete().in("po_id", ids);
  if (error) throw error;
}
