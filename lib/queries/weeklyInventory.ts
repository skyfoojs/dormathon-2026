import "server-only";
import { getDb } from "@/lib/db";
import type { WeeklyInventory } from "@/lib/db/types";

const SELECT_COLUMNS =
  "record_id, facility_id, item_id, week_start, opening_stock, received_qty, issued_qty, unmet_demand_qty, wastage_qty, closing_stock, reorder_level, weeks_of_cover, stockout_flag, haze_api_avg";

// Pages through a facility's weekly_inventory rows: this Supabase project
// caps a single request at 1000 rows, and one facility can have more than
// that across all its items and weeks.
export async function fetchAllWeeklyInventoryForFacility(facilityId: number): Promise<WeeklyInventory[]> {
  const db = getDb();
  const pageSize = 1000;
  const rows: WeeklyInventory[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("weekly_inventory")
      .select(SELECT_COLUMNS)
      .eq("facility_id", facilityId)
      .order("week_start", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as WeeklyInventory[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}
