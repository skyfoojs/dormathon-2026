import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";

const PAGE_SIZE = 1000;
const ROW_COLUMNS =
  "facility_id, item_id, inventory_date, opening_stock, received_qty, issued_qty, unmet_demand_qty, wastage_qty, closing_stock, stockout_flag";

const dateQuerySchema = z.object({ date: z.iso.date() });

const qty = z.number().int().min(0);
const saveDaySchema = z.object({
  item_id: z.number().int().min(1),
  inventory_date: z.iso.date(),
  received_qty: qty,
  issued_qty: qty,
  unmet_demand_qty: qty,
  wastage_qty: qty,
});

type SaveDayInput = z.infer<typeof saveDaySchema>;

const itemSchema = z.object({ item_id: z.number(), item_name: z.string(), unit: z.string().nullable() });
const stockRowSchema = z.object({
  facility_id: z.number().nullable(),
  item_id: z.number(),
  inventory_date: z.string(),
  opening_stock: z.number(),
  received_qty: z.number(),
  issued_qty: z.number(),
  unmet_demand_qty: z.number(),
  wastage_qty: z.number(),
  closing_stock: z.number(),
  stockout_flag: z.number(),
});
const closingRowSchema = z.object({ item_id: z.number(), closing_stock: z.number() });

type ItemRef = z.infer<typeof itemSchema>;
type StockRow = z.infer<typeof stockRowSchema>;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { date } = dateQuerySchema.parse({ date: searchParams.get("date") ?? undefined });
    const pagination = parsePagination(searchParams);
    const [items, rows] = await Promise.all([findItems(), findRowsOn(date)]);
    const openings = await findClosingsBefore(date, items.map((i) => i.item_id));
    const days = items.map((item) => toDayDto(item, date, rows.get(item.item_id), openings.get(item.item_id) ?? 0));
    const [from, to] = toRange(pagination);
    return ok(days.slice(from, to + 1), { ...pagination, total: days.length });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    const input = saveDaySchema.parse(await req.json());
    assertNotFuture(input.inventory_date);
    const item = await findItem(input.item_id);
    const [opening, existing, later] = await Promise.all([
      findClosingBefore(input.item_id, input.inventory_date),
      findRow(input.item_id, input.inventory_date),
      findRowsAfter(input.item_id, input.inventory_date),
    ]);
    const facilityId = existing?.facility_id ?? (await findFacilityId());
    const rows = recalculate({ ...input, facility_id: facilityId }, opening, later);
    assertNoNegativeStock(rows);
    await upsertRows(rows);
    return ok(toDayDto(item, input.inventory_date, rows[0], opening));
  } catch (err) {
    return errorResponse(err);
  }
}

function assertNotFuture(date: string): void {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (date > tomorrow) throw new ValidationError("Stock cannot be recorded for a future date");
}

async function findItems(): Promise<ItemRef[]> {
  const { data, error } = await getDb().from("items").select("item_id, item_name, unit").order("item_name");
  if (error) throw error;
  return z.array(itemSchema).parse(data);
}

async function findItem(itemId: number): Promise<ItemRef> {
  const { data, error } = await getDb()
    .from("items")
    .select("item_id, item_name, unit")
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Item ${itemId} not found`);
  return itemSchema.parse(data);
}

async function findRowsOn(date: string): Promise<Map<number, StockRow>> {
  const { data, error } = await getDb().from("daily_inventory").select(ROW_COLUMNS).eq("inventory_date", date);
  if (error) throw error;
  return new Map(z.array(stockRowSchema).parse(data).map((row) => [row.item_id, row]));
}

async function findRow(itemId: number, date: string): Promise<StockRow | null> {
  const { data, error } = await getDb()
    .from("daily_inventory")
    .select(ROW_COLUMNS)
    .eq("item_id", itemId)
    .eq("inventory_date", date)
    .maybeSingle();
  if (error) throw error;
  return data ? stockRowSchema.parse(data) : null;
}

async function findClosingsBefore(date: string, itemIds: number[]): Promise<Map<number, number>> {
  const closings = new Map<number, number>();
  for (let offset = 0; closings.size < itemIds.length; offset += PAGE_SIZE) {
    const { data, error } = await getDb()
      .from("daily_inventory")
      .select("item_id, closing_stock")
      .lt("inventory_date", date)
      .order("inventory_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = z.array(closingRowSchema).parse(data);
    for (const row of rows) {
      if (!closings.has(row.item_id)) closings.set(row.item_id, row.closing_stock);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return closings;
}

async function findClosingBefore(itemId: number, date: string): Promise<number> {
  const { data, error } = await getDb()
    .from("daily_inventory")
    .select("item_id, closing_stock")
    .eq("item_id", itemId)
    .lt("inventory_date", date)
    .order("inventory_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? closingRowSchema.parse(data).closing_stock : 0;
}

async function findRowsAfter(itemId: number, date: string): Promise<StockRow[]> {
  const { data, error } = await getDb()
    .from("daily_inventory")
    .select(ROW_COLUMNS)
    .eq("item_id", itemId)
    .gt("inventory_date", date)
    .order("inventory_date");
  if (error) throw error;
  return z.array(stockRowSchema).parse(data);
}

async function findFacilityId(): Promise<number | null> {
  const { data, error } = await getDb().from("daily_inventory").select("facility_id").limit(1).maybeSingle();
  if (error) throw error;
  return data?.facility_id ?? null;
}

function recalculate(
  input: SaveDayInput & { facility_id: number | null },
  opening: number,
  later: StockRow[],
): StockRow[] {
  const rows = [withStock(input, opening)];
  for (const row of later) {
    rows.push(withStock(row, rows[rows.length - 1].closing_stock));
  }
  return rows;
}

function assertNoNegativeStock(rows: StockRow[]): void {
  const index = rows.findIndex((row) => row.closing_stock < 0);
  if (index === -1) return;
  throw new ValidationError(
    index === 0
      ? "Issued and wastage are more than the stock available that day"
      : `This change would make stock negative on ${rows[index].inventory_date}`,
  );
}

function withStock(
  row: Omit<StockRow, "opening_stock" | "closing_stock" | "stockout_flag">,
  opening: number,
): StockRow {
  return {
    facility_id: row.facility_id,
    item_id: row.item_id,
    inventory_date: row.inventory_date,
    received_qty: row.received_qty,
    issued_qty: row.issued_qty,
    unmet_demand_qty: row.unmet_demand_qty,
    wastage_qty: row.wastage_qty,
    opening_stock: opening,
    closing_stock: opening + row.received_qty - row.issued_qty - row.wastage_qty,
    stockout_flag: row.unmet_demand_qty > 0 ? 1 : 0,
  };
}

async function upsertRows(rows: StockRow[]): Promise<void> {
  const { error } = await getDb()
    .from("daily_inventory")
    .upsert(rows, { onConflict: "facility_id,item_id,inventory_date" });
  if (error) throw error;
}

function toDayDto(item: ItemRef, date: string, row: StockRow | undefined, opening: number) {
  return {
    item_id: item.item_id,
    item_name: item.item_name,
    unit: item.unit,
    inventory_date: date,
    entered: row !== undefined,
    opening_stock: row?.opening_stock ?? opening,
    received_qty: row?.received_qty ?? null,
    issued_qty: row?.issued_qty ?? null,
    unmet_demand_qty: row?.unmet_demand_qty ?? null,
    wastage_qty: row?.wastage_qty ?? null,
    closing_stock: row?.closing_stock ?? null,
    stockout: row ? row.stockout_flag === 1 : null,
  };
}
