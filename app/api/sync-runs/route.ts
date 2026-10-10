import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { created, errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange, type Pagination } from "@/lib/pagination";
import { SYNC_RUN_COLUMNS, executeSyncRun, startSyncRun, syncRunSchema, type SyncRun } from "@/lib/ai/sync";

export const maxDuration = 300;

const startSyncSchema = z.object({
  scope: z.enum(["news", "full"]).default("news"),
});

export async function GET(req: Request) {
  try {
    const pagination = parsePagination(new URL(req.url).searchParams);
    const runs = await listSyncRuns(pagination);
    return ok(runs.rows, { page: pagination.page, pageSize: pagination.pageSize, total: runs.total });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = startSyncSchema.parse(await readJsonBody(req));
    const run = await startSyncRun("manual", input.scope);
    after(() => executeSyncRun(run.sync_run_id));
    return created(run);
  } catch (err) {
    return errorResponse(err);
  }
}

async function readJsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

async function listSyncRuns(pagination: Pagination): Promise<{ rows: SyncRun[]; total: number }> {
  const [from, to] = toRange(pagination);
  const { data, count, error } = await getDb()
    .from("sync_runs")
    .select(SYNC_RUN_COLUMNS, { count: "exact" })
    .order("sync_run_id", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: z.array(syncRunSchema).parse(data), total: count ?? 0 };
}
