import { errorResponse, ok } from "@/lib/response";
import { parsePagination, toRange } from "@/lib/pagination";
import { assessStock } from "@/lib/orders/restockPlan";
import { loadRestockInputs } from "@/lib/queries/restockInputs";

// Whether each item is well stocked or running low, judged from its
// prediction by the same rule that decides when AiGIS raises an order.
export async function GET(req: Request) {
  try {
    const pagination = parsePagination(new URL(req.url).searchParams);
    const statuses = assessStock(await loadRestockInputs());
    const [from, to] = toRange(pagination);
    return ok(statuses.slice(from, to + 1), { ...pagination, total: statuses.length });
  } catch (err) {
    return errorResponse(err);
  }
}
