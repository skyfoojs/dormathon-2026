import { z } from "zod";
import { getDb } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";
import type { Report, ReportStatus } from "@/lib/db/types";

const idParamSchema = z.coerce.number().int().min(1);

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "retry"]),
  approved_by: z.string().trim().min(1).default("pharmacy manager"),
  note: z.string().trim().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    return ok(await findReportById(id));
  } catch (err) {
    return errorResponse(err);
  }
}

// The core rule of this page: a report is never sent until a person
// approves it, and that is enforced here, not only by hiding the button in
// the UI. Only these transitions are legal:
//   pending_approval -> sent | rejected
//   delivery_failed  -> sent (retry)
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = idParamSchema.parse((await ctx.params).id);
    const input = actionSchema.parse(await req.json());
    const report = await findReportById(id);

    const nextStatus = resolveTransition(report.status, input.action);
    const db = getDb();
    const { data, error } = await db
      .from("reports")
      .update({
        status: nextStatus,
        approved_by: input.action === "reject" ? report.approved_by : input.approved_by,
        approved_at: input.action === "reject" ? report.approved_at : new Date().toISOString(),
        note: input.note ?? report.note,
      })
      .eq("report_id", id)
      .select()
      .single();
    if (error) throw error;
    return ok(data);
  } catch (err) {
    return errorResponse(err);
  }
}

function resolveTransition(current: ReportStatus, action: "approve" | "reject" | "retry"): ReportStatus {
  if (current === "pending_approval" && action === "approve") return "sent";
  if (current === "pending_approval" && action === "reject") return "rejected";
  if (current === "delivery_failed" && action === "retry") return "sent";
  throw new ConflictError(`Cannot ${action} a report with status "${current}"`);
}

async function findReportById(id: number): Promise<Report> {
  const db = getDb();
  const { data, error } = await db.from("reports").select().eq("report_id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Report ${id} not found`);
  return data;
}
