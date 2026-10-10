import { z } from "zod";
import { getDb } from "@/lib/db";
import { ServiceUnavailableError } from "@/lib/errors";
import { created, errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange, type Pagination } from "@/lib/pagination";

const SELECT_COLUMNS = "policy_id, description, created_at";

const createPolicySchema = z.object({
  description: z.string().trim().min(1).max(5000),
});

export async function GET(req: Request) {
  try {
    const pagination = parsePagination(new URL(req.url).searchParams);
    const result = await listPolicies(pagination);
    return ok(result.rows, { ...pagination, total: result.total });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = createPolicySchema.parse(await req.json());
    return created(await insertPolicy(input));
  } catch (err) {
    return errorResponse(err);
  }
}

async function listPolicies(pagination: Pagination) {
  const [from, to] = toRange(pagination);
  const { data, count, error } = await getDb()
    .from("policies")
    .select(SELECT_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("policy_id", { ascending: false })
    .range(from, to);
  if (error) throw toPolicyError(error);
  return { rows: data ?? [], total: count ?? 0 };
}

// policy_id and created_at are filled in by the database.
async function insertPolicy(input: z.infer<typeof createPolicySchema>) {
  const { data, error } = await getDb().from("policies").insert(input).select(SELECT_COLUMNS).single();
  if (error) throw toPolicyError(error);
  return data;
}

// PGRST205 is PostgREST's "table not found". It means the policies table has
// not been created in this database yet, which is worth saying plainly.
function toPolicyError(error: { code?: string }): unknown {
  if (error.code === "PGRST205") {
    return new ServiceUnavailableError("The policies table has not been created in the database yet.");
  }
  return error;
}
