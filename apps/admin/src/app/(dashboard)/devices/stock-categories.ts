import type { createClient } from "@waytara/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CategoryChoice {
  name: string;
  /** how many stock items are in it: a category with items cannot be removed */
  items: number;
}

/** The categories to offer: the saved list together with any category a stock item already carries, each with how many items are in it. */
export async function loadStockCategories(supabase: Supabase): Promise<CategoryChoice[]> {
  const [{ data: saved }, { data: used }] = await Promise.all([
    supabase.from("stock_categories").select("name"),
    supabase.from("equipment_inventory").select("category"),
  ]);
  const counts = new Map<string, number>();
  for (const r of used ?? []) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  for (const r of saved ?? []) if (!counts.has(r.name)) counts.set(r.name, 0);
  return [...counts].map(([name, items]) => ({ name, items }));
}
