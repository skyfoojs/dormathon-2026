import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";

// Read-only: facilities are not user-editable anywhere in this app.
export async function GET() {
  try {
    return ok(await listFacilities());
  } catch (err) {
    return errorResponse(err);
  }
}

async function listFacilities() {
  const db = getDb();
  const { data, error } = await db.from("facilities").select("*").order("facility_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
