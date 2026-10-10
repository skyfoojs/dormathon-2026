import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";
import { ValidationError } from "@/lib/errors";
import { fetchAllWeeklyInventoryForFacility } from "@/lib/queries/weeklyInventory";

// facility_id is required, not optional: this table has 10,000+ rows, so an
// unfiltered query is not something this route offers.
const querySchema = z.object({
  facility_id: z.coerce.number().int().min(1),
  item_id: z.coerce.number().int().min(1).optional(),
  weeks: z.coerce.number().int().min(1).max(260).default(52),
});

const SELECT_COLUMNS =
  "record_id, facility_id, item_id, week_start, opening_stock, received_qty, issued_qty, unmet_demand_qty, wastage_qty, closing_stock, reorder_level, weeks_of_cover, stockout_flag, haze_api_avg";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      facility_id: searchParams.get("facility_id") ?? undefined,
      item_id: searchParams.get("item_id") ?? undefined,
      weeks: searchParams.get("weeks") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError("facility_id is required", parsed.error.issues);
    }
    return ok(await listWeeklyInventory(parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}

async function listWeeklyInventory(query: z.infer<typeof querySchema>) {
  if (query.item_id) {
    // Single item: most recent N weeks, well under the page-size cap.
    const db = getDb();
    const { data, error } = await db
      .from("weekly_inventory")
      .select(SELECT_COLUMNS)
      .eq("facility_id", query.facility_id)
      .eq("item_id", query.item_id)
      .order("week_start", { ascending: false })
      .limit(query.weeks);
    if (error) throw error;
    return (data ?? []).sort((a, b) => a.week_start.localeCompare(b.week_start));
  }

  return fetchAllWeeklyInventoryForFacility(query.facility_id);
}
