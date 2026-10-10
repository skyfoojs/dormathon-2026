import "server-only";
import { getDb } from "@/lib/db";
import type { DailyStockRow, SupplyOrderRow } from "@/lib/forecast/demand";
import type { Item, Supplier } from "@/lib/db/types";

// Supabase caps one request at 1000 rows, so the larger tables are paged.
const PAGE_SIZE = 1000;

export type ForecastSupplier = Pick<Supplier, "supplier_id" | "lead_time_days">;
export type ForecastItem = Item & { cover_days: number | null; reorder_level: number | null };

export async function findForecastItems(): Promise<ForecastItem[]> {
  const { data, error } = await getDb().from("items").select("*").order("item_id");
  if (error) throw error;
  return data ?? [];
}

export async function findForecastSuppliers(): Promise<ForecastSupplier[]> {
  const { data, error } = await getDb().from("suppliers").select("supplier_id, lead_time_days");
  if (error) throw error;
  return data ?? [];
}

// Neither query below filters or selects facility_id: every row belongs to
// the one facility, and the column is due to be dropped.
export async function findDailyStockRows(itemId?: number): Promise<DailyStockRow[]> {
  const rows: DailyStockRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = getDb()
      .from("daily_inventory")
      .select("item_id, inventory_date, issued_qty, unmet_demand_qty, closing_stock");
    if (itemId) query = query.eq("item_id", itemId);
    const { data, error } = await query.order("record_id").range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function findSupplyOrders(itemId?: number): Promise<SupplyOrderRow[]> {
  const rows: SupplyOrderRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = getDb()
      .from("purchase_orders")
      .select("po_id, item_id, order_date, qty_ordered, expected_receipt_date, actual_receipt_date, qty_received, status");
    if (itemId) query = query.eq("item_id", itemId);
    const { data, error } = await query.order("po_id").range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
