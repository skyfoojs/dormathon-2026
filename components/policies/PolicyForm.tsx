"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Input";
import type { Policy } from "@/lib/db/types";

const policyFormSchema = z.object({
  description: z.string().trim().min(1, "Enter the policy").max(5000, "Keep it under 5,000 characters"),
});

type PolicyFormValues = z.infer<typeof policyFormSchema>;

export function PolicyForm({
  policy,
  saving,
  onCancel,
  onSubmit,
}: {
  policy?: Policy;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (description: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: { description: policy?.description ?? "" },
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => onSubmit(values.description))}>
      <Field
        label="Description"
        htmlFor="policy-description"
        hint="Write the rule in plain language, one policy per entry."
        error={errors.description?.message}
      >
        <Textarea id="policy-description" rows={6} autoFocus {...register("description")} />
      </Field>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
