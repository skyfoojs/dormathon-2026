import { apiDelete, apiFetch, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  Batch,
  Facility,
  HazeApiWeekly,
  Item,
  PurchaseOrder,
  Supplier,
  WeeklyInventory,
} from "@/lib/db/types";
import type { PoDocument } from "@/lib/orders/poDocument";

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

// The API caps a page at 100 rows, so this pages until a short page comes back.
export async function getPurchaseOrders(facilityId: number): Promise<PurchaseOrder[]> {
  const pageSize = 100;
  const rows: PurchaseOrder[] = [];
  for (let page = 1; ; page++) {
    const batch = await apiGet<PurchaseOrder[]>(
      `/api/purchase-orders?facility_id=${facilityId}&pageSize=${pageSize}&page=${page}`,
    );
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}
export function createPurchaseOrder(input: Omit<PurchaseOrder, "po_id">): Promise<PurchaseOrder> {
  return apiPost<PurchaseOrder>("/api/purchase-orders", input);
}
export function updatePurchaseOrder(id: number, input: Omit<PurchaseOrder, "po_id">): Promise<PurchaseOrder> {
  return apiPatch<PurchaseOrder>(`/api/purchase-orders/${id}`, input);
}
export type PurchaseOrderDocumentInput = {
  supplier_id: number;
  order_date: string;
  expected_receipt_date: string;
  status: PurchaseOrder["status"];
  actual_receipt_date: string | null;
  lines: {
    po_id?: number;
    item_id: number;
    qty_ordered: number;
    unit_cost_myr: number;
    qty_received: number | null;
  }[];
};

// Saves a whole order: its header and every line item. `id` is the order's
// PO number, i.e. the po_id of its first line.
export function savePurchaseOrderDocument(id: number, input: PurchaseOrderDocumentInput): Promise<PurchaseOrder[]> {
  return apiFetch<PurchaseOrder[]>(`/api/purchase-orders/${id}`, { method: "PUT", body: JSON.stringify(input) });
}
export function getPoDocument(poDocId: number): Promise<PoDocument> {
  return apiGet<PoDocument>(`/api/po-documents/${poDocId}`);
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
