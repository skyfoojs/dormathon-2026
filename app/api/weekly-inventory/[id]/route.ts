import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";

const idParamSchema = z.coerce.number().int().min(1);

// Only reorder_level is editable here: it's the one weekly_inventory field
// the Inventory page's item form writes (see the item form's "reorder level
// at this facility" field, which updates the latest week's record).
const updateSchema = z.object({
  reorder_level: z.coerce.number().min(0),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const input = updateSchema.parse(await req.json());
    return ok(await updateReorderLevel(id, input.reorder_level));
  } catch (err) {
    return errorResponse(err);
  }
}

async function updateReorderLevel(recordId: number, reorderLevel: number) {
  const db = getDb();
  const { data: existing, error: findError } = await db
    .from("weekly_inventory")
    .select("record_id")
    .eq("record_id", recordId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new NotFoundError(`Weekly inventory record ${recordId} not found`);

  const { data, error } = await db
    .from("weekly_inventory")
    .update({ reorder_level: reorderLevel })
    .eq("record_id", recordId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
