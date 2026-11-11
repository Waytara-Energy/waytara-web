import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FaqList } from "@/components/segments/faq-list";
import { EnquiryRoutes, SegmentSection } from "@/components/segments/segment-parts";
import { JsonLd } from "@/components/seo/json-ld";
import { cn } from "@/lib/utils";
import { GUIDES, type Guide, type GuideBlock } from "@/data/guides";
import { articleJsonLd } from "@/lib/seo";
import { PageHero, PageShell } from "./page-shell";

const LINK = "font-semibold text-theme-highlight underline-offset-4 hover:underline";

/** Every guide links to the real pages it talks about: this puts the links in as the words appear, without writing links into the data. */
const LINKED_PHRASES: { phrase: string; href: string }[] = [
  { phrase: "on-grid, hybrid and off-grid solar", href: "/on-grid-hybrid-off-grid-solar" },
  { phrase: "solar subsidy guide", href: "/solar-subsidy" },
  { phrase: "how solar reduces your electricity bill", href: "/reduce-electricity-bill-solar" },
  { phrase: "energy planner", href: "/planner" },
  { phrase: "Warranty Policy", href: "/warranty" },
  { phrase: "Terms of Service", href: "/terms" },
  { phrase: "how the platform connects your equipment", href: "/technology" },
];

function withLinks(text: string): React.ReactNode {
  const hit = LINKED_PHRASES.map((l) => ({ ...l, at: text.indexOf(l.phrase) }))
    .filter((l) => l.at >= 0)
    .sort((a, b) => a.at - b.at)[0];
  if (!hit) return text;
  return (
    <>
      {text.slice(0, hit.at)}
      <Link href={hit.href} className={LINK}>
        {hit.phrase}
      </Link>
      {withLinks(text.slice(hit.at + hit.phrase.length))}
    </>
  );
}

/**
 * The blocks of a section, laid out like the other pages: lists as ticked columns under a thin rule, steps as numbered columns (the "Four steps, one team" look),
 * tables across the full width, and plain paragraphs kept to a readable line length.
 */
function Block({ block, inColumn }: { block: GuideBlock; /** Inside one half of a two-column run: use the whole half instead of a reading-width cap. */ inColumn?: boolean }) {
  const cap = inColumn ? "" : "max-w-3xl";
  switch (block.type) {
    case "p":
      return <p className={cn(cap, "text-base leading-relaxed text-theme-secondary")}>{withLinks(block.text)}</p>;
    case "cols":
      return (
        <ul className={cn("grid grid-cols-1 gap-x-12 gap-y-10", block.items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
          {block.items.map((item) => (
            <li key={item.title} className="border-t border-theme-border pt-6">
              <p className="text-lg font-bold tracking-tight text-theme-primary">{item.title}</p>
              <p className="mt-2 text-pretty text-[15px] leading-relaxed text-theme-secondary">{withLinks(item.body)}</p>
            </li>
          ))}
        </ul>
      );
    case "list":
      return (
        <ul className="grid grid-cols-1 gap-x-12 gap-y-4 border-t border-theme-border pt-6 md:grid-cols-2">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-theme-secondary">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>{withLinks(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className={cn("grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2", block.items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {block.items.map((step, i) => (
            <li key={step.title}>
              <span className="flex size-9 items-center justify-center rounded-full border-2 border-emerald-500/70 text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-5 text-lg font-bold tracking-tight text-theme-primary">{step.title}</p>
              <p className="mt-2 max-w-[26rem] text-pretty text-[15px] leading-relaxed text-theme-secondary">{withLinks(step.body)}</p>
            </li>
          ))}
        </ol>
      );
    case "compare":
      return (
        <>
          {/* On a phone each row becomes a short list: label, then one line for each column. */}
          <dl className="sm:hidden">
            {block.rows.map((row) => (
              <div key={row.label} className="border-t border-theme-border py-4">
                <dt className="font-semibold text-theme-primary">{row.label}</dt>
                <dd className="mt-2 space-y-1.5">
                  {row.cells.map((cell, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-theme-secondary">
                      {block.columns.length > 1 && <span className="font-semibold text-theme-primary">{block.columns[i]}: </span>}
                      {cell}
                    </p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <div className="hidden sm:block">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr>
                  <th className="w-[26%] py-3 pr-4" />
                  {block.columns.map((c) => (
                    <th key={c} scope="col" className="py-3 pr-4 text-base font-bold text-theme-primary">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row.label} className="border-t border-theme-border align-top">
                    <th scope="row" className="py-4 pr-4 font-semibold text-theme-primary">
                      {row.label}
                    </th>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="py-4 pr-4 leading-relaxed text-theme-secondary">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
    case "note":
      return (
        <div className={cn(cap, "border-l-2 border-emerald-500/70 pl-5")}>
          <p className="font-semibold text-theme-primary">{block.title}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-theme-secondary">{withLinks(block.body)}</p>
        </div>
      );
  }
}

/** Text-like blocks: they sit well beside each other, so two or more in a row are set in two columns instead of one narrow column with the right half empty. */
const isProse = (b: GuideBlock) => b.type === "p" || b.type === "note" || (b.type === "compare" && b.columns.length === 1);

/** Roughly how tall a block is, in characters of text (a table row counts as a couple of lines), to balance the two columns. */
function weight(b: GuideBlock): number {
  if (b.type === "p") return b.text.length;
  if (b.type === "note") return b.title.length + b.body.length;
  if (b.type === "compare") return b.rows.length * 130;
  return 0;
}

/** Blocks in order; each run of two or more text blocks becomes two balanced columns (the first blocks left, the rest right). */
function Blocks({ blocks }: { blocks: GuideBlock[] }) {
  const groups: GuideBlock[][] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (last && isProse(b) && isProse(last[0])) last.push(b);
    else groups.push([b]);
  }
  return (
    <div className="space-y-10">
      {groups.map((group, gi) => {
        if (group.length < 2) return <Block key={gi} block={group[0]} />;
        const total = group.reduce((n, b) => n + weight(b), 0);
        const left: GuideBlock[] = [];
        const right: GuideBlock[] = [];
        let used = 0;
        for (const b of group) {
          // a block goes left while its middle is still before the half-way line
          if (right.length === 0 && used + weight(b) / 2 <= total / 2) left.push(b);
          else right.push(b);
          used += weight(b);
        }
        return (
          <div key={gi} className="grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
            {[left, right].map((col, ci) => (
              <div key={ci} className="space-y-6">
                {col.map((b, bi) => (
                  <Block key={bi} block={b} inColumn />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A guide page, built from the same parts as the other pages: the hero, "In short" as ticked columns, each section opening with the shared header (headline on the
 * left, one line on the right), the FAQ accordion, and the same closing as the solution pages, with the other guides to read next. One template for every guide.
 */
export function GuidePage({ guide }: { guide: Guide }) {
  return (
    <PageShell
      name={guide.name}
      path={guide.path}
      faqs={guide.faqs}
      hero={
        <PageHero
          eyebrow={guide.eyebrow}
          title={guide.title}
          accent={guide.accent}
          body={guide.answer}
          primary={{ label: "Plan my system", href: "/planner" }}
          secondary={{ label: "Talk to us", href: "/contact" }}
        />
      }
    >
      <JsonLd data={articleJsonLd({ headline: guide.metaTitle, description: guide.metaDescription, path: guide.path, dateModified: guide.updated })} />

      <SegmentSection
        id="in-short"
        badge="In short"
        title="The short"
        accent="version."
        summary={`Last checked ${guide.updatedLabel}. General information, not legal, tax or financial advice; figures are estimates.`}
      >
        <Reveal direction="up" duration={700} distance={16}>
          <ul className="grid grid-cols-1 gap-x-12 gap-y-5 border-t border-theme-border pt-6 md:grid-cols-2">
            {guide.inShort.map((line) => (
              <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-theme-primary">
                <CircleCheck className="mt-1 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </SegmentSection>

      {guide.sections.map((section) => (
        <SegmentSection key={section.id} id={section.id} badge={section.badge} title={section.title} accent={section.accent} summary={section.summary}>
          <Reveal direction="up" duration={700} distance={16}>
            <Blocks blocks={section.blocks} />
          </Reveal>
        </SegmentSection>
      ))}

      <SegmentSection id="faq" badge="FAQ" title="Common questions," accent="answered.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={guide.faqs} />
        </Reveal>
      </SegmentSection>

      <section id="next" className="scroll-mt-28 pb-4">
        <div className="fluid-container">
          <Reveal direction="up" duration={700} distance={16}>
            <p className="text-sm font-semibold text-theme-muted">Read next</p>
            <ul className="mt-4 grid grid-cols-1 gap-x-12 gap-y-3 sm:grid-cols-3">
              {guide.related.map((slug) => {
                const g = GUIDES[slug];
                return (
                  <li key={slug}>
                    <Link href={g.path} className="group inline-flex items-center gap-1.5 font-semibold text-theme-highlight underline-offset-4 hover:underline">
                      {g.name}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      </section>

      <EnquiryRoutes
        heading="Ready to look at"
        accent="your own roof?"
        newRoute={{ label: "Plan my system", href: "/planner", hint: "Tell us about your property and get a first blueprint in a few minutes." }}
        existingRoute={{ label: "Talk to an engineer", href: "/contact", hint: "Ask about your own roof, bills or equipment. There is no commitment either way." }}
      />
    </PageShell>
  );
}
