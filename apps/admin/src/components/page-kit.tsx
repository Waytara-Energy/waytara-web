import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** The top of every staff page: the title, a line saying what the page is for, and the page's main actions at the right. */
export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A row of figures above a table: what is there, at a glance. */
export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

export function StatCard({
  icon: Icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: "warn" | "bad" | "good";
}) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
        <CardDescription className="text-sm font-medium">{title}</CardDescription>
        <span
          className={cn(
            "grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground",
            tone === "warn" && "bg-amber-500/15 text-amber-600",
            tone === "bad" && "bg-red-500/15 text-red-600",
            tone === "good" && "bg-emerald-500/15 text-emerald-600"
          )}
        >
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="grid gap-1 px-5">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

/** What a list says when there is nothing in it. */
export function EmptyState({ icon: Icon, title, description, action }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-14 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

/** Filter pills that are links (the page filters on the server): the active one is filled. */
export function FilterBar({ items, label }: { items: { label: string; href: string; active: boolean; count?: number }[]; label?: string }) {
  return (
    <nav aria-label={label ?? "Filter"} className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <a
          key={i.href}
          href={i.href}
          aria-current={i.active ? "true" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            i.active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {i.label}
          {i.count !== undefined ? <span className={cn("tabular-nums text-xs", i.active ? "opacity-80" : "opacity-60")}>{i.count}</span> : null}
        </a>
      ))}
    </nav>
  );
}

/** A thin message strip for a page that could not load what it needs. */
export function LoadError({ message }: { message: string }) {
  return <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{message}</div>;
}

export type Tone = "neutral" | "info" | "warn" | "good" | "bad" | "violet";

const TONE_CLASS: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-300 dark:border-zinc-500/30", dot: "bg-zinc-400" },
  info: { badge: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30", dot: "bg-sky-500" },
  warn: { badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30", dot: "bg-amber-500" },
  good: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30", dot: "bg-emerald-500" },
  bad: { badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30", dot: "bg-red-500" },
  violet: { badge: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30", dot: "bg-violet-500" },
};

/** A status as a coloured badge with a dot: the same colours mean the same things on every page. */
export function ToneBadge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const t = TONE_CLASS[tone];
  return (
    <Badge variant="outline" className={cn("gap-1.5", t.badge, className)}>
      <span className={cn("size-1.5 rounded-full", t.dot)} />
      {children}
    </Badge>
  );
}
