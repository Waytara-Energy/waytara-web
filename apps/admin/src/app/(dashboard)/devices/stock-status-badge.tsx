import { Badge } from "@/components/ui/badge";
import { cn } from "@waytara/ui/cn";
import { isOutOfStock, statusLabel, type StockRow } from "./stock-types";

/** One colour per status, so a row can be told apart at a glance: green in stock, blue allocated, violet installed, red damaged or out, amber returned. */
const TONES: Record<string, { badge: string; dot: string }> = {
  in_stock: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30", dot: "bg-emerald-500" },
  allocated: { badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30", dot: "bg-blue-500" },
  installed: { badge: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30", dot: "bg-violet-500" },
  damaged: { badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30", dot: "bg-red-500" },
  returned: { badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30", dot: "bg-amber-500" },
  out_of_stock: { badge: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/40", dot: "bg-rose-600" },
};

const FALLBACK = { badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };

/** The status of a stock item as a coloured badge; an item marked in stock with none left reads "Out of stock". */
export function StockStatusBadge({ item, className }: { item: Pick<StockRow, "status" | "quantity">; className?: string }) {
  const out = isOutOfStock(item as StockRow);
  const tone = TONES[out ? "out_of_stock" : item.status] ?? FALLBACK;
  return (
    <Badge variant="outline" className={cn("gap-1.5 capitalize", tone.badge, className)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {out ? "Out of stock" : statusLabel(item.status)}
    </Badge>
  );
}
