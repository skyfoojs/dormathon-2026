import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, noContent, ok } from "@/lib/response";

const SELECT_COLUMNS = "policy_id, description, created_at";

const idParamSchema = z.coerce.number().int().min(1);

const updatePolicySchema = z.object({
  description: z.string().trim().min(1).max(5000),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const input = updatePolicySchema.parse(await req.json());
    return ok(await updatePolicy(id, input));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    await deletePolicy(id);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}

async function updatePolicy(id: number, input: z.infer<typeof updatePolicySchema>) {
  const { data, error } = await getDb()
    .from("policies")
    .update(input)
    .eq("policy_id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Policy ${id} not found`);
  return data;
}

async function deletePolicy(id: number): Promise<void> {
  const { data, error } = await getDb().from("policies").delete().eq("policy_id", id).select("policy_id");
  if (error) throw error;
  if (!data || data.length === 0) throw new NotFoundError(`Policy ${id} not found`);
}
