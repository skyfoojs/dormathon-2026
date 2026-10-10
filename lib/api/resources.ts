import { apiDelete, apiFetch, apiGet, apiPatch, apiPost } from "@/lib/api/client";
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
import type { ItemAccuracy } from "@/lib/forecast/accuracy";
import type { RestockTrigger, StockPoint } from "@/lib/forecast/runout";
import type { ItemStockStatus } from "@/lib/orders/restockPlan";
import type { SyncRun, SyncScope } from "@/lib/ai/sync";

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
export function deletePurchaseOrder(id: number): Promise<void> {
  return apiDelete(`/api/purchase-orders/${id}`);
}

export function getWeeklyInventory(facilityId: number, itemId?: number, weeks = 52): Promise<WeeklyInventory[]> {
  const params = new URLSearchParams({ facility_id: String(facilityId), weeks: String(weeks) });
  if (itemId) params.set("item_id", String(itemId));
  return apiGet<WeeklyInventory[]>(`/api/weekly-inventory?${params}`);
}

export type DailyStock = {
  item_id: number;
  item_name: string;
  unit: string | null;
  inventory_date: string;
  entered: boolean;
  opening_stock: number;
  received_qty: number | null;
  issued_qty: number | null;
  unmet_demand_qty: number | null;
  wastage_qty: number | null;
  closing_stock: number | null;
  stockout: boolean | null;
};

export type DailyStockInput = {
  item_id: number;
  inventory_date: string;
  received_qty: number;
  issued_qty: number;
  unmet_demand_qty: number;
  wastage_qty: number;
};

export type DailyStockDayCount = { date: string; entered: number };

export function getDailyStock(date: string): Promise<DailyStock[]> {
  return apiGet<DailyStock[]>(`/api/daily-inventory?date=${date}&pageSize=100`);
}

export function getDailyStockDayCounts(month: string): Promise<DailyStockDayCount[]> {
  return apiGet<DailyStockDayCount[]>(`/api/daily-inventory/days?month=${month}`);
}

export function saveDailyStock(input: DailyStockInput): Promise<DailyStock> {
  return apiFetch<DailyStock>("/api/daily-inventory", { method: "PUT", body: JSON.stringify(input) });
}


type ForecastLine = {
  usagePerDay: number;
  weeklyForecastQty: number;
  buyQty: number | null;
  projection: StockPoint[];
  arrivals: { date: string; qty: number }[];
  threshold: number;
  trigger: RestockTrigger | null;
  stockoutDate: string | null;
};

export type AlgorithmicForecastLine = ForecastLine & {
  holtPerDay: number | null;
  wmaPerDay: number | null;
  holtWeight: number | null;
  holtProjection: StockPoint[] | null;
  wmaProjection: StockPoint[] | null;
  forecastId: number;
  madeAt: string;
  coverDays: number;
  safetyStock: number;
};

export type AiForecastLine = ForecastLine & {
  aiForecastId: number;
  syncRunId: number;
  reused: boolean;
  usageMultiplier: number;
  fadeDays: number | null;
  confidence: number | null;
  reasoning: string | null;
};

export type ItemStockProjection = {
  itemId: number;
  itemName: string;
  unit: string;
  thresholdSource: "reorder_point" | "reorder_level";
  history: StockPoint[];
  algorithmic: AlgorithmicForecastLine | null;
  ai: AiForecastLine | null;
};

export function getStockProjection(itemId: number, syncRunId?: number): Promise<ItemStockProjection> {
  const query = syncRunId ? `?sync_run_id=${syncRunId}` : "";
  return apiGet<ItemStockProjection>(`/api/forecasts/${itemId}${query}`);
}

export type { SyncRun, SyncScope };
export type SyncRunFilter = { trigger?: "manual" | "auto" | "hourly" | "daily"; scope?: SyncScope };

export function getSyncRuns(filter: SyncRunFilter): Promise<SyncRun[]> {
  const params = new URLSearchParams({ pageSize: "100" });
  if (filter.trigger) params.set("trigger", filter.trigger);
  if (filter.scope) params.set("scope", filter.scope);
  return apiGet<SyncRun[]>(`/api/sync-runs?${params}`);
}

export function startSyncRun(scope: SyncScope): Promise<SyncRun> {
  return apiPost<SyncRun>("/api/sync-runs", { scope });
}

export type CouncilVerdict = {
  article_id: number;
  valid: boolean;
  severity: number;
  impact_type: string;
  regions: string[];
  affected_categories: string[];
  reasoning: string;
};

export type CouncilItemForecast = {
  item_id: number;
  usage_multiplier: number;
  fade_days: number | null;
  confidence: number;
  reasoning: string;
};

type CouncilTokens = { tokensIn: number; tokensOut: number };

export type CouncilMember = CouncilTokens & {
  seatId: number;
  persona: string;
  brief: string;
  label: string;
  error: string | null;
  verdicts: CouncilVerdict[] | null;
  forecasts: CouncilItemForecast[] | null;
};

export type CouncilReview = CouncilTokens & {
  label: string;
  persona: string;
  error: string | null;
  review: { critiques: { label: string; strengths: string; concerns: string }[]; ranking: string[] } | null;
};

export type CouncilChairman = CouncilTokens & {
  brief: string;
  error: string | null;
  verdicts: CouncilVerdict[] | null;
  forecasts: CouncilItemForecast[] | null;
};

export type CouncilCycle = {
  cycle: 1 | 2;
  members: CouncilMember[];
  reviews: CouncilReview[];
  chairman: CouncilChairman;
  peerIndex: { label: string; persona: string; index: number | null; agreement: number | null }[];
};

export type ArticleRef = { id: number; title: string; source: string };

export type RunCouncil = {
  run: SyncRun;
  shownRunId: number;
  reused: boolean;
  items: { id: number; name: string }[];
  articles: ArticleRef[];
  algorithmic: { forecastCount: number; stockAsOf: string | null; atOrBelowItemIds: number[] } | null;
  news: {
    sources: { name: string; tier: number; region: string | null; fetched: number }[];
    articles: (ArticleRef & { url: string; publishedAt: string | null })[];
  };
  screener:
    | (CouncilTokens & {
        articles: (ArticleRef & {
          selected: boolean;
          summary: string | null;
          rejectReason: string | null;
          impactType: string | null;
          regions: string[];
          categories: string[];
        })[];
      })
    | null;
  cycles: CouncilCycle[];
  aiForecast: {
    itemId: number;
    usageMultiplier: number | null;
    fadeDays: number | null;
    confidence: number | null;
    triggered: boolean;
    buyQty: number | null;
    thresholdDate: string | null;
    stockoutDate: string | null;
  }[];
};

export function getRunCouncil(syncRunId: number): Promise<RunCouncil> {
  return apiGet<RunCouncil>(`/api/sync-runs/${syncRunId}/council`);
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

// Whether each item is well stocked or running low, from its prediction.
export function getStockStatus(): Promise<ItemStockStatus[]> {
  return apiGet<ItemStockStatus[]>("/api/stock-status?pageSize=100");
}

// Weekly prediction accuracy for every item, most accurate first.
export function getForecastAccuracy(): Promise<ItemAccuracy[]> {
  return apiGet<ItemAccuracy[]>("/api/forecast-accuracy?pageSize=100");
}
