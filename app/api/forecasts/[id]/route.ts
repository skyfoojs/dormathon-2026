import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";
import { forecastItem } from "@/lib/forecast/demand";
import { projectStock } from "@/lib/forecast/runout";
import {
  findForecastItems,
  findForecastSuppliers,
  findSupplyOrders,
  findDailyStockRows,
} from "@/lib/queries/forecastInputs";

const idParamSchema = z.coerce.number().int().min(1);

type Ctx = { params: Promise<{ id: string }> };

// One item's demand forecast and its stock run-down projection.
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const itemId = idParamSchema.parse((await ctx.params).id);
    return ok(await buildItemProjection(itemId));
  } catch (err) {
    return errorResponse(err);
  }
}

async function buildItemProjection(itemId: number) {
  const [items, suppliers, dailyRows, purchaseOrders] = await Promise.all([
    findForecastItems(),
    findForecastSuppliers(),
    findDailyStockRows(itemId),
    findSupplyOrders(itemId),
  ]);
  const item = items.find((i) => i.item_id === itemId);
  if (!item) throw new NotFoundError(`Item ${itemId} not found`);

  const supplier = suppliers.find((s) => s.supplier_id === item.primary_supplier_id);
  const forecast = forecastItem({ item, dailyRows, purchaseOrders, supplier });
  const projection = forecast
    ? projectStock({ dailyRows, purchaseOrders, weeklyForecastQty: forecast.forecastQty })
    : null;
  if (!forecast || !projection) throw new NotFoundError(`Item ${itemId} has no stock history`);

  return {
    itemId,
    itemName: item.item_name,
    unit: item.unit,
    weeklyForecastQty: forecast.forecastQty,
    ...projection,
  };
}
