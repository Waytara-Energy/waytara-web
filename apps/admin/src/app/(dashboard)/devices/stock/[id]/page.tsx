import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cpu, Download, ExternalLink, FileText, PackagePlus } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOC_SLOTS, documentHref, documentKindLabel, documentOf, formatFileSize } from "@/lib/stock-documents";
import { updateStockItem } from "../../actions";
import { loadStockCategories } from "../../stock-categories";
import {
  categoryLabel,
  formatDate,
  formatMoney,
  makeAndModel,
  STOCK_COLUMNS,
  stockLevel,
  summarizeUnits,
  TRACKING_LABEL,
  UNIT_COLUMNS,
  type StockRow,
  type UnitRow,
} from "../../stock-types";
import { StockForm } from "../stock-form";
import { UnitsTable, type CustomerChoice, type UnitView } from "../units-table";

function SummaryCard({ title, value, detail, tone }: { title: string; value: React.ReactNode; detail?: React.ReactNode; tone?: "warn" | "bad" }) {
  return (
    <Card className="gap-2 py-5">
      <CardHeader className="px-5">
        <CardDescription className="text-sm font-medium">{title}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1 px-5">
        <div className={`text-2xl font-semibold tabular-nums tracking-tight ${tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

const KIND_TEXT: Record<string, string> = {
  received: "Received",
  reserved: "Reserved",
  released: "Released",
  installed: "Installed",
  status: "Status changed",
  removed: "Removed",
};

/** One model on its own page: its stock unit by unit (the main thing), the model's details, and the history of everything that happened to its stock. */
export default async function StockItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("equipment_inventory").select(STOCK_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const item = data as unknown as StockRow;

  const [{ data: unitRows }, { data: receipts }, { data: customerRows }, { data: siteRows }, { data: movementRows }, { data: inUse }, categories] = await Promise.all([
    supabase.from("stock_units").select(UNIT_COLUMNS).eq("model_id", id).order("created_at", { ascending: false }),
    supabase.from("stock_receipts").select("id, received_on, supplier, po_reference, po_document_path").eq("model_id", id),
    supabase.from("profiles").select("id, full_name, email").eq("role", "customer").order("full_name"),
    supabase.from("sites").select("id, name, customer_id"),
    supabase
      .from("stock_movements")
      .select("id, kind, quantity, from_status, to_status, note, created_at, customer_id, actor, unit:stock_units(serial_number)")
      .eq("model_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    // where this model is in use: the pieces of equipment that point at it, with the site and the customer
    supabase.from("equipment").select("id, label, serial_number, installed_at, site:sites(name, customer_id)").eq("stock_id", id).is("retired_at", null).order("installed_at", { ascending: false, nullsFirst: false }),
    loadStockCategories(supabase),
  ]);

  const units = (unitRows ?? []) as unknown as UnitRow[];
  const customerName = new Map((customerRows ?? []).map((c) => [c.id, c.full_name || c.email || "Customer"]));
  const siteName = new Map((siteRows ?? []).map((s) => [s.id, s.name]));
  const receiptById = new Map((receipts ?? []).map((r) => [r.id, r]));
  const customers: CustomerChoice[] = (customerRows ?? []).map((c) => ({
    id: c.id,
    name: c.full_name ? `${c.full_name}${c.email ? ` (${c.email})` : ""}` : (c.email ?? "Customer"),
    sites: (siteRows ?? []).filter((s) => s.customer_id === c.id).map((s) => ({ id: s.id, name: s.name })),
  }));

  const unitViews: UnitView[] = units.map((u) => {
    const r = u.receipt_id ? receiptById.get(u.receipt_id) : undefined;
    return {
      ...u,
      customerName: u.customer_id ? (customerName.get(u.customer_id) ?? "Customer") : null,
      siteName: u.site_id ? (siteName.get(u.site_id) ?? null) : null,
      receivedOn: r?.received_on ?? u.created_at,
      poReference: r?.po_reference ?? null,
      supplier: r?.supplier ?? null,
      poFileHref: r?.po_document_path ? `${documentHref(id, "po")}?receipt=${r.id}` : null,
    };
  });

  const actorIds = [...new Set((movementRows ?? []).map((m) => m.actor).filter((a): a is string => !!a))];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds) : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name || a.email || "Staff"]));

  const sum = summarizeUnits(units);
  const level = stockLevel(item, sum.available);
  const value = item.unit_price === null ? null : sum.available * Number(item.unit_price);
  const lot = item.tracking === "lot";

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
                <BreadcrumbPage>{item.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            <Badge variant="outline">{TRACKING_LABEL[item.tracking] ?? item.tracking}</Badge>
            {level === "out" ? <Badge variant="destructive">Out of stock</Badge> : null}
            {level === "low" ? <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">Low stock</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {categoryLabel(item.category)} · {makeAndModel(item)}
            {item.model_number ? ` · ${item.model_number}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/devices/stock/receive?model=${item.id}`}>
              <PackagePlus />
              Receive stock
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/devices">
              <ArrowLeft />
              Back to stock
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Available"
          value={`${sum.available}${item.primary_uom && lot ? ` ${item.primary_uom}` : ""}`}
          detail={item.reorder_level > 0 ? `Reorder at ${item.reorder_level} or fewer` : "In stock, ready to give out"}
          tone={level === "out" ? "bad" : level === "low" ? "warn" : undefined}
        />
        <SummaryCard title="Reserved" value={sum.reserved} detail="Held for a customer" />
        <SummaryCard title="Installed" value={sum.installed} detail="At customers' sites" />
        <SummaryCard title="Needs attention" value={sum.attention} detail="Repair, damaged or returned" tone={sum.attention > 0 ? "warn" : undefined} />
        <SummaryCard title="Stock value" value={value === null ? "—" : formatMoney(value)} detail={value === null ? "No unit price set" : "Available × unit price"} />
      </div>

      <Tabs defaultValue="stock" className="gap-6">
        <TabsList>
          <TabsTrigger value="stock" className="px-4">
            Stock <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{units.length}</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="px-4">
            Model details
          </TabsTrigger>
          <TabsTrigger value="history" className="px-4">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card>
            <CardHeader>
              <CardTitle>{lot ? "Lots" : "Units"}</CardTitle>
              <CardDescription>
                {lot
                  ? "Each lot is a delivery of this model with a quantity. Installations draw from the oldest lot first."
                  : "Every unit has its own serial number and its own life: in stock, reserved for a customer, installed, or out for repair."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UnitsTable units={unitViews} customers={customers} tracking={item.tracking} uom={item.primary_uom} />
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>The manual and data sheet for this model. Purchase orders are on each delivery.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {(["manual", "datasheet"] as const).map((slot) => {
                  const doc = documentOf(item, slot);
                  return (
                    <div key={slot} className="grid gap-2 rounded-lg border p-3">
                      <div className="flex items-start gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                          <FileText className="size-4" />
                        </span>
                        <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
                          <span className="font-medium">{DOC_SLOTS[slot].label}</span>
                          {doc ? (
                            <>
                              <span className="truncate text-muted-foreground">{doc.name}</span>
                              <span className="text-xs text-muted-foreground">{[documentKindLabel(doc.name), formatFileSize(doc.size)].filter(Boolean).join(" · ")}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Not uploaded. Add it under Model details.</span>
                          )}
                        </div>
                      </div>
                      {doc ? (
                        <div className="flex gap-2">
                          <Button asChild variant="outline" size="sm">
                            <a href={documentHref(item.id, slot)} target="_blank" rel="noopener noreferrer">
                              <ExternalLink />
                              View
                            </a>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <a href={documentHref(item.id, slot, true)}>
                              <Download />
                              Download
                            </a>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>In use</CardTitle>
                <CardDescription>
                  {inUse && inUse.length > 0
                    ? `${inUse.length} ${inUse.length === 1 ? "piece" : "pieces"} of this model ${inUse.length === 1 ? "is" : "are"} set up at a site.`
                    : "None of this model is set up at a site yet."}
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
                        <span className="truncate font-medium">{e.label || e.serial_number || item.name}</span>
                        <span className="truncate text-muted-foreground">
                          {e.site?.name ?? "No site"}
                          {e.site?.customer_id ? ` · ${customerName.get(e.site.customer_id) ?? "Customer"}` : ""}
                        </span>
                        {e.serial_number ? <span className="font-mono text-xs text-muted-foreground">{e.serial_number}</span> : null}
                        {e.installed_at ? <span className="text-xs text-muted-foreground">Installed {formatDate(e.installed_at)}</span> : null}
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
          </div>
        </TabsContent>

        <TabsContent value="details" className="max-w-4xl">
          <StockForm
            defaults={item}
            categories={categories}
            action={updateStockItem.bind(null, item.id)}
            loading={`Saving ${item.name}…`}
            success={`${item.name} saved.`}
            submitLabel="Save changes"
            cancelHref="/devices"
            hasStock={units.length > 0}
          />
        </TabsContent>

        <TabsContent value="history" className="max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Everything that happened to this model&apos;s stock, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {(movementRows ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ol className="grid gap-0 divide-y">
                  {(movementRows ?? []).map((m) => (
                    <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3 text-sm">
                      <span className="w-28 shrink-0 text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{KIND_TEXT[m.kind] ?? m.kind}</span>{" "}
                        <span className="font-mono text-xs">{m.unit?.serial_number ?? ""}</span>
                        {m.quantity > 1 ? <span className="text-muted-foreground"> × {m.quantity}</span> : null}
                        {m.from_status && m.to_status && m.from_status !== m.to_status ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {m.from_status.replace("_", " ")} → {m.to_status.replace("_", " ")}
                          </span>
                        ) : null}
                        {m.customer_id ? <span className="text-muted-foreground"> · {customerName.get(m.customer_id) ?? "Customer"}</span> : null}
                        {m.note ? <span className="block text-xs text-muted-foreground">{m.note}</span> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">{m.actor ? (actorName.get(m.actor) ?? "Staff") : "System"}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
