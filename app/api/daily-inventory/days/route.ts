import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorResponse, ok } from "@/lib/response";

const PAGE_SIZE = 1000;

const monthQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM") });

const dateRowSchema = z.object({ inventory_date: z.string() });

export async function GET(req: Request) {
  try {
    const { month } = monthQuerySchema.parse({ month: new URL(req.url).searchParams.get("month") ?? undefined });
    const [itemCount, dates] = await Promise.all([countItems(), findEntryDates(month)]);
    return ok(toDayCounts(dates), { month, itemCount });
  } catch (err) {
    return errorResponse(err);
  }
}

async function countItems(): Promise<number> {
  const { count, error } = await getDb().from("items").select("item_id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function findEntryDates(month: string): Promise<string[]> {
  const dates: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await getDb()
      .from("daily_inventory")
      .select("inventory_date")
      .gte("inventory_date", `${month}-01`)
      .lte("inventory_date", `${month}-31`)
      .order("inventory_date")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = z.array(dateRowSchema).parse(data);
    dates.push(...rows.map((row) => row.inventory_date));
    if (rows.length < PAGE_SIZE) break;
  }
  return dates;
}

function toDayCounts(dates: string[]): { date: string; entered: number }[] {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1);
  return [...counts].map(([date, entered]) => ({ date, entered }));
}
