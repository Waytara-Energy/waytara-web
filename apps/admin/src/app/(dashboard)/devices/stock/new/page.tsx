import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { createStockItem } from "../../actions";
import { StockForm } from "../stock-form";

/** Add a stock item: the same form as an item's own page, empty. Saving opens the new item's page. */
export default function NewStockItemPage() {
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
          <p className="text-sm text-muted-foreground">Creates a new catalog and inventory row. Only the name and the category are required.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/devices">
            <ArrowLeft />
            Back to stock catalog
          </Link>
        </Button>
      </div>

      <div className="max-w-4xl">
        <StockForm action={createStockItem} loading="Adding…" success="Stock item added." submitLabel="Add stock item" cancelHref="/devices" />
      </div>
    </div>
  );
}
