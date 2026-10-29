import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Cpu, Download, ExternalLink, FileText } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize, poKindLabel } from "@/lib/po-document";
import { formatMoney, isOutOfStock, makeAndModel, STOCK_COLUMNS, statusLabel, type StockRow } from "../../stock-types";
import { updateStockItem } from "../../actions";
import { StockForm } from "../stock-form";

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  in_stock: "secondary",
  allocated: "outline",
  installed: "default",
  damaged: "destructive",
  returned: "outline",
};

function SummaryCard({ title, value, detail }: { title: string; value: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <Card className="gap-2 py-5">
      <CardHeader className="px-5">
        <CardDescription className="text-sm font-medium">{title}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1 px-5">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

/** One stock item on its own page: its figures, the form to edit it, and where it is in use. */
export default async function StockItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("equipment_inventory").select(STOCK_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const item = data as unknown as StockRow;

  // where this item is in use: the pieces of equipment that point at it, with the site and the customer
  const { data: inUse } = await supabase
    .from("equipment")
    .select("id, label, installed_at, site:sites(name, customer_id)")
    .eq("stock_id", id)
    .is("retired_at", null)
    .order("installed_at", { ascending: false, nullsFirst: false });
  const customerIds = [...new Set((inUse ?? []).map((e) => e.site?.customer_id).filter((c): c is string => !!c))];
  const { data: customers } = customerIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", customerIds) : { data: [] };
  const customerName = new Map((customers ?? []).map((c) => [c.id, c.full_name || c.email || "Customer"]));

  const { data: categoryRows } = await supabase.from("equipment_inventory").select("category");
  const categories = [...new Set((categoryRows ?? []).map((r) => r.category))].sort();

  const value = item.unit_price === null ? null : Math.max(0, item.quantity) * Number(item.unit_price);

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
                <BreadcrumbPage>{item.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            {isOutOfStock(item) ? (
              <Badge variant="destructive">Out of stock</Badge>
            ) : (
              <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"} className="capitalize">
                {statusLabel(item.status)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {item.category} · {makeAndModel(item)}
            {item.serial_number ? ` · serial ${item.serial_number}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/devices/stock/new?from=${item.id}`}>
              <Copy />
              Duplicate
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/devices">
              <ArrowLeft />
              Back to stock catalog
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Quantity" value={`${item.quantity}${item.primary_uom ? ` ${item.primary_uom}` : ""}`} detail={item.pack_size ? `Pack size ${item.pack_size}` : undefined} />
        <SummaryCard title="Unit price" value={formatMoney(item.unit_price)} />
        <SummaryCard title="Purchase price" value={formatMoney(item.purchase_price_amount)} detail={[item.supplier, item.purchase_date].filter(Boolean).join(" · ") || undefined} />
        <SummaryCard title="Stock value" value={value === null ? "—" : formatMoney(value)} detail={value === null ? "No unit price set" : "Quantity × unit price"} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <StockForm
          defaults={item}
          categories={categories}
          action={updateStockItem.bind(null, item.id)}
          loading={`Saving ${item.name}…`}
          success={`${item.name} saved.`}
          submitLabel="Save changes"
          cancelHref="/devices"
        />

        <div className="grid gap-6 xl:sticky xl:top-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase order</CardTitle>
              <CardDescription>{item.po_reference ? `Reference ${item.po_reference}` : "No PO reference noted."}</CardDescription>
            </CardHeader>
            <CardContent>
              {item.po_document_path ? (
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                    <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
                      <span className="truncate font-medium">{item.po_document_name}</span>
                      <span className="text-xs text-muted-foreground">{[poKindLabel(item.po_document_name), formatFileSize(item.po_document_size)].filter(Boolean).join(" · ")}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={`/devices/stock/${item.id}/po`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        View
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={`/devices/stock/${item.id}/po?download=1`}>
                        <Download />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No file uploaded. Add one under &ldquo;Purchase and supplier&rdquo;.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>In use</CardTitle>
              <CardDescription>
                {inUse && inUse.length > 0
                  ? `${inUse.length} ${inUse.length === 1 ? "piece" : "pieces"} of this item ${inUse.length === 1 ? "is" : "are"} set up at a site.`
                  : "None of this item is set up at a site yet."}
              </CardDescription>
            </CardHeader>
            {inUse && inUse.length > 0 ? (
              <CardContent className="grid gap-3">
                {inUse.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <Cpu className="size-4" />
                    </span>
                    <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
                      <span className="truncate font-medium">{e.label || item.name}</span>
                      <span className="truncate text-muted-foreground">
                        {e.site?.name ?? "No site"}
                        {e.site?.customer_id ? ` · ${customerName.get(e.site.customer_id) ?? "Customer"}` : ""}
                      </span>
                      {e.installed_at ? <span className="text-xs text-muted-foreground">Installed {new Date(e.installed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span> : null}
                    </div>
                    <Button asChild variant="ghost" size="icon-sm" title="Open this device's registers">
                      <Link href={`/devices/${e.id}/registers`}>
                        <ExternalLink />
                        <span className="sr-only">Open registers</span>
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            ) : null}
          </Card>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Registers are mapped per physical device now, not per model here: pick a variant during onboarding (Site &amp; Device Setup) to clone the matching template, then fine-tune addresses on that device&apos;s own &ldquo;Edit Registers&rdquo; page.
          </p>
        </div>
      </div>
    </div>
  );
}
