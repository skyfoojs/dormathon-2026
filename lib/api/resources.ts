import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  Batch,
  DemandForecast,
  Facility,
  HazeApiWeekly,
  Item,
  PurchaseOrder,
  Report,
  ReportStatus,
  Supplier,
  WeeklyInventory,
} from "@/lib/db/types";
import type { WarningRecord } from "@/lib/data/warnings";

export function getFacilities(): Promise<Facility[]> {
  return apiGet<Facility[]>("/api/facilities");
}

export function getItems(): Promise<Item[]> {
  return apiGet<Item[]>("/api/items?pageSize=100");
}
export function createItem(input: Omit<Item, "item_id">): Promise<Item> {
  return apiPost<Item>("/api/items", input);
}
export function updateItem(id: number, input: Omit<Item, "item_id">): Promise<Item> {
  return apiPatch<Item>(`/api/items/${id}`, input);
}
export function deleteItem(id: number): Promise<void> {
  return apiDelete(`/api/items/${id}`);
}

export function getSuppliers(): Promise<Supplier[]> {
  return apiGet<Supplier[]>("/api/suppliers?pageSize=100");
}
export function createSupplier(input: Omit<Supplier, "supplier_id">): Promise<Supplier> {
  return apiPost<Supplier>("/api/suppliers", input);
}
export function updateSupplier(id: number, input: Omit<Supplier, "supplier_id">): Promise<Supplier> {
  return apiPatch<Supplier>(`/api/suppliers/${id}`, input);
}
export function deleteSupplier(id: number): Promise<void> {
  return apiDelete(`/api/suppliers/${id}`);
}

// The route caps pageSize at 100, and a facility can have hundreds of
// purchase orders, so every caller of this needs the full list: page
// through until a page comes back short.
export async function getPurchaseOrders(facilityId: number): Promise<PurchaseOrder[]> {
  const pageSize = 100;
  const all: PurchaseOrder[] = [];
  for (let page = 1; ; page++) {
    const batch = await apiGet<PurchaseOrder[]>(
      `/api/purchase-orders?facility_id=${facilityId}&page=${page}&pageSize=${pageSize}`,
    );
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}
export function createPurchaseOrder(input: Omit<PurchaseOrder, "po_id">): Promise<PurchaseOrder> {
  return apiPost<PurchaseOrder>("/api/purchase-orders", input);
}
export function updatePurchaseOrder(id: number, input: Omit<PurchaseOrder, "po_id">): Promise<PurchaseOrder> {
  return apiPatch<PurchaseOrder>(`/api/purchase-orders/${id}`, input);
}
export function deletePurchaseOrder(id: number): Promise<void> {
  return apiDelete(`/api/purchase-orders/${id}`);
}

export function getWeeklyInventory(facilityId: number, itemId?: number, weeks = 52): Promise<WeeklyInventory[]> {
  const params = new URLSearchParams({ facility_id: String(facilityId), weeks: String(weeks) });
  if (itemId) params.set("item_id", String(itemId));
  return apiGet<WeeklyInventory[]>(`/api/weekly-inventory?${params}`);
}

export function updateReorderLevel(recordId: number, reorderLevel: number): Promise<WeeklyInventory> {
  return apiPatch<WeeklyInventory>(`/api/weekly-inventory/${recordId}`, { reorder_level: reorderLevel });
}

export function getHaze(facilityId: number): Promise<HazeApiWeekly[]> {
  return apiGet<HazeApiWeekly[]>(`/api/haze?facility_id=${facilityId}`);
}

export function getBatches(facilityId: number): Promise<Batch[]> {
  return apiGet<Batch[]>(`/api/batches?facility_id=${facilityId}`);
}

export type LiveHaze = {
  apiAvg: number;
  category: HazeApiWeekly["api_category"];
  observedAt: string | null;
  locationLabel: string;
};

export function getLiveHaze(): Promise<LiveHaze> {
  return apiGet<LiveHaze>("/api/haze-live");
}

export function getWarnings(): Promise<WarningRecord[]> {
  return apiGet<WarningRecord[]>("/api/warnings");
}

export function getReports(facilityId: number, status?: ReportStatus): Promise<Report[]> {
  const params = new URLSearchParams({ facility_id: String(facilityId) });
  if (status) params.set("status", status);
  return apiGet<Report[]>(`/api/reports?${params}`);
}

export function seedReports(facilityId: number, reset = false): Promise<{ seeded: number }> {
  return apiPost<{ seeded: number }>("/api/reports/seed", { facility_id: facilityId, reset });
}

export function approveReport(id: number): Promise<Report> {
  return apiPatch<Report>(`/api/reports/${id}`, { action: "approve" });
}
export function rejectReport(id: number): Promise<Report> {
  return apiPatch<Report>(`/api/reports/${id}`, { action: "reject" });
}
export function retryReport(id: number): Promise<Report> {
  return apiPatch<Report>(`/api/reports/${id}`, { action: "retry" });
}

export function getDemandForecasts(facilityId: number): Promise<DemandForecast[]> {
  return apiGet<DemandForecast[]>(`/api/demand-forecasts?facility_id=${facilityId}`);
}
