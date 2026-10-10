import { z } from "zod";
import { getDb } from "@/lib/db";
import { created, errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";


// contact_name/contact_email/contact_phone are the proposed schema addition
// from Step 0 (the real `suppliers` table has no contact columns yet). This
// route assumes that migration has been applied.
const createSupplierSchema = z.object({
  supplier_name: z.string().trim().min(1),
  supplier_type: z.string().trim().min(1),
  state: z.string().trim().min(1),
  lead_time_days: z.coerce.number().int().min(0),
  reliability_score: z.coerce.number().min(0).max(5),
  contact_name: z.string().trim().optional(),
  contact_email: z.string().trim().email().optional().or(z.literal("")),
  contact_phone: z.string().trim().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pagination = parsePagination(searchParams);
    const suppliers = await listSuppliers(pagination);
    return ok(suppliers.rows, { page: pagination.page, pageSize: pagination.pageSize, total: suppliers.total });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = createSupplierSchema.parse(await req.json());
    const supplier = await insertSupplier(input);
    return created(supplier);
  } catch (err) {
    return errorResponse(err);
  }
}

async function listSuppliers(pagination: { page: number; pageSize: number }) {
  const db = getDb();
  const [from, to] = toRange(pagination);
  const { data, count, error } = await db
    .from("suppliers")
    .select("*", { count: "exact" })
    .order("supplier_name", { ascending: true })
    .range(from, to);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

async function insertSupplier(input: z.infer<typeof createSupplierSchema>) {
  const db = getDb();
  const nextId = await nextSupplierId(db);
  const { data, error } = await db
    .from("suppliers")
    .insert({ supplier_id: nextId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function nextSupplierId(db: ReturnType<typeof getDb>): Promise<number> {
  const { data, error } = await db
    .from("suppliers")
    .select("supplier_id")
    .order("supplier_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.supplier_id ?? 0) + 1;
}
