import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";

const querySchema = z.object({
  facility_id: z.coerce.number().int().min(1),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { facility_id } = querySchema.parse({ facility_id: searchParams.get("facility_id") ?? undefined });
    return ok(await listBatches(facility_id));
  } catch (err) {
    return errorResponse(err);
  }
}

async function listBatches(facilityId: number) {
  const db = getDb();
  const { data, error } = await db
    .from("batches")
    .select("*")
    .eq("facility_id", facilityId)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
