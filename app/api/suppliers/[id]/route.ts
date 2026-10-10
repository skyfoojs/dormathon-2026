import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, noContent, ok } from "@/lib/response";


const idParamSchema = z.coerce.number().int().min(1);

const updateSupplierSchema = z.object({
  supplier_name: z.string().trim().min(1),
  supplier_type: z.string().trim().min(1),
  state: z.string().trim().min(1),
  lead_time_days: z.coerce.number().int().min(0),
  reliability_score: z.coerce.number().min(0).max(5),
  contact_name: z.string().trim().optional(),
  contact_email: z.string().trim().email().optional().or(z.literal("")),
  contact_phone: z.string().trim().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    return ok(await findSupplierById(id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const input = updateSupplierSchema.parse(await req.json());
    return ok(await updateSupplier(id, input));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    await deleteSupplier(id);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}

async function findSupplierById(id: number) {
  const db = getDb();
  const { data, error } = await db.from("suppliers").select().eq("supplier_id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Supplier ${id} not found`);
  return data;
}

async function updateSupplier(id: number, input: z.infer<typeof updateSupplierSchema>) {
  await findSupplierById(id);
  const db = getDb();
  const { data, error } = await db.from("suppliers").update(input).eq("supplier_id", id).select().single();
  if (error) throw error;
  return data;
}

async function deleteSupplier(id: number) {
  await findSupplierById(id);
  const db = getDb();
  const { error } = await db.from("suppliers").delete().eq("supplier_id", id);
  if (error) throw error;
}
