// Row shapes mirror the real database schema exactly (table and column
// names). This file has no columns the schema doesn't have.

export type Facility = {
  facility_id: number;
  facility_name: string;
  facility_type: string; // e.g. "Hospital", "Clinic"
  sector: "Public" | "Private";
  district: string;
  state: string;
  size_tier: "Large" | "Medium" | "Small";
};

export type Supplier = {
  supplier_id: number;
  supplier_name: string;
  supplier_type: string;
  state: string;
  lead_time_days: number;
  reliability_score: number;
  // Proposed schema addition (flagged in Step 0): the real `suppliers` table
  // has no contact columns. Smallest change is these three nullable fields.
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type Item = {
  item_id: number;
  item_name: string;
  category: string;
  unit: string;
  unit_cost_myr: number;
  shelf_life_months: number;
  is_critical: 0 | 1;
  storage: string;
  primary_supplier_id: number;
};

export type HazeApiCategory =
  | "Good"
  | "Moderate"
  | "Unhealthy"
  | "Very unhealthy"
  | "Hazardous";

export type HazeApiWeekly = {
  facility_id: number;
  week_start: string; // ISO date
  api_avg: number;
  api_category: HazeApiCategory;
};

export type WeeklyInventory = {
  record_id: number;
  facility_id: number;
  item_id: number;
  week_start: string; // ISO date
  opening_stock: number;
  received_qty: number;
  issued_qty: number;
  unmet_demand_qty: number;
  wastage_qty: number;
  closing_stock: number;
  reorder_level: number;
  weeks_of_cover: number;
  stockout_flag: 0 | 1;
  haze_api_avg: number;
};

// Matches the real database's values, confirmed against live data:
// "In transit" and "Delivered" are the only values currently in use;
// "Cancelled" is allowed by the column but not currently used.
// "Draft" is an order still being prepared: it can be edited, and it does
// not count as incoming stock until it moves to "In transit".
export type PurchaseOrderStatus =
  | "Draft"
  | "In transit"
  | "Delivered"
  | "Cancelled";

export type PurchaseOrderCreator = "Manual" | "AiGIS";

export type PurchaseOrder = {
  po_id: number;
  facility_id: number;
  item_id: number;
  supplier_id: number;
  order_date: string; // ISO date
  qty_ordered: number;
  unit_cost_myr: number;
  expected_receipt_date: string; // ISO date
  actual_receipt_date: string | null; // ISO date
  qty_received: number | null;
  status: PurchaseOrderStatus;
  // Not in the database yet. Until the column is added, rows arrive without
  // it and are treated as "Manual".
  created_by?: PurchaseOrderCreator | null;
  // Groups the rows that belong to one PO document. Null when the order has
  // no document, in which case the row is its own single line item.
  po_doc_id?: number | null;
};

export type Batch = {
  batch_id: number;
  facility_id: number;
  item_id: number;
  lot_no: string;
  quantity: number;
  received_date: string; // ISO date
  expiry_date: string | null; // ISO date, null for non-expiring items
};
