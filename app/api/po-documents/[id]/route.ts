import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";

const idParamSchema = z.coerce.number().int().min(1);

const SELECT_COLUMNS =
  "po_doc_id, po_number, requester_name, requester_position, description, procurement_method, requested_at, is_repeat_purchase, previous_purchase_value_myr, budget_object_code, budget_balance_myr, hod_decision, hod_name, hod_position, hod_decided_at, finance_decision, finance_officer_name, finance_officer_position, finance_decided_at";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    return ok(await findPoDocumentById(id));
  } catch (err) {
    return errorResponse(err);
  }
}

async function findPoDocumentById(id: number) {
  const db = getDb();
  const { data, error } = await db.from("po_documents").select(SELECT_COLUMNS).eq("po_doc_id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`PO document ${id} not found`);
  return data;
}
