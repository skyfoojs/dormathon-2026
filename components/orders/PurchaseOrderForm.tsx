"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { UnusualInputNotice } from "@/components/ui/Banner";
import { purchaseOrderFormSchema, type PurchaseOrderFormValues } from "@/lib/validation/inventory";
import { checkPurchaseOrderDates, checkPurchaseOrderQuantity } from "@/lib/data/unusualInput";
import { getMeanWeeklyIssue, type OrderRow } from "@/lib/data/inventory";
import type { Item, Supplier, WeeklyInventory } from "@/lib/db/types";

const MYR = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Lays out like a paper purchase order: the order header on top, then one
// row per line item, each with its own item, quantity and unit cost.
export function PurchaseOrderForm({
  order,
  facilityId,
  items,
  suppliers,
  weeklyInventory,
  onCancel,
  onSubmit,
}: {
  order: OrderRow;
  facilityId: number;
  items: Item[];
  suppliers: Supplier[];
  weeklyInventory: WeeklyInventory[];
  onCancel: () => void;
  onSubmit: (values: PurchaseOrderFormValues) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      supplier_id: order.po.supplier_id,
      order_date: order.po.order_date,
      expected_receipt_date: order.po.expected_receipt_date,
      status: order.po.status,
      actual_receipt_date: order.po.actual_receipt_date ?? "",
      lines: order.lines.map(({ po }) => ({
        po_id: po.po_id,
        item_id: po.item_id,
        qty_ordered: po.qty_ordered,
        unit_cost_myr: po.unit_cost_myr,
        qty_received: po.qty_received ?? undefined,
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const status = watch("status");
  const lines = watch("lines") ?? [];
  const isDelivered = status === "Delivered";
  const orderTotal = lines.reduce(
    (sum, line) => sum + (Number(line.qty_ordered) || 0) * (Number(line.unit_cost_myr) || 0),
    0,
  );

  const dateNotice = checkPurchaseOrderDates(watch("order_date") ?? "", watch("expected_receipt_date") ?? "");
  const quantityNotices = lines.flatMap((line, index) => {
    const meanWeeklyIssue = getMeanWeeklyIssue(facilityId, Number(line.item_id), weeklyInventory);
    const notice = checkPurchaseOrderQuantity(Number(line.qty_ordered) || 0, meanWeeklyIssue);
    return notice ? [`Line ${index + 1}: ${notice}`] : [];
  });
  const notices = [dateNotice, ...quantityNotices].filter((n): n is string => Boolean(n));

  function addLine() {
    const item = items[0];
    append({
      po_id: undefined,
      item_id: item?.item_id,
      qty_ordered: 1,
      unit_cost_myr: item?.unit_cost_myr ?? 0,
      qty_received: undefined,
    });
  }

  // Picking a different item brings in that item's usual unit cost.
  function handleItemChange(index: number, itemId: number) {
    const item = items.find((i) => i.item_id === itemId);
    if (item) setValue(`lines.${index}.unit_cost_myr`, item.unit_cost_myr);
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Supplier" htmlFor="supplier_id" error={errors.supplier_id?.message}>
          <Select id="supplier_id" {...register("supplier_id")}>
            {suppliers.map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>
                {s.supplier_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status" error={errors.status?.message}>
          <Select id="status" {...register("status")}>
            <option value="Draft">Draft</option>
            <option value="In transit">In transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </Select>
        </Field>
        <Field label="Order date" htmlFor="order_date" error={errors.order_date?.message}>
          <Input id="order_date" type="date" {...register("order_date")} />
        </Field>
        <Field
          label="Expected receipt date"
          htmlFor="expected_receipt_date"
          error={errors.expected_receipt_date?.message}
        >
          <Input id="expected_receipt_date" type="date" {...register("expected_receipt_date")} />
        </Field>
        {isDelivered ? (
          <Field
            label="Actual receipt date"
            htmlFor="actual_receipt_date"
            error={errors.actual_receipt_date?.message}
          >
            <Input id="actual_receipt_date" type="date" {...register("actual_receipt_date")} />
          </Field>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">
            Line items <span className="font-mono text-sm font-normal text-muted">{fields.length}</span>
          </h3>
          <Button onClick={addLine} disabled={items.length === 0}>
            <Plus size={16} aria-hidden="true" />
            Add line item
          </Button>
        </div>

        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const lineErrors = errors.lines?.[index];
            const line = lines[index];
            const lineTotal = (Number(line?.qty_ordered) || 0) * (Number(line?.unit_cost_myr) || 0);
            return (
              <li
                key={field.id}
                className="grid grid-cols-2 gap-3 rounded-md border border-line bg-page p-3 md:grid-cols-12 md:items-start"
              >
                <Field
                  label={`Item ${index + 1}`}
                  htmlFor={`line-${index}-item`}
                  error={lineErrors?.item_id?.message}
                  className={isDelivered ? "col-span-2 md:col-span-4" : "col-span-2 md:col-span-5"}
                >
                  <Select
                    id={`line-${index}-item`}
                    {...register(`lines.${index}.item_id`, {
                      onChange: (e) => handleItemChange(index, Number(e.target.value)),
                    })}
                  >
                    {items.map((i) => (
                      <option key={i.item_id} value={i.item_id}>
                        {i.item_name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Quantity"
                  htmlFor={`line-${index}-qty`}
                  error={lineErrors?.qty_ordered?.message}
                  className="md:col-span-2"
                >
                  <Input id={`line-${index}-qty`} type="number" min="1" {...register(`lines.${index}.qty_ordered`)} />
                </Field>
                {isDelivered ? (
                  <Field
                    label="Received"
                    htmlFor={`line-${index}-received`}
                    error={lineErrors?.qty_received?.message}
                    className="md:col-span-2"
                  >
                    <Input
                      id={`line-${index}-received`}
                      type="number"
                      min="0"
                      placeholder="All"
                      {...register(`lines.${index}.qty_received`)}
                    />
                  </Field>
                ) : null}
                <Field
                  label="Unit cost (MYR)"
                  htmlFor={`line-${index}-cost`}
                  error={lineErrors?.unit_cost_myr?.message}
                  className="md:col-span-2"
                >
                  <Input
                    id={`line-${index}-cost`}
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`lines.${index}.unit_cost_myr`)}
                  />
                </Field>
                <div className={isDelivered ? "flex flex-col gap-1.5 md:col-span-1" : "flex flex-col gap-1.5 md:col-span-2"}>
                  <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Total</span>
                  <span className="flex min-h-11 items-center font-mono text-sm">{MYR.format(lineTotal)}</span>
                </div>
                <div className="col-span-2 flex justify-end md:col-span-1 md:pt-6">
                  <IconButton
                    aria-label={`Remove line item ${index + 1}`}
                    title="Remove line item"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>

        {errors.lines?.message ? <p className="text-xs text-red-dark">{errors.lines.message}</p> : null}

        <div className="flex items-baseline justify-end gap-3 border-t border-line pt-3">
          <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">Order total</span>
          <span className="font-mono text-lg font-semibold">MYR {MYR.format(orderTotal)}</span>
        </div>
      </section>

      {notices.map((n) => (
        <UnusualInputNotice key={n} message={n} />
      ))}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary">
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
