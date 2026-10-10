import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";
import { SYNC_RUN_COLUMNS, findSyncRunCost, syncRunSchema, type SyncRun } from "@/lib/ai/sync";

const idParamSchema = z.coerce.number().int().min(1);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const [run, costUsd] = await Promise.all([findSyncRunById(id), findSyncRunCost(id)]);
    return ok({ ...run, cost_usd: costUsd });
  } catch (err) {
    return errorResponse(err);
  }
}

async function findSyncRunById(id: number): Promise<SyncRun> {
  const { data, error } = await getDb().from("sync_runs").select(SYNC_RUN_COLUMNS).eq("sync_run_id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError("Sync run not found");
  return syncRunSchema.parse(data);
}
