import { AlertTriangle, CheckCircle2, IndianRupee, Package, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney, isOutOfStock, STATUS_OPTIONS, statusLabel, type StockRow } from "./stock-types";

/** A piece of equipment that is in use at a customer's site (a row of `equipment` that points at a stock item). */
export interface Allocation {
  stock_id: string;
  site_id: string | null;
}

const STATUS_BAR: Record<string, string> = {
  in_stock: "bg-emerald-500",
  allocated: "bg-sky-500",
  installed: "bg-violet-500",
  damaged: "bg-red-500",
  returned: "bg-amber-500",
};

function Stat({ icon: Icon, title, value, detail, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; value: React.ReactNode; detail: React.ReactNode; tone?: "warn" }) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
        <CardDescription className="text-sm font-medium">{title}</CardDescription>
        <span className={cn("grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground", tone === "warn" && "bg-amber-500/15 text-amber-600")}>
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="grid gap-1 px-5">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

/** The overview above the stock table: how much there is, how much is in use, what needs attention, what it is worth, and how it splits by category and status. */
export function StockOverview({ items, allocations }: { items: StockRow[]; allocations: Allocation[] }) {
  const categories = new Map<string, number>();
  for (const i of items) categories.set(i.category, (categories.get(i.category) ?? 0) + 1);
  const byCategory = [...categories.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maxCategory = Math.max(1, ...byCategory.map(([, n]) => n));

  const count = (status: string) => items.filter((i) => i.status === status).length;
  const inStockModels = items.filter((i) => i.status === "in_stock" && i.quantity > 0).length;
  const outOfStock = items.filter(isOutOfStock).length;
  const allocated = count("allocated");
  const installed = count("installed");
  const damaged = count("damaged");
  const returned = count("returned");
  const sites = new Set(allocations.map((a) => a.site_id).filter(Boolean)).size;

  const priced = items.filter((i) => i.unit_price !== null);
  const value = priced.reduce((sum, i) => sum + Math.max(0, i.quantity) * Number(i.unit_price), 0);
  const unpriced = items.length - priced.length;

  const statusCounts = STATUS_OPTIONS.map((s) => ({ status: s, n: count(s) }));
  const totalItems = Math.max(1, items.length);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Package} title="Models" value={items.length} detail={`${categories.size} ${categories.size === 1 ? "category" : "categories"}`} />
        <Stat icon={CheckCircle2} title="In stock" value={inStockModels} detail={outOfStock > 0 ? `${outOfStock} out of stock` : "Nothing is out of stock"} tone={outOfStock > 0 ? "warn" : undefined} />
        <Stat icon={Truck} title="Allocated / installed" value={allocated + installed} detail={`${allocated} allocated · ${installed} installed${sites ? ` · ${sites} ${sites === 1 ? "site" : "sites"}` : ""}`} />
        <Stat icon={AlertTriangle} title="Needs attention" value={damaged + returned + outOfStock} detail={`${damaged} damaged · ${returned} returned · ${outOfStock} out of stock`} tone={damaged + returned + outOfStock > 0 ? "warn" : undefined} />
        <Stat icon={IndianRupee} title="Stock value" value={formatMoney(value)} detail={unpriced > 0 ? `${unpriced} ${unpriced === 1 ? "model has" : "models have"} no unit price` : "Quantity × unit price"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">By category</CardTitle>
            <CardDescription>Models in each category.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5 px-5">
            {byCategory.length === 0 ? <p className="text-sm text-muted-foreground">No stock items yet.</p> : null}
            {byCategory.map(([name, n]) => (
              <div key={name} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3 text-sm">
                <span className="truncate text-muted-foreground">{name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / maxCategory) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">By status</CardTitle>
            <CardDescription>Where each model stands: on the shelf, allocated to a site, installed, or a problem.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {statusCounts
                .filter((s) => s.n > 0)
                .map((s) => (
                  <span key={s.status} className={cn("h-full", STATUS_BAR[s.status])} style={{ width: `${(s.n / totalItems) * 100}%` }} title={`${statusLabel(s.status)}: ${s.n}`} />
                ))}
            </div>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {statusCounts.map((s) => (
                <li key={s.status} className="flex items-center gap-2">
                  <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_BAR[s.status])} />
                  <span className="capitalize text-muted-foreground">{statusLabel(s.status)}</span>
                  <span className="ml-auto tabular-nums">{s.n}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
