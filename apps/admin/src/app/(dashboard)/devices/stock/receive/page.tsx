import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { makeAndModel } from "../../stock-types";
import { ReceiveForm, type ReceivableModel } from "./receive-form";

/** Receive stock: a delivery arrives, and its units (serial numbers) or lot (a quantity) are added against a model, with the supplier and purchase order. */
export default async function ReceiveStockPage({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  const { model } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("equipment_inventory").select("id, name, category, tracking, primary_uom, brand, manufacturer, model").order("name");
  const models: ReceivableModel[] = (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    tracking: m.tracking,
    primary_uom: m.primary_uom,
    detail: makeAndModel(m),
  }));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

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
                <BreadcrumbPage>Receive stock</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl font-semibold tracking-tight">Receive stock</h1>
          <p className="text-sm text-muted-foreground">Record a delivery. Each serial number becomes a unit you can reserve for a customer and install; a lot is drawn down as it is installed.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/devices">
            <ArrowLeft />
            Back to stock
          </Link>
        </Button>
      </div>

      <div className="max-w-4xl">
        <ReceiveForm models={models} initialModel={models.some((m) => m.id === model) ? (model ?? null) : null} today={today} />
      </div>
    </div>
  );
}
