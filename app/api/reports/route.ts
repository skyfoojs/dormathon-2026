import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";

const querySchema = z.object({
  facility_id: z.coerce.number().int().min(1),
  status: z
    .enum(["pending_approval", "sent", "confirmed_by_supplier", "delivery_failed", "rejected"])
    .optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { facility_id, status } = querySchema.parse({
      facility_id: searchParams.get("facility_id") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const db = getDb();
    let query = db
      .from("reports")
      .select("*")
      .eq("facility_id", facility_id)
      .order("generated_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    return ok(data ?? []);
  } catch (err) {
    return errorResponse(err);
  }
}
