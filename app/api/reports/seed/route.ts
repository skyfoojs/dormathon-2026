import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";
import { seedReportsForFacility } from "@/lib/reports/seedReports";

const bodySchema = z.object({
  facility_id: z.coerce.number().int().min(1),
  reset: z.boolean().optional().default(false),
});

// Demo-only: (re)generates this facility's illustrative report rows. "Reset
// sample" on the Dashboard calls this with reset: true. Remove in
// production once a real report-generation pipeline exists.
export async function POST(req: Request) {
  try {
    const { facility_id, reset } = bodySchema.parse(await req.json());
    const db = getDb();

    if (reset) {
      const { error } = await db.from("reports").delete().eq("facility_id", facility_id);
      if (error) throw error;
    } else {
      const { count, error: countError } = await db
        .from("reports")
        .select("report_id", { count: "exact", head: true })
        .eq("facility_id", facility_id);
      if (countError) throw countError;
      if (count) return ok({ seeded: 0, alreadyPresent: count });
    }

    const seeded = await seedReportsForFacility(facility_id, new Date().toISOString());
    return ok({ seeded });
  } catch (err) {
    return errorResponse(err);
  }
}
