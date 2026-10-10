"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { UnusualInputNotice } from "@/components/ui/Banner";
import {
  purchaseOrderFormSchema,
  type PurchaseOrderFormValues,
} from "@/lib/validation/inventory";
import {
  checkPurchaseOrderDates,
  checkPurchaseOrderQuantity,
} from "@/lib/data/unusualInput";
import { getMeanWeeklyIssue } from "@/lib/data/inventory";
import type { Item, PurchaseOrder, Supplier, WeeklyInventory } from "@/lib/db/types";

export function PurchaseOrderForm({
  mode,
  po,
  facilityId,
  items,
  suppliers,
  weeklyInventory,
  onCancel,
  onSubmit,
}: {
  mode: "add" | "edit";
  po?: PurchaseOrder;
  facilityId: number;
  items: Item[];
  suppliers: Supplier[];
  weeklyInventory: WeeklyInventory[];
  onCancel: () => void;
  onSubmit: (values: PurchaseOrderFormValues) => void;
}) {
  const defaultItem = po ? items.find((i) => i.item_id === po.item_id) : items[0];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      item_id: po?.item_id ?? defaultItem?.item_id,
      supplier_id: po?.supplier_id ?? defaultItem?.primary_supplier_id,
      order_date: po?.order_date ?? "",
      qty_ordered: po?.qty_ordered ?? 0,
      unit_cost_myr: po?.unit_cost_myr ?? defaultItem?.unit_cost_myr ?? 0,
      expected_receipt_date: po?.expected_receipt_date ?? "",
      status: po?.status ?? "In transit",
      actual_receipt_date: po?.actual_receipt_date ?? "",
      qty_received: po?.qty_received ?? undefined,
    },
  });

  const itemId = watch("item_id");
  const qtyOrdered = watch("qty_ordered");
  const orderDate = watch("order_date");
  const expectedDate = watch("expected_receipt_date");
  const status = watch("status");

  const meanWeeklyIssue = itemId ? getMeanWeeklyIssue(facilityId, Number(itemId), weeklyInventory) : 0;
  const qtyNotice =
    qtyOrdered !== undefined ? checkPurchaseOrderQuantity(Number(qtyOrdered), meanWeeklyIssue) : null;
  const dateNotice = checkPurchaseOrderDates(orderDate ?? "", expectedDate ?? "");
  const notices = [qtyNotice, dateNotice].filter((n): n is string => Boolean(n));

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardHeader>
        <CardTitle>{mode === "add" ? "Add purchase order" : "Edit purchase order"}</CardTitle>
        <Tag tone="violet">Manual input</Tag>
      </CardHeader>
      <CardBody as="form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Item" htmlFor="item_id" error={errors.item_id?.message}>
            <Select id="item_id" {...register("item_id")}>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {i.item_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Supplier" htmlFor="supplier_id" error={errors.supplier_id?.message}>
            <Select id="supplier_id" {...register("supplier_id")}>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_name}
                </option>
              ))}
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
          <Field label="Quantity ordered" htmlFor="qty_ordered" error={errors.qty_ordered?.message}>
            <Input id="qty_ordered" type="number" min="1" {...register("qty_ordered")} />
          </Field>
          <Field label="Unit cost (MYR)" htmlFor="unit_cost_myr" error={errors.unit_cost_myr?.message}>
            <Input id="unit_cost_myr" type="number" step="0.01" min="0" {...register("unit_cost_myr")} />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status?.message}>
            <Select id="status" {...register("status")}>
              <option value="In transit">In transit</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </Select>
          </Field>
          {status === "Delivered" ? (
            <>
              <Field
                label="Actual receipt date"
                htmlFor="actual_receipt_date"
                error={errors.actual_receipt_date?.message}
              >
                <Input id="actual_receipt_date" type="date" {...register("actual_receipt_date")} />
              </Field>
              <Field label="Quantity received" htmlFor="qty_received" error={errors.qty_received?.message}>
                <Input id="qty_received" type="number" min="0" {...register("qty_received")} />
              </Field>
            </>
          ) : null}
        </div>

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
      </CardBody>
    </Card>
  );
}
