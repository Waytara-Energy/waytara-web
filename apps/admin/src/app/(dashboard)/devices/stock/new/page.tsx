import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { createStockItem } from "../../actions";
import { loadStockCategories } from "../../stock-categories";
import { StockForm } from "../stock-form";

/**
 * Add a model to the catalog: what the product is (its name, category, how its stock is counted, specs, manual, data sheet, warranty). The stock itself
 * (serial numbers, quantities, who it came from) is added afterwards by receiving it, which is where a purchase order belongs.
 */
export default async function NewStockItemPage() {
  const supabase = await createClient();
  const categories = await loadStockCategories(supabase);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/devices">Stock</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Add a model</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-semibold tracking-tight">Add a model</h1>
          <p className="text-sm text-muted-foreground">
            A model is a product you stock, such as an inverter, an EV charger, an ESP32 hub or a panel. Add the model once, then receive units of it as they arrive.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/devices">
            <ArrowLeft />
            Back to stock
          </Link>
        </Button>
      </div>

      <div className="max-w-4xl">
        <StockForm categories={categories} action={createStockItem} loading="Adding…" success="Model added." submitLabel="Add model" cancelHref="/devices" />
      </div>
    </div>
  );
}
