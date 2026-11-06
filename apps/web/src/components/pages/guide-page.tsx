import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { FaqList } from "@/components/segments/faq-list";
import { SegmentSection } from "@/components/segments/segment-parts";
import { JsonLd } from "@/components/seo/json-ld";
import { GUIDES, type Guide, type GuideBlock } from "@/data/guides";
import { articleJsonLd } from "@/lib/seo";
import { PageHero, PageShell } from "./page-shell";

const LINK = "font-semibold text-theme-highlight underline-offset-4 hover:underline";

/** Every guide links to the real pages it talks about: this puts the links in as the words appear, without writing links into the data. */
const LINKED_PHRASES: { phrase: string; href: string }[] = [
  { phrase: "on-grid, hybrid and off-grid solar", href: "/on-grid-hybrid-off-grid-solar" },
  { phrase: "solar subsidy guide", href: "/solar-subsidy-tamil-nadu" },
  { phrase: "how solar reduces your EB bill", href: "/reduce-electricity-bill-solar" },
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

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-base leading-relaxed text-theme-secondary">{withLinks(block.text)}</p>;
    case "list":
      return (
        <ul className="space-y-3">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-base leading-relaxed text-theme-secondary">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>{withLinks(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-6">
          {block.items.map((step, i) => (
            <li key={step.title} className="flex items-start gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/70 text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-theme-primary">{step.title}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-theme-secondary">{withLinks(step.body)}</p>
              </div>
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
        <div className="border-l-2 border-emerald-500/70 pl-5">
          <p className="font-semibold text-theme-primary">{block.title}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-theme-secondary">{withLinks(block.body)}</p>
        </div>
      );
  }
}

/**
 * A guide page: the answer first, the short version, the detail in sections, a visible FAQ (the same text the FAQ structured data is made from), where to go next,
 * and when it was last checked. One template for every guide, so they all look and read the same.
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

      <section className="pb-4">
        <div className="fluid-container">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-theme-muted">In short</p>
            <ul className="mt-4 space-y-3">
              {guide.inShort.map((line) => (
                <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-theme-primary">
                  <CircleCheck className="mt-1 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-theme-muted">
              Last checked {guide.updatedLabel}. This is general information, not legal, tax or financial advice, and figures are estimates.
            </p>
          </div>
        </div>
      </section>

      {guide.sections.map((section) => (
        <SegmentSection key={section.id} id={section.id} badge={section.badge} title={section.title} accent={section.accent}>
          <Reveal direction="up" duration={700} distance={16}>
            <div className="max-w-3xl space-y-6">
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </div>
          </Reveal>
        </SegmentSection>
      ))}

      <SegmentSection id="faq" badge="FAQ" title="Questions" accent="people ask.">
        <Reveal direction="up" duration={700} distance={16}>
          <FaqList faqs={guide.faqs} />
        </Reveal>
      </SegmentSection>

      <SegmentSection id="next" badge="Next" title="Ready to look at" accent="your own roof?">
        <Reveal direction="up" duration={700} distance={16}>
          <div className="max-w-3xl">
            <p className="text-base leading-relaxed text-theme-secondary">
              Tell us about your property in the planner and get a first blueprint, or talk to an engineer. There is no commitment either way.
            </p>
            <div className="mt-6 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
              <Link
                href="/planner"
                className="group inline-flex h-12 items-center gap-3 rounded-full bg-emerald-600 pl-6 pr-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-500 active:scale-95"
              >
                <span>Plan my system</span>
                <span className="flex size-9 items-center justify-center rounded-full bg-white text-emerald-700 transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
              <Link href="/contact" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                Talk to us
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>

            <p className="mt-12 text-sm font-semibold text-theme-muted">Read next</p>
            <ul className="mt-4 space-y-3">
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
          </div>
        </Reveal>
      </SegmentSection>
    </PageShell>
  );
}
