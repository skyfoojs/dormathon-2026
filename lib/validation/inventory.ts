import { z } from "zod";

export const itemFormSchema = z.object({
  item_name: z.string().trim().min(1, "Enter an item name"),
  category: z.string().trim().min(1, "Enter a category"),
  unit: z.string().trim().min(1, "Enter a unit"),
  unit_cost_myr: z.coerce.number().min(0, "Must be 0 or more"),
  shelf_life_months: z.coerce.number().int().min(0, "Must be 0 or more"),
  is_critical: z.boolean(),
  storage: z.string().trim().min(1, "Enter storage conditions"),
  primary_supplier_id: z.coerce.number().int().min(1, "Choose a supplier"),
  reorder_level: z.coerce.number().min(0, "Must be 0 or more"),
  cover_days: z.coerce.number().int("Use whole days").min(1, "At least 1 day"),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const supplierFormSchema = z.object({
  supplier_name: z.string().trim().min(1, "Enter a supplier name"),
  supplier_type: z.string().trim().min(1, "Enter a supplier type"),
  state: z.string().trim().min(1, "Enter a state"),
  lead_time_days: z.coerce.number().int().min(0, "Must be 0 or more"),
  reliability_score: z.coerce.number().min(0).max(5, "0 to 5"),
  contact_name: z.string().trim().optional(),
  contact_email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  contact_phone: z.string().trim().optional(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
