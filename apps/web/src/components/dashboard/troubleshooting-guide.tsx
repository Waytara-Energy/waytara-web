"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isActiveItem, type GuideItem, type GuideSection } from "@/lib/troubleshooting-guide";
import { cn } from "@/lib/utils";

type Level = GuideItem["severity"];
type Filter = "all" | "active" | Level;

// One colour per level, used for the dot on each row and for the filter chips (like Vercel's status filters).
const LEVELS: { id: Level; label: string; dot: string; on: string }[] = [
  { id: "critical", label: "Critical", dot: "bg-red-500", on: "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400" },
  { id: "warning", label: "Warning", dot: "bg-amber-500", on: "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { id: "info", label: "Info", dot: "bg-sky-500", on: "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
];
const DOT: Record<Level, string> = { critical: "bg-red-500", warning: "bg-amber-500", info: "bg-sky-500" };

function Chip({ selected, onClick, dot, tone, children, count }: { selected: boolean; onClick: () => void; dot?: string; tone?: string; children: React.ReactNode; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={count === 0 && !selected}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
        selected ? (tone ?? "border-foreground/30 bg-foreground/10 text-foreground") : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />}
      {children}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

/** A user guide for the device: what each code or light means and what to try. Switch sections or search; filter by how serious
 *  something is. What the device is reporting right now is marked "Active now" and opened, and its section is shown first. */
export function TroubleshootingGuide({ title = "Troubleshooting guide", sections, active }: { title?: string; sections: GuideSection[]; active: string[] }) {
  const activeSection = sections.find((s) => s.items.some((i) => isActiveItem(i, active)))?.id;
  const [picked, setPicked] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  // The reader's own choice wins; until then the section with the active item (or the first) is shown.
  const sectionId = picked ?? activeSection ?? sections[0]?.id;
  const q = query.trim().toLowerCase();

  // What the chips count: the section being read, or every section while searching.
  const scope = q ? sections.flatMap((s) => s.items) : (sections.find((s) => s.id === sectionId)?.items ?? []);
  const textMatch = (i: GuideItem) => !q || `${i.code ?? ""} ${i.label} ${i.what}`.toLowerCase().includes(q);
  const inScope = scope.filter(textMatch);
  const count = (l: Level) => inScope.filter((i) => i.severity === l).length;
  const activeCount = inScope.filter((i) => isActiveItem(i, active)).length;
  const passes = (i: GuideItem) => textMatch(i) && (filter === "all" || (filter === "active" ? isActiveItem(i, active) : i.severity === filter));

  const shown = (q ? sections : sections.filter((s) => s.id === sectionId))
    .map((section) => ({ section, items: section.items.filter(passes) }))
    .filter((g) => g.items.length > 0);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a code or a problem" className="h-8 pl-8 text-sm" aria-label="Search the guide" />
          </div>
        </div>
        {!q && (
          <ToggleGroup type="single" variant="outline" size="sm" value={sectionId} onValueChange={(v) => v && setPicked(v)} className="flex flex-wrap justify-start gap-1" aria-label="Guide sections">
            {sections.map((s) => (
              <ToggleGroupItem key={s.id} value={s.id} className="h-8 gap-1.5 px-2.5 text-xs">
                {s.title}
                {s.id === activeSection && <span aria-label="has an active item" className="size-1.5 rounded-full bg-red-500" />}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by severity">
          <Chip selected={filter === "all"} onClick={() => setFilter("all")} count={inScope.length}>
            All
          </Chip>
          {activeCount > 0 && (
            <Chip selected={filter === "active"} onClick={() => setFilter(filter === "active" ? "all" : "active")} dot="animate-pulse bg-red-500" tone="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400" count={activeCount}>
              Active now
            </Chip>
          )}
          {LEVELS.map((l) => (
            <Chip key={l.id} selected={filter === l.id} onClick={() => setFilter(filter === l.id ? "all" : l.id)} dot={l.dot} tone={l.on} count={count(l.id)}>
              {l.label}
            </Chip>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {shown.length === 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>{q ? "Nothing matches. Try a code such as F58, or a word such as battery." : "Nothing here matches this filter."}</p>
            {filter !== "all" && (
              <button type="button" onClick={() => setFilter("all")} className="mt-1 text-foreground underline underline-offset-4">
                Show all
              </button>
            )}
          </div>
        )}
        {shown.map(({ section, items }) => (
          <div key={section.id} className="space-y-2">
            {(q || section.note) && (
              <div>
                {q && <p className="text-xs font-semibold text-foreground">{section.title}</p>}
                {section.note && <p className="text-xs text-muted-foreground">{section.note}</p>}
              </div>
            )}
            <Accordion type="multiple" defaultValue={items.filter((i) => isActiveItem(i, active)).map((i) => i.label)} className="overflow-hidden rounded-lg border border-border">
              {items.map((item) => {
                const on = isActiveItem(item, active);
                return (
                  // The shared accordion styles an open row with a left bar and a tint; here an open row just stays flat.
                  <AccordionItem key={`${item.code ?? "light"}-${item.label}`} value={item.label} className="rounded-none border-b border-border/70 last:border-b-0 data-[state=open]:border-l-0 data-[state=open]:bg-muted/30 data-[state=open]:pl-0">
                    <AccordionTrigger className="min-w-0 gap-3 px-3 py-2.5 text-sm hover:bg-muted/40 hover:no-underline md:text-sm">
                      <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[item.severity])} />
                        {item.code && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">{item.code}</span>}
                        <span className="min-w-0 truncate font-medium text-foreground">{item.label}</span>
                        {on && <Badge variant="alert" className="shrink-0">Active now</Badge>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="space-y-2 pl-[18px] text-sm">
                        <p className="text-muted-foreground">{item.what}</p>
                        {item.steps.length === 1 && <p className="text-foreground">{item.steps[0]}</p>}
                        {item.steps.length > 1 && (
                          <ol className="list-decimal space-y-1 pl-5 text-foreground marker:text-muted-foreground">
                            {item.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Never open the inverter, battery or charger yourself. If a step does not fix it, or you are unsure, contact your WayTara advisor.</p>
      </CardContent>
    </Card>
  );
}
