import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";

export const HOSPITAL_LOCATION = { country: "Malaysia", state: "Selangor", district: "Petaling" };

const categoryRowSchema = z.object({ category: z.string().nullable() });

export async function findItemCategories(): Promise<string[]> {
  const { data, error } = await getDb().from("items").select("category");
  if (error) throw error;
  const categories = z
    .array(categoryRowSchema)
    .parse(data)
    .map((row) => row.category)
    .filter((category): category is string => Boolean(category));
  return [...new Set(categories)].sort();
}
