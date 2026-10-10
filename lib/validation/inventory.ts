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
  reorder_level: z.coerce.number().min(0, "Must be 0 or more").optional(),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

// An empty number input arrives as "", which must mean "not entered", not 0.
const optionalQuantity = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().min(0, "Must be 0 or more").optional(),
);

export const purchaseOrderLineSchema = z.object({
  // Set for lines that already exist; absent for lines added in the form.
  po_id: z.number().int().optional(),
  item_id: z.coerce.number().int().min(1, "Choose an item"),
  qty_ordered: z.coerce.number().int().min(1, "Must be at least 1"),
  unit_cost_myr: z.coerce.number().min(0, "Must be 0 or more"),
  qty_received: optionalQuantity,
});

export const purchaseOrderFormSchema = z
  .object({
    supplier_id: z.coerce.number().int().min(1, "Choose a supplier"),
    order_date: z.string().min(1, "Enter an order date"),
    expected_receipt_date: z.string().min(1, "Enter an expected receipt date"),
    status: z.enum(["Draft", "In transit", "Delivered", "Cancelled"]),
    actual_receipt_date: z.string().optional(),
    lines: z.array(purchaseOrderLineSchema).min(1, "Add at least one line item"),
  })
  .refine((v) => v.status !== "Delivered" || !!v.actual_receipt_date, {
    message: "Enter the actual receipt date",
    path: ["actual_receipt_date"],
  });

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;

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
