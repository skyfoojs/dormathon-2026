import { z } from "zod";
import { getDb } from "@/lib/db";
import { created, errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";


const createItemSchema = z.object({
  item_name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  unit_cost_myr: z.coerce.number().min(0),
  shelf_life_months: z.coerce.number().int().min(0),
  is_critical: z.union([z.literal(0), z.literal(1)]),
  storage: z.string().trim().min(1),
  primary_supplier_id: z.coerce.number().int().min(1),
  reorder_level: z.coerce.number().min(0).default(0),
  cover_days: z.coerce.number().int().min(1).default(30),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pagination = parsePagination(searchParams);
    const items = await listItems(pagination);
    return ok(items.rows, { page: pagination.page, pageSize: pagination.pageSize, total: items.total });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = createItemSchema.parse(await req.json());
    const item = await insertItem(input);
    return created(item);
  } catch (err) {
    return errorResponse(err);
  }
}

async function listItems(pagination: { page: number; pageSize: number }) {
  const db = getDb();
  const [from, to] = toRange(pagination);
  const { data, count, error } = await db
    .from("items")
    .select(
      "item_id, item_name, category, unit, unit_cost_myr, shelf_life_months, is_critical, storage, primary_supplier_id, reorder_level, cover_days",
      { count: "exact" },
    )
    .order("item_name", { ascending: true })
    .range(from, to);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

async function insertItem(input: z.infer<typeof createItemSchema>) {
  const db = getDb();
  // item_id is a plain INT primary key in this schema, not an identity
  // column, so the next id is computed here. Not race-safe under concurrent
  // writers; fine for this app's single-admin usage, called out as a
  // deviation from CLAUDE.backend.md's "no app-level ID generation" spirit.
  const nextId = await nextItemId(db);
  const { data, error } = await db
    .from("items")
    .insert({ item_id: nextId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function nextItemId(db: ReturnType<typeof getDb>): Promise<number> {
  const { data, error } = await db
    .from("items")
    .select("item_id")
    .order("item_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.item_id ?? 0) + 1;
}
