import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";
import { fetchAllWeeklyInventoryForFacility } from "@/lib/queries/weeklyInventory";
import { computeWarnings, type WarningRecord } from "@/lib/data/warnings";
import type { Batch, Facility, Item, PurchaseOrder, Supplier } from "@/lib/db/types";

// Rule-based warnings computed from live data (there is no prediction_runs
// table backing this yet, see the Step 0 schema gap). Cached briefly since
// this pages through every facility's full weekly_inventory history.
let cache: { body: WarningRecord[]; expiresAt: number } | null = null;
const CACHE_MS = 2 * 60 * 1000;

export async function GET() {
  try {
    if (cache && cache.expiresAt > Date.now()) {
      return ok(cache.body);
    }
    const warnings = await buildWarnings();
    cache = { body: warnings, expiresAt: Date.now() + CACHE_MS };
    return ok(warnings);
  } catch (err) {
    return errorResponse(err);
  }
}

async function buildWarnings(): Promise<WarningRecord[]> {
  const db = getDb();

  const [facilitiesRes, itemsRes, suppliersRes] = await Promise.all([
    db.from("facilities").select("*"),
    db.from("items").select("*"),
    db.from("suppliers").select("*"),
  ]);
  if (facilitiesRes.error) throw facilitiesRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (suppliersRes.error) throw suppliersRes.error;

  const facilities = (facilitiesRes.data ?? []) as Facility[];
  const items = (itemsRes.data ?? []) as Item[];
  const suppliers = (suppliersRes.data ?? []) as Supplier[];

  const perFacility = await Promise.all(
    facilities.map(async (facility) => {
      const [weeklyInventory, poRes, batchesRes] = await Promise.all([
        fetchAllWeeklyInventoryForFacility(facility.facility_id),
        db.from("purchase_orders").select("*").eq("facility_id", facility.facility_id),
        db.from("batches").select("*").eq("facility_id", facility.facility_id),
      ]);
      if (poRes.error) throw poRes.error;
      if (batchesRes.error) throw batchesRes.error;
      return {
        facility,
        weeklyInventory,
        purchaseOrders: (poRes.data ?? []) as PurchaseOrder[],
        batches: (batchesRes.data ?? []) as Batch[],
      };
    }),
  );

  return computeWarnings({ items, suppliers, facilities: perFacility });
}
