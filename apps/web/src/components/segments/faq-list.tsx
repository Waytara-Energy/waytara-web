"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface Faq {
  question: string;
  answer: string;
}

/** Questions and answers as an accordion; one open at a time. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion type="single" collapsible className="max-w-3xl">
      {faqs.map((faq) => (
        <AccordionItem key={faq.question} value={faq.question}>
          <AccordionTrigger className="text-[15px] md:text-base">{faq.question}</AccordionTrigger>
          <AccordionContent className="text-sm">{faq.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
