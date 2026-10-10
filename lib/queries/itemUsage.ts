import "server-only";
import { getDb } from "@/lib/db";
import type { DailyStockRow } from "@/lib/forecast/demand";
import { summariseRecentUsage, usageWindowStart, USAGE_WINDOW_DAYS, type ItemUsage } from "@/lib/forecast/usage";

// Supabase caps one request at 1000 rows; 40 items over 30 days is 1200.
const PAGE_SIZE = 1000;

// Reads the last `days` recorded days of usage for every item. The window
// ends on the latest date in daily_inventory, not on today's date, so it is
// always a full window even when data entry lags.
export async function readRecentItemUsage(days = USAGE_WINDOW_DAYS): Promise<ItemUsage[]> {
  const latestDate = await findLatestInventoryDate();
  if (!latestDate) return [];
  const rows = await findDailyStockRowsSince(usageWindowStart(latestDate, days));
  return summariseRecentUsage(rows, days);
}

async function findLatestInventoryDate(): Promise<string | null> {
  const { data, error } = await getDb()
    .from("daily_inventory")
    .select("inventory_date")
    .order("inventory_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? data.inventory_date.slice(0, 10) : null;
}

// Like the forecast loaders, this neither filters nor selects facility_id:
// every row belongs to the one facility, and the column is due to be dropped.
// inventory_date is stored as ISO text, so a string comparison orders it.
async function findDailyStockRowsSince(fromDate: string): Promise<DailyStockRow[]> {
  const rows: DailyStockRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await getDb()
      .from("daily_inventory")
      .select("item_id, inventory_date, issued_qty, unmet_demand_qty, closing_stock")
      .gte("inventory_date", fromDate)
      .order("record_id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
