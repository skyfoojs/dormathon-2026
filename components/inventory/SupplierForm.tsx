"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { supplierFormSchema, type SupplierFormValues } from "@/lib/validation/inventory";
import type { Supplier } from "@/lib/db/types";

export function SupplierForm({
  mode,
  supplier,
  onCancel,
  onSubmit,
}: {
  mode: "add" | "edit";
  supplier?: Supplier;
  onCancel: () => void;
  onSubmit: (values: SupplierFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      supplier_name: supplier?.supplier_name ?? "",
      supplier_type: supplier?.supplier_type ?? "",
      state: supplier?.state ?? "",
      lead_time_days: supplier?.lead_time_days ?? 0,
      reliability_score: supplier?.reliability_score ?? 3,
      contact_name: supplier?.contact_name ?? "",
      contact_email: supplier?.contact_email ?? "",
      contact_phone: supplier?.contact_phone ?? "",
    },
  });

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardHeader>
        <CardTitle>{mode === "add" ? "Add supplier" : "Edit supplier"}</CardTitle>
        <Tag tone="violet">Manual input</Tag>
      </CardHeader>
      <CardBody as="form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier name" htmlFor="supplier_name" error={errors.supplier_name?.message}>
            <Input id="supplier_name" {...register("supplier_name")} />
          </Field>
          <Field label="Supplier type" htmlFor="supplier_type" error={errors.supplier_type?.message}>
            <Input id="supplier_type" {...register("supplier_type")} />
          </Field>
          <Field label="State" htmlFor="state" error={errors.state?.message}>
            <Input id="state" {...register("state")} />
          </Field>
          <Field label="Lead time (days)" htmlFor="lead_time_days" error={errors.lead_time_days?.message}>
            <Input id="lead_time_days" type="number" min="0" {...register("lead_time_days")} />
          </Field>
          <Field
            label="Reliability score (0 to 5)"
            htmlFor="reliability_score"
            error={errors.reliability_score?.message}
          >
            <Input
              id="reliability_score"
              type="number"
              step="0.1"
              min="0"
              max="5"
              {...register("reliability_score")}
            />
          </Field>
          <Field label="Contact name" htmlFor="contact_name" error={errors.contact_name?.message}>
            <Input id="contact_name" {...register("contact_name")} />
          </Field>
          <Field label="Contact email" htmlFor="contact_email" error={errors.contact_email?.message}>
            <Input id="contact_email" type="email" {...register("contact_email")} />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone" error={errors.contact_phone?.message}>
            <Input id="contact_phone" {...register("contact_phone")} />
          </Field>
        </div>

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
