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
  status: z.enum(["In transit", "Delivered", "Cancelled"]),
});

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
