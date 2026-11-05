"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

export interface Faq {
  question: string;
  answer: string;
}

/**
 * Questions and answers, one card per question: the question in bold with a round chevron at the right, and the answer under a thin rule when it
 * is open. One open at a time, the first open to begin with. Every FAQ on the site uses this, so they all look the same.
 */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <AccordionPrimitive.Root type="single" collapsible defaultValue={faqs[0]?.question} className="flex flex-col gap-3">
      {faqs.map((faq) => (
        <AccordionPrimitive.Item
          key={faq.question}
          value={faq.question}
          className="overflow-hidden rounded-2xl border border-theme-border bg-theme-surface transition-colors data-[state=open]:border-emerald-500/30"
        >
          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger className="group/trigger flex flex-1 items-center justify-between gap-4 px-5 py-5 text-left text-[15px] font-bold leading-snug tracking-tight text-theme-primary outline-none transition-colors hover:text-theme-highlight focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:px-6">
              <span className="min-w-0">{faq.question}</span>
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-theme-border bg-theme-bg text-theme-secondary transition-colors group-data-[state=open]/trigger:border-emerald-500/40 group-data-[state=open]/trigger:text-emerald-600 dark:group-data-[state=open]/trigger:text-emerald-400"
                aria-hidden="true"
              >
                <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
              </span>
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <p className="border-t border-theme-border px-5 py-5 text-[15px] leading-relaxed text-theme-secondary sm:px-6">{faq.answer}</p>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
}
