import { addDays, mostRecentMonday, seededRandom, toIsoDate } from "@/lib/db/random";
import type {
  Facility,
  HazeApiCategory,
  HazeApiWeekly,
  Item,
  PurchaseOrder,
  Supplier,
  WeeklyInventory,
  Batch,
} from "@/lib/db/types";

// All data below is Synthetic data for the hackathon demo: it stands in for
// reading the real `facilities`, `suppliers`, `items`, `haze_api_weekly`,
// `weekly_inventory`, `purchase_orders` and `batches` tables, using exactly
// their real column names, so this module is the one place to swap for real
// queries later.

export const HISTORY_WEEKS = 16;
export const FORECAST_WEEKS = 4;

// Fixed, not `new Date()`: this file is imported by client components too,
// and a live clock would make server- and client-rendered output disagree
// (a hydration mismatch) as well as make the mock numbers drift over time.
const TODAY = new Date("2026-10-10T00:00:00Z");
export const TODAY_ISO = toIsoDate(TODAY);
const LATEST_WEEK_START = mostRecentMonday(TODAY);

export function weekStartAt(offsetFromLatest: number): Date {
  return addDays(LATEST_WEEK_START, offsetFromLatest * 7);
}

export const FACILITIES: Facility[] = [
  {
    facility_id: 1,
    facility_name: "Hospital Kuala Lumpur",
    facility_type: "Hospital",
    sector: "Public",
    district: "Kuala Lumpur",
    state: "Wilayah Persekutuan Kuala Lumpur",
    size_tier: "Large",
  },
  {
    facility_id: 2,
    facility_name: "Hospital Selayang",
    facility_type: "Hospital",
    sector: "Public",
    district: "Gombak",
    state: "Selangor",
    size_tier: "Medium",
  },
  {
    facility_id: 3,
    facility_name: "Klinik Kesihatan Example",
    facility_type: "Clinic",
    sector: "Public",
    district: "Example",
    state: "Selangor",
    size_tier: "Small",
  },
  {
    facility_id: 4,
    facility_name: "Gleneagles Example",
    facility_type: "Hospital",
    sector: "Private",
    district: "Example",
    state: "Selangor",
    size_tier: "Medium",
  },
];

export const SUPPLIERS: Supplier[] = [
  {
    supplier_id: 1,
    supplier_name: "MedSupply Malaysia Sdn Bhd",
    supplier_type: "Pharmaceutical distributor",
    state: "Selangor",
    lead_time_days: 7,
    reliability_score: 4.2,
    contact_name: "Nadia Rahman",
    contact_email: "nadia.rahman@medsupply.example",
    contact_phone: "+60 3-2200 1100",
  },
  {
    supplier_id: 2,
    supplier_name: "Respira Health Logistics",
    supplier_type: "PPE and respiratory supplies",
    state: "Kuala Lumpur",
    lead_time_days: 5,
    reliability_score: 4.6,
    contact_name: "Daniel Loh",
    contact_email: "daniel.loh@respirahealth.example",
    contact_phone: "+60 3-7700 2200",
  },
  {
    supplier_id: 3,
    supplier_name: "Generic Pharma Supply Co",
    supplier_type: "Generic pharmaceuticals",
    state: "Penang",
    lead_time_days: 10,
    reliability_score: 3.8,
    contact_name: "Priya Suppiah",
    contact_email: "priya.suppiah@genericpharma.example",
    contact_phone: "+60 4-3300 4400",
  },
];

export const ITEMS: Item[] = [
  {
    item_id: 1,
    item_name: "Salbutamol 100mcg MDI inhaler",
    category: "Respiratory",
    unit: "inhaler",
    unit_cost_myr: 18.5,
    shelf_life_months: 24,
    is_critical: 1,
    storage: "Room temperature",
    primary_supplier_id: 1,
  },
  {
    item_id: 2,
    item_name: "N95 respirator masks",
    category: "PPE",
    unit: "box of 20",
    unit_cost_myr: 45.0,
    shelf_life_months: 36,
    is_critical: 1,
    storage: "Room temperature",
    primary_supplier_id: 2,
  },
  {
    item_id: 3,
    item_name: "Oseltamivir 75mg capsules",
    category: "Antiviral",
    unit: "capsule",
    unit_cost_myr: 3.2,
    shelf_life_months: 36,
    is_critical: 1,
    storage: "Room temperature",
    primary_supplier_id: 3,
  },
  {
    item_id: 4,
    item_name: "Ipratropium 0.5mg nebule",
    category: "Respiratory",
    unit: "nebule",
    unit_cost_myr: 1.1,
    shelf_life_months: 18,
    is_critical: 1,
    storage: "Room temperature, protect from light",
    primary_supplier_id: 1,
  },
  {
    item_id: 5,
    item_name: "IV fluids, normal saline 1L",
    category: "General",
    unit: "bag",
    unit_cost_myr: 6.5,
    shelf_life_months: 24,
    is_critical: 1,
    storage: "Room temperature",
    primary_supplier_id: 1,
  },
  {
    item_id: 6,
    item_name: "Paracetamol 500mg tablets",
    category: "General",
    unit: "tablet",
    unit_cost_myr: 0.05,
    shelf_life_months: 36,
    is_critical: 0,
    storage: "Room temperature",
    primary_supplier_id: 3,
  },
];

export function classifyHazeApi(apiAvg: number): HazeApiCategory {
  if (apiAvg <= 50) return "Good";
  if (apiAvg <= 100) return "Moderate";
  if (apiAvg <= 200) return "Unhealthy";
  if (apiAvg <= 300) return "Very unhealthy";
  return "Hazardous";
}

function generateHazeWeekly(facilityId: number, seed: number): HazeApiWeekly[] {
  const rand = seededRandom(seed);
  const rows: HazeApiWeekly[] = [];
  let level = 38;
  for (let w = -(HISTORY_WEEKS - 1); w <= 0; w++) {
    level = Math.max(15, level + (rand() - 0.32) * 14);
    const api_avg = Math.round(level);
    rows.push({
      facility_id: facilityId,
      week_start: toIsoDate(weekStartAt(w)),
      api_avg,
      api_category: classifyHazeApi(api_avg),
    });
  }
  return rows;
}

// Only facility 1 (Hospital Kuala Lumpur) has haze and stock history in this
// demo, so the UI's empty state for facilities with no rows is exercised.
export const HAZE_API_WEEKLY: HazeApiWeekly[] = generateHazeWeekly(1, 7);

type ItemSeriesConfig = {
  itemId: number;
  openingStock: number;
  issueMean: number;
  issueJitter: number;
  reorderLevel: number;
  receipts: { weekOffset: number; qty: number; expected?: boolean }[];
  seed: number;
};

const ITEM_SERIES_CONFIG: ItemSeriesConfig[] = [
  {
    itemId: 1,
    openingStock: 420,
    issueMean: 26,
    issueJitter: 7,
    reorderLevel: 150,
    receipts: [
      { weekOffset: -12, qty: 300 },
      { weekOffset: -4, qty: 260 },
      { weekOffset: 2, qty: 280, expected: true },
    ],
    seed: 11,
  },
  {
    itemId: 2,
    openingStock: 1800,
    issueMean: 95,
    issueJitter: 20,
    reorderLevel: 400,
    receipts: [
      { weekOffset: -10, qty: 1200 },
      { weekOffset: 1, qty: 900, expected: true },
    ],
    seed: 22,
  },
  {
    itemId: 3,
    openingStock: 3000,
    issueMean: 140,
    issueJitter: 30,
    reorderLevel: 1000,
    receipts: [{ weekOffset: -8, qty: 2500 }],
    seed: 33,
  },
  {
    itemId: 4,
    openingStock: 930,
    issueMean: 55,
    issueJitter: 8,
    reorderLevel: 300,
    receipts: [],
    seed: 44,
  },
  {
    itemId: 5,
    openingStock: 2600,
    issueMean: 160,
    issueJitter: 25,
    reorderLevel: 800,
    receipts: [
      { weekOffset: -11, qty: 1800 },
      { weekOffset: -3, qty: 1500 },
    ],
    seed: 55,
  },
  {
    itemId: 6,
    openingStock: 50000,
    issueMean: 2200,
    issueJitter: 400,
    reorderLevel: 8000,
    receipts: [{ weekOffset: -9, qty: 20000 }],
    seed: 66,
  },
];

function hazeAvgForWeekOffset(weekOffset: number): number {
  const iso = toIsoDate(weekStartAt(weekOffset));
  const row = HAZE_API_WEEKLY.find((h) => h.week_start === iso);
  return row ? row.api_avg : 0;
}

let recordIdCounter = 1;

function generateWeeklyInventory(facilityId: number, config: ItemSeriesConfig): WeeklyInventory[] {
  const rand = seededRandom(config.seed);
  const rows: WeeklyInventory[] = [];
  let opening = config.openingStock;
  const recentIssues: number[] = [];

  for (let w = -(HISTORY_WEEKS - 1); w <= 0; w++) {
    const receipt = config.receipts.find((r) => r.weekOffset === w && !r.expected);
    const received_qty = receipt ? receipt.qty : 0;
    const jitter = (rand() - 0.5) * 2 * config.issueJitter;
    const issued_qty = Math.max(0, Math.round(config.issueMean + jitter));
    const wastage_qty = Math.round(issued_qty * 0.01);
    const available = opening + received_qty;
    const actualIssued = Math.min(issued_qty, available);
    const unmet_demand_qty = Math.max(0, issued_qty - available);
    const closing_stock = Math.max(0, available - actualIssued - wastage_qty);

    recentIssues.push(actualIssued);
    if (recentIssues.length > 6) recentIssues.shift();
    const meanIssue = recentIssues.reduce((a, b) => a + b, 0) / recentIssues.length;
    const weeks_of_cover = meanIssue > 0 ? Math.round((closing_stock / meanIssue) * 100) / 100 : 0;

    rows.push({
      record_id: recordIdCounter++,
      facility_id: facilityId,
      item_id: config.itemId,
      week_start: toIsoDate(weekStartAt(w)),
      opening_stock: opening,
      received_qty,
      issued_qty: actualIssued,
      unmet_demand_qty,
      wastage_qty,
      closing_stock,
      reorder_level: config.reorderLevel,
      weeks_of_cover,
      stockout_flag: closing_stock <= 0 ? 1 : 0,
      haze_api_avg: hazeAvgForWeekOffset(w),
    });

    opening = closing_stock;
  }

  return rows;
}

export const WEEKLY_INVENTORY: WeeklyInventory[] = ITEM_SERIES_CONFIG.flatMap((config) =>
  generateWeeklyInventory(1, config),
);

let poIdCounter = 1;

function purchaseOrdersForItem(config: ItemSeriesConfig, supplierId: number): PurchaseOrder[] {
  return config.receipts.map((r) => {
    const expected = weekStartAt(r.weekOffset);
    const orderDate = addDays(expected, -9);
    const isFuture = r.weekOffset > 0;
    return {
      po_id: poIdCounter++,
      facility_id: 1,
      item_id: config.itemId,
      supplier_id: supplierId,
      order_date: toIsoDate(orderDate),
      qty_ordered: r.qty,
      unit_cost_myr: ITEMS.find((i) => i.item_id === config.itemId)!.unit_cost_myr,
      expected_receipt_date: toIsoDate(expected),
      actual_receipt_date: isFuture ? null : toIsoDate(expected),
      qty_received: isFuture ? null : r.qty,
      status: isFuture ? "In transit" : "Delivered",
    };
  });
}

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  ...ITEM_SERIES_CONFIG.flatMap((config) =>
    purchaseOrdersForItem(config, ITEMS.find((i) => i.item_id === config.itemId)!.primary_supplier_id),
  ),
  {
    po_id: poIdCounter++,
    facility_id: 1,
    item_id: 4,
    supplier_id: 1,
    order_date: toIsoDate(weekStartAt(-3)),
    qty_ordered: 400,
    unit_cost_myr: 1.1,
    expected_receipt_date: toIsoDate(addDays(weekStartAt(-1), 2)),
    actual_receipt_date: null,
    qty_received: null,
    status: "In transit",
  },
  {
    po_id: poIdCounter++,
    facility_id: 1,
    item_id: 6,
    supplier_id: 3,
    order_date: toIsoDate(weekStartAt(-6)),
    qty_ordered: 15000,
    unit_cost_myr: 0.05,
    expected_receipt_date: toIsoDate(weekStartAt(-5)),
    actual_receipt_date: null,
    qty_received: null,
    status: "Cancelled",
  },
];

export const BATCHES: Batch[] = [
  {
    batch_id: 1,
    facility_id: 1,
    item_id: 3,
    lot_no: "OSE-2208",
    quantity: 240,
    received_date: toIsoDate(weekStartAt(-8)),
    expiry_date: toIsoDate(addDays(TODAY, 18)),
  },
  {
    batch_id: 2,
    facility_id: 1,
    item_id: 1,
    lot_no: "SAL-1091",
    quantity: 260,
    received_date: toIsoDate(weekStartAt(-4)),
    expiry_date: toIsoDate(addDays(TODAY, 540)),
  },
  {
    batch_id: 3,
    facility_id: 1,
    item_id: 5,
    lot_no: "IVF-3380",
    quantity: 1500,
    received_date: toIsoDate(weekStartAt(-3)),
    expiry_date: toIsoDate(addDays(TODAY, 360)),
  },
];
