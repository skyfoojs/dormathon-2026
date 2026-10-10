"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { UnusualInputNotice } from "@/components/ui/Banner";
import { itemFormSchema, type ItemFormValues } from "@/lib/validation/inventory";
import { checkReorderLevel } from "@/lib/data/unusualInput";
import type { Item, Supplier } from "@/lib/db/types";

export function ItemForm({
  mode,
  item,
  suppliers,
  onCancel,
  onSubmit,
}: {
  mode: "add" | "edit";
  item?: Item;
  suppliers: Supplier[];
  onCancel: () => void;
  onSubmit: (values: ItemFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      item_name: item?.item_name ?? "",
      category: item?.category ?? "",
      unit: item?.unit ?? "",
      unit_cost_myr: item?.unit_cost_myr ?? 0,
      shelf_life_months: item?.shelf_life_months ?? 0,
      is_critical: item ? item.is_critical === 1 : false,
      storage: item?.storage ?? "",
      primary_supplier_id: item?.primary_supplier_id ?? suppliers[0]?.supplier_id,
      reorder_level: item ? (item.reorder_level ?? undefined) : 0,
    },
  });

  const reorderLevelRaw = watch("reorder_level");
  const reorderLevel =
    reorderLevelRaw === undefined || reorderLevelRaw === null || reorderLevelRaw === ("" as unknown)
      ? null
      : Number(reorderLevelRaw);
  const unusualNotice =
    reorderLevel !== null && !Number.isNaN(reorderLevel)
      ? checkReorderLevel(item?.reorder_level ?? null, reorderLevel)
      : null;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardHeader>
        <CardTitle>{mode === "add" ? "Add item" : "Edit item"}</CardTitle>
        <Tag tone="violet">Manual input</Tag>
      </CardHeader>
      <CardBody as="form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Item name" htmlFor="item_name" error={errors.item_name?.message}>
            <Input id="item_name" {...register("item_name")} />
          </Field>
          <Field label="Category" htmlFor="category" error={errors.category?.message}>
            <Input id="category" {...register("category")} />
          </Field>
          <Field label="Unit" htmlFor="unit" error={errors.unit?.message}>
            <Input id="unit" {...register("unit")} />
          </Field>
          <Field label="Unit cost (MYR)" htmlFor="unit_cost_myr" error={errors.unit_cost_myr?.message}>
            <Input id="unit_cost_myr" type="number" step="0.01" min="0" {...register("unit_cost_myr")} />
          </Field>
          <Field
            label="Shelf life (months)"
            htmlFor="shelf_life_months"
            error={errors.shelf_life_months?.message}
          >
            <Input id="shelf_life_months" type="number" min="0" {...register("shelf_life_months")} />
          </Field>
          <Field label="Storage" htmlFor="storage" error={errors.storage?.message}>
            <Input id="storage" {...register("storage")} />
          </Field>
          <Field
            label="Primary supplier"
            htmlFor="primary_supplier_id"
            error={errors.primary_supplier_id?.message}
          >
            <Select id="primary_supplier_id" {...register("primary_supplier_id")}>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Reorder level (threshold)"
            htmlFor="reorder_level"
            hint="Units. Restock when stock left falls to this. Blank saves as 0."
            error={errors.reorder_level?.message}
          >
            <Input id="reorder_level" type="number" min="0" placeholder="0" {...register("reorder_level")} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-5 w-5 accent-navy"
            {...register("is_critical")}
          />
          Critical item
        </label>

        {unusualNotice ? <UnusualInputNotice message={unusualNotice} /> : null}

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
