import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, noContent, ok } from "@/lib/response";


const idParamSchema = z.coerce.number().int().min(1);

const updateItemSchema = z.object({
  item_name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  unit_cost_myr: z.coerce.number().min(0),
  shelf_life_months: z.coerce.number().int().min(0),
  is_critical: z.union([z.literal(0), z.literal(1)]),
  storage: z.string().trim().min(1),
  primary_supplier_id: z.coerce.number().int().min(1),
  reorder_level: z.coerce.number().min(0).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const item = await findItemById(id);
    return ok(item);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const input = updateItemSchema.parse(await req.json());
    const item = await updateItem(id, input);
    return ok(item);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    await deleteItem(id);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}

async function findItemById(id: number) {
  const db = getDb();
  const { data, error } = await db.from("items").select().eq("item_id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Item ${id} not found`);
  return data;
}

async function updateItem(id: number, input: z.infer<typeof updateItemSchema>) {
  await findItemById(id);
  const db = getDb();
  const { data, error } = await db.from("items").update(input).eq("item_id", id).select().single();
  if (error) throw error;
  return data;
}

async function deleteItem(id: number) {
  await findItemById(id);
  const db = getDb();
  const { error } = await db.from("items").delete().eq("item_id", id);
  if (error) throw error;
}
