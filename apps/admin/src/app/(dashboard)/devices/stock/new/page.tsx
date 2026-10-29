import Link from "next/link";
import { ArrowLeft, CopyPlus, PackagePlus } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createStockItem, duplicateStockItem } from "../../actions";
import { loadStockCategories } from "../../stock-categories";
import { STOCK_COLUMNS, type StockRow } from "../../stock-types";
import { CopyForm } from "../copy-form";
import { CopyPicker } from "../copy-picker";
import { StockForm } from "../stock-form";

/**
 * Add a stock item, two ways: a fresh one (the item's own form: only the name and the category are required), or a copy of an existing one (everything
 * about the model is taken from it; the admin gives only the serial number, how many and the purchase). Choosing the item to copy reloads this page with
 * ?from=<id>; the "Duplicate" button on an item's page comes here the same way.
 */
export default async function NewStockItemPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("equipment_inventory").select(STOCK_COLUMNS).order("name");
  const items = (data ?? []) as unknown as StockRow[];
  const source = from ? (items.find((i) => i.id === from) ?? null) : null;
  const categories = await loadStockCategories(supabase);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/devices">Stock Catalog</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Add a stock item</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-semibold tracking-tight">Add a stock item</h1>
          <p className="text-sm text-muted-foreground">Start a new item, or copy one you already have and change only what is different.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/devices">
            <ArrowLeft />
            Back to stock catalog
          </Link>
        </Button>
      </div>

      <Tabs defaultValue={from ? "copy" : "fresh"} className="gap-6">
        <TabsList>
          <TabsTrigger value="fresh" className="gap-2 px-4">
            <PackagePlus className="size-4" />
            New item
          </TabsTrigger>
          <TabsTrigger value="copy" className="gap-2 px-4">
            <CopyPlus className="size-4" />
            Copy an existing item
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fresh" className="max-w-4xl">
          <StockForm categories={categories} action={createStockItem} loading="Adding…" success="Stock item added." submitLabel="Add stock item" cancelHref="/devices" />
        </TabsContent>

        <TabsContent value="copy" className="grid max-w-4xl gap-6">
          <CopyPicker items={items.map((i) => ({ id: i.id, name: i.name, category: i.category, serial_number: i.serial_number }))} selected={source?.id ?? null} />
          {from && !source ? <p className="text-sm text-destructive">That item was not found. Choose another one.</p> : null}
          {source ? <CopyForm key={source.id} source={source} action={duplicateStockItem.bind(null, source.id)} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
