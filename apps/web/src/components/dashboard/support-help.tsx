"use client";

import * as React from "react";
import Link from "next/link";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ArrowUpRight, LifeBuoy, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchHelp } from "@/lib/support-help";

/** What the right side of the Support page shows while no ticket is open: answers to the usual questions (searchable) and a way to open a ticket if none of it helps. */
export function SupportHelp({ newTicket }: { newTicket: React.ReactNode }) {
  const [query, setQuery] = React.useState("");
  const items = React.useMemo(() => searchHelp(query), [query]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 max-lg:pr-0">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <LifeBuoy className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">How can we help?</h2>
            <p className="text-sm text-muted-foreground">Many problems have a quick fix. Try these first, or open a ticket from the list.</p>
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: offline, battery, bill…" aria-label="Search the help" className="h-10 pl-9" />
        </div>
      </section>

      <section>
        <h3 className="mb-3 px-1 text-sm font-semibold text-foreground">Common questions</h3>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;. A ticket is the quickest way to get an answer.</p>
            <div className="mt-3 flex justify-center">{newTicket}</div>
          </div>
        ) : (
          <AccordionPrimitive.Root type="single" collapsible className="space-y-3">
            {items.map((i) => (
              <AccordionPrimitive.Item key={i.id} value={i.id} className="group/q rounded-3xl border border-transparent bg-muted/60 px-5 transition-colors data-[state=open]:border-border data-[state=open]:bg-card">
                <AccordionPrimitive.Header className="flex">
                  <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-4 py-3 text-left text-[15px] font-medium text-foreground focus-visible:outline-none">
                    {i.question}
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition-colors group-data-[state=open]/q:bg-muted group-data-[state=open]/q:shadow-none">
                      <Plus className="size-4 group-data-[state=open]/q:hidden" />
                      <X className="hidden size-4 group-data-[state=open]/q:block" />
                    </span>
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <AccordionPrimitive.Content className="overflow-hidden text-sm text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="max-w-2xl space-y-2 pb-5 pr-12 leading-relaxed">
                    {i.answer.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                    {i.link && (
                      <Link href={i.link.href} className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary underline-offset-2 hover:underline">
                        {i.link.label}
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </AccordionPrimitive.Content>
              </AccordionPrimitive.Item>
            ))}
          </AccordionPrimitive.Root>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-5">
        <div>
          <p className="font-medium text-foreground">Still stuck?</p>
          <p className="text-sm text-muted-foreground">Tell us what is happening. The team that looks after your site will answer here and by e-mail.</p>
        </div>
        {newTicket}
      </section>
    </div>
  );
}
