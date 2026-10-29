import { Badge } from "@/components/ui/badge";
import { cn } from "@waytara/ui/cn";
import { statusLabel } from "./stock-types";

/** One colour per status, so a line can be told apart at a glance: green in stock, amber reserved, violet installed, orange repair, red damaged, sky returned, grey retired or used up. */
const TONES: Record<string, { badge: string; dot: string }> = {
  in_stock: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30", dot: "bg-emerald-500" },
  reserved: { badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30", dot: "bg-amber-500" },
  installed: { badge: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30", dot: "bg-violet-500" },
  repair: { badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30", dot: "bg-orange-500" },
  damaged: { badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30", dot: "bg-red-500" },
  returned: { badge: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30", dot: "bg-sky-500" },
  retired: { badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-300 dark:border-zinc-500/30", dot: "bg-zinc-400" },
  used_up: { badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-300 dark:border-zinc-500/30", dot: "bg-zinc-400" },
};

export const STATUS_DOT: Record<string, string> = Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, v.dot]));

const FALLBACK = { badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };

/** The status of a stock unit as a coloured badge. */
export function StockStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = TONES[status] ?? FALLBACK;
  return (
    <Badge variant="outline" className={cn("gap-1.5", tone.badge, className)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {statusLabel(status)}
    </Badge>
  );
}
