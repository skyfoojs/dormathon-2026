import { z } from "zod";
import { getDb } from "@/lib/db";
import { created, errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";


const createPurchaseOrderSchema = z.object({
  facility_id: z.coerce.number().int().min(1),
  item_id: z.coerce.number().int().min(1),
  supplier_id: z.coerce.number().int().min(1),
  order_date: z.string().min(1),
  qty_ordered: z.coerce.number().int().min(1),
  unit_cost_myr: z.coerce.number().min(0),
  expected_receipt_date: z.string().min(1),
  actual_receipt_date: z.string().nullable().optional(),
  qty_received: z.coerce.number().int().min(0).nullable().optional(),
  status: z.enum(["Draft", "In transit", "Delivered", "Cancelled"]),
});

const listQuerySchema = z.object({
  facility_id: z.coerce.number().int().min(1).optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pagination = parsePagination(searchParams);
    const { facility_id } = listQuerySchema.parse({ facility_id: searchParams.get("facility_id") ?? undefined });
    const result = await listPurchaseOrders(pagination, facility_id);
    return ok(result.rows, { page: pagination.page, pageSize: pagination.pageSize, total: result.total });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = createPurchaseOrderSchema.parse(await req.json());
    const po = await insertPurchaseOrder(input);
    return created(po);
  } catch (err) {
    return errorResponse(err);
  }
}

async function listPurchaseOrders(pagination: { page: number; pageSize: number }, facilityId?: number) {
  const db = getDb();
  const [from, to] = toRange(pagination);
  // po_id breaks ties so rows never repeat or go missing between pages.
  let query = db
    .from("purchase_orders")
    .select("*", { count: "exact" })
    .order("order_date", { ascending: false })
    .order("po_id", { ascending: false });
  if (facilityId) query = query.eq("facility_id", facilityId);
  const { data, count, error } = await query.range(from, to);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

async function insertPurchaseOrder(input: z.infer<typeof createPurchaseOrderSchema>) {
  const db = getDb();
  const nextId = await nextPoId(db);
  const { data, error } = await db
    .from("purchase_orders")
    .insert({ po_id: nextId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function nextPoId(db: ReturnType<typeof getDb>): Promise<number> {
  const { data, error } = await db
    .from("purchase_orders")
    .select("po_id")
    .order("po_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.po_id ?? 0) + 1;
}
