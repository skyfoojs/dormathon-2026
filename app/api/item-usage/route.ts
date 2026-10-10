import { z } from "zod";
import { errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";
import { USAGE_WINDOW_DAYS } from "@/lib/forecast/usage";
import { readRecentItemUsage } from "@/lib/queries/itemUsage";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(USAGE_WINDOW_DAYS),
});

// Recent usage per item, one entry per item with its daily breakdown.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pagination = parsePagination(searchParams);
    const { days } = querySchema.parse({ days: searchParams.get("days") ?? undefined });
    const usage = await readRecentItemUsage(days);
    const [from, to] = toRange(pagination);
    return ok(usage.slice(from, to + 1), { ...pagination, total: usage.length, days });
  } catch (err) {
    return errorResponse(err);
  }
}
