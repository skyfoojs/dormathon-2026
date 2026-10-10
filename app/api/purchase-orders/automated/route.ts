import { z } from "zod";
import { created, errorResponse, ok } from "@/lib/response";
import { runAutomatedPurchaseOrders } from "@/lib/orders/automatedPurchaseOrders";

const bodySchema = z.object({
  // true returns the plan without writing any orders.
  dry_run: z.boolean().default(false),
});

// Raises the purchase orders AiGIS thinks are needed right now.
export async function POST(req: Request) {
  try {
    const { dry_run } = bodySchema.parse(await readJsonBody(req));
    const result = await runAutomatedPurchaseOrders({ dryRun: dry_run });
    return result.createdPoIds.length > 0 ? created(result) : ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}

// The body is optional: an empty POST means a real run.
async function readJsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}
