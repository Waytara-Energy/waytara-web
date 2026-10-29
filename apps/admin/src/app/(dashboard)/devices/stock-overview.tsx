import { AlertTriangle, CheckCircle2, IndianRupee, Package, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_DOT } from "./stock-status-badge";
import { categoryLabel, formatMoney, statusLabel, stockLevel, UNIT_STATUSES, type StockRow, type StockSummary } from "./stock-types";

/** A model with what its units add up to. */
export interface ModelStock {
  model: StockRow;
  sum: StockSummary;
}

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

/** The overview above the stock table: what is on the shelf, what is held or installed, what needs reordering, and what the stock is worth. */
export function StockOverview({ rows, statusCounts }: { rows: ModelStock[]; statusCounts: Record<string, number> }) {
  const available = rows.reduce((n, r) => n + r.sum.available, 0);
  const reserved = rows.reduce((n, r) => n + r.sum.reserved, 0);
  const installed = rows.reduce((n, r) => n + r.sum.installed, 0);
  const attention = rows.reduce((n, r) => n + r.sum.attention, 0);
  const levels = rows.map((r) => stockLevel(r.model, r.sum.available));
  const out = levels.filter((l) => l === "out").length;
  const low = levels.filter((l) => l === "low").length;

  const priced = rows.filter((r) => r.model.unit_price !== null);
  const value = priced.reduce((sum, r) => sum + r.sum.available * Number(r.model.unit_price), 0);
  const unpriced = rows.filter((r) => r.model.unit_price === null && r.sum.available > 0).length;

  const categories = new Map<string, number>();
  for (const r of rows) categories.set(r.model.category, (categories.get(r.model.category) ?? 0) + r.sum.available);
  const byCategory = [...categories.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maxCategory = Math.max(1, ...byCategory.map(([, n]) => n));

  const statuses = UNIT_STATUSES.map((s) => ({ status: s, n: statusCounts[s] ?? 0 }));
  const totalUnits = Math.max(1, statuses.reduce((n, s) => n + s.n, 0));

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Package} title="Models" value={rows.length} detail={`${categories.size} ${categories.size === 1 ? "category" : "categories"}`} />
        <Stat icon={CheckCircle2} title="Available" value={available} detail="In stock, ready to give out" />
        <Stat icon={Truck} title="Reserved / installed" value={`${reserved} / ${installed}`} detail="Held for customers / at their sites" />
        <Stat icon={AlertTriangle} title="Needs reorder" value={out + low} detail={`${out} out of stock · ${low} low${attention > 0 ? ` · ${attention} need attention` : ""}`} tone={out + low > 0 ? "warn" : undefined} />
        <Stat icon={IndianRupee} title="Stock value" value={formatMoney(value)} detail={unpriced > 0 ? `${unpriced} ${unpriced === 1 ? "model has" : "models have"} no unit price` : "Available × unit price"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Available by category</CardTitle>
            <CardDescription>How much is ready to give out in each category.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5 px-5">
            {byCategory.length === 0 ? <p className="text-sm text-muted-foreground">No models yet.</p> : null}
            {byCategory.map(([name, n]) => (
              <div key={name} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate text-muted-foreground">{categoryLabel(name)}</span>
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
            <CardTitle className="text-base">Units by status</CardTitle>
            <CardDescription>Every serial-numbered unit and lot, by where it is in its life.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {statuses
                .filter((s) => s.n > 0)
                .map((s) => (
                  <span key={s.status} className={cn("h-full", STATUS_DOT[s.status])} style={{ width: `${(s.n / totalUnits) * 100}%` }} title={`${statusLabel(s.status)}: ${s.n}`} />
                ))}
            </div>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {statuses.map((s) => (
                <li key={s.status} className="flex items-center gap-2">
                  <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_DOT[s.status])} />
                  <span className="text-muted-foreground">{statusLabel(s.status)}</span>
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
