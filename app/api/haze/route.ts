import { errorResponse, ok } from "@/lib/response";
import { findHazeSummary } from "@/lib/haze";

export async function GET() {
  try {
    return ok(await findHazeSummary());
  } catch (err) {
    return errorResponse(err);
  }
}
