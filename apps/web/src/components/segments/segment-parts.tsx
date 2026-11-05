import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { cn } from "@/lib/utils";

// The building blocks every segment page is made of (docs/WEBSITE_PLAN.md section 7), in the landing page's minimal style.

export interface Cta {
  label: string;
  href: string;
}

/** Opens a segment page: eyebrow, headline, one paragraph, two ways in, and the segment's photo. */
export function SegmentHero({
  eyebrow,
  title,
  accent,
  body,
  primary,
  secondary,
  secondaryHint,
  image,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  body: string;
  primary: Cta;
  secondary: Cta;
  /** A few words under the secondary link ("Existing equipment · EMS"). */
  secondaryHint?: string;
  image: string;
}) {
  return (
    <section className="pb-12 pt-[clamp(6.5rem,10vw,9rem)] sm:pb-16">
      <div className="fluid-container grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
          <h1 className="mt-4 text-[clamp(2.2rem,4.4vw,4rem)] font-bold leading-[1.12] tracking-tight text-theme-primary">
            {title}
            {accent && <span className="block text-primary-gradient">{accent}</span>}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-theme-secondary sm:text-base">{body}</p>

          <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
            <Link
              href={primary.href}
              className="group inline-flex h-12 items-center gap-3 rounded-full bg-emerald-600 pl-6 pr-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-500 active:scale-95"
            >
              <span>{primary.label}</span>
              <span className="flex size-9 items-center justify-center rounded-full bg-white text-emerald-700 transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
            <div>
              <Link href={secondary.href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                {secondary.label}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              {secondaryHint && <p className="mt-0.5 text-xs text-theme-muted">{secondaryHint}</p>}
            </div>
          </div>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-theme-surface">
          <Image src={image} alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
      </div>
    </section>
  );
}

/** One section of a segment page: an anchor for the in-page menu, the section header, then whatever the section holds. */
export function SegmentSection({
  id,
  badge,
  title,
  accent,
  summary,
  children,
}: {
  id: string;
  badge: string;
  title: string;
  accent?: string;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="section-padding scroll-mt-28">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader badge={badge} title={title} accent={accent} summary={summary} />
        </Reveal>
        {children}
      </div>
    </section>
  );
}

export interface Feature {
  icon: LucideIcon;
  /** Three to five words. */
  title: string;
  /** One plain sentence. */
  body: string;
  /** Up to four short ticked lines under a thin rule. */
  includes?: string[];
}

/**
 * Features in the Apple product-page style, with the wording of the landing page's "What WayTara does": no boxes, a large thin icon, a short bold
 * title, one plain sentence, and optionally a short ticked list. Two to four columns across, stacked on a phone.
 */
export function FeatureColumns({ items }: { items: Feature[] }) {
  const two = items.length === 2;
  const cols = items.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : two ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  // Each block takes four rows (icon, title, sentence, list) shared with its neighbours in the same row of blocks (subgrid), so the titles,
  // sentences and tick lists line up whatever the text length. Two blocks sit centred. The gap between rows of blocks is the padding at each block's foot.
  return (
    <ul className={cn("-mb-14 grid grid-cols-1 gap-x-12", cols, two && "mx-auto max-w-4xl")}>
      {items.map(({ icon: Icon, title, body, includes }, i) => (
        <li key={title} className="row-span-4 grid grid-rows-subgrid pb-14">
          <Reveal direction="up" duration={800} distance={24} delay={(i % 4) * 90} className="row-span-4 grid grid-rows-subgrid">
            <Icon className="size-12 stroke-[1.1] text-theme-primary sm:size-14" aria-hidden="true" />
            <h3 className="mt-6 text-lg font-bold tracking-tight text-theme-primary sm:text-xl">{title}</h3>
            <p className="mt-2 max-w-[26rem] text-pretty text-[15px] leading-relaxed text-theme-secondary sm:text-base">{body}</p>
            {includes && (
              <ul className="mt-5 space-y-2.5 self-start border-t border-theme-border pt-5">
                {includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

/** A research finding, always labelled with its source and what it does not mean. */
export function EvidencePanel({ source, figure, text, caveat }: { source: string; figure: string; text: string; caveat: string }) {
  return (
    <div className="rounded-2xl border border-theme-border bg-theme-surface p-7 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{source}</p>
      <p className="mt-4 text-[clamp(2.5rem,4vw,3.5rem)] font-bold leading-none tracking-tight text-primary-gradient">{figure}</p>
      <p className="mt-3 text-sm leading-relaxed text-theme-primary">{text}</p>
      <p className="mt-3 text-xs leading-relaxed text-theme-muted">{caveat}</p>
    </div>
  );
}

/** The closing band of a segment page: the two enquiry routes, one for a new system and one for equipment the visitor already has. */
export function EnquiryRoutes({ heading, accent, newRoute, existingRoute }: { heading: string; accent: string; newRoute: Cta & { hint: string }; existingRoute: Cta & { hint: string } }) {
  return (
    <section id="enquire" className="section-padding scroll-mt-28">
      <div className="fluid-container">
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-8 rounded-2xl border border-theme-border bg-theme-surface px-7 py-10 sm:px-10 lg:grid-cols-5 lg:items-center lg:gap-12 lg:py-12">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.4rem)] font-bold leading-[1.2] tracking-tight text-theme-primary lg:col-span-2">
              {heading}
              <span className="block text-primary-gradient">{accent}</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-3">
              {[newRoute, existingRoute].map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className="group flex h-full flex-col rounded-xl border border-theme-border bg-theme-bg p-5 transition-colors hover:border-emerald-500/50 focus-visible:border-emerald-500/50 focus-visible:outline-none"
                >
                  <span className="text-sm font-semibold text-theme-primary">{route.label}</span>
                  <span className="mt-1 text-xs leading-relaxed text-theme-secondary">{route.hint}</span>
                  <ArrowRight className="mt-4 size-4 text-theme-muted transition-all group-hover:translate-x-0.5 group-hover:text-theme-highlight" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export interface SupportFigure {
  value: string;
  label: string;
}

/** A government scheme on a segment page: the headline figures, the conditions that apply, and where to check eligibility. */
export function SupportPanel({
  kicker,
  headline,
  figures,
  intro,
  conditions,
  conditionsTitle = "Conditions that apply",
  link,
}: {
  kicker: string;
  /** The big figure. */
  headline: string;
  /** Smaller supporting figures under it. */
  figures?: SupportFigure[];
  intro: string;
  conditions: string[];
  conditionsTitle?: string;
  link: { label: string; href: string };
}) {
  return (
    <Reveal direction="up" duration={800} distance={24}>
      <div className="overflow-hidden rounded-2xl border border-theme-border bg-theme-surface">
        <div className="grid grid-cols-1 lg:grid-cols-5">
          <div className="px-7 py-8 sm:px-8 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{kicker}</p>
            <p className="mt-4 text-[clamp(2.5rem,4vw,3.5rem)] font-bold leading-none tracking-tight text-primary-gradient">{headline}</p>
            <p className="mt-3 text-sm leading-relaxed text-theme-primary">{intro}</p>
            {figures && figures.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-theme-border pt-5">
                {figures.map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs text-theme-muted">{f.label}</dt>
                    <dd className="mt-0.5 text-base font-semibold text-theme-primary">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="border-t border-theme-border px-7 py-8 sm:px-8 lg:col-span-3 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{conditionsTitle}</p>
            <ul className="mt-4 space-y-3">
              {conditions.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm leading-relaxed text-theme-secondary">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <Link href={link.href} className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
              {link.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/**
 * A full-width band for a second audience on the same page (builders and developers on the Apartments page). A tinted background and its
 * own call to action make it read as a separate offer, not another card.
 */
export function AudienceBand({
  id,
  badge,
  title,
  accent,
  summary,
  items,
  closing,
  cta,
}: {
  id: string;
  badge: string;
  title: string;
  accent: string;
  summary: string;
  items: { title: string; body: string }[];
  closing: { title: string; body: string };
  cta: Cta;
}) {
  return (
    <section id={id} className="section-padding scroll-mt-28 border-y border-theme-border bg-theme-surface">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader badge={badge} title={title} accent={accent} summary={summary} />
        </Reveal>
        <Reveal direction="up" duration={800} distance={24}>
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-theme-border bg-theme-border md:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <li key={item.title} className="bg-theme-bg px-7 py-7">
                <h3 className="text-base font-semibold text-theme-primary">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-theme-secondary">{item.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-theme-primary">{closing.title}</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-theme-secondary">{closing.body}</p>
            </div>
            <Link
              href={cta.href}
              className="group inline-flex h-12 shrink-0 items-center gap-3 rounded-full bg-emerald-600 pl-6 pr-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-500 active:scale-95"
            >
              <span>{cta.label}</span>
              <span className="flex size-9 items-center justify-center rounded-full bg-white text-emerald-700 transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export interface PolicyItem {
  tag: string;
  title: string;
  body: string;
}

/** Policy and money points as rows (tag and title on the left, the explanation on the right), for pages with several separate provisions. */
export function PolicyRows({ items }: { items: PolicyItem[] }) {
  return (
    <Reveal direction="up" duration={800} distance={24}>
      <ul className="border-t border-theme-border">
        {items.map((item) => (
          <li key={item.title} className="grid grid-cols-1 gap-3 border-b border-theme-border py-7 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{item.tag}</p>
              <h3 className="mt-2 text-lg font-semibold text-theme-primary">{item.title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-theme-secondary lg:col-span-3">{item.body}</p>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/** A bordered band: a kicker, a title and a few lines on the left, and optionally a checklist and a link on the right. */
export function InfoBand({
  kicker,
  title,
  body,
  items,
  cta,
}: {
  kicker: string;
  title: string;
  body?: string;
  items?: string[];
  cta?: Cta;
}) {
  return (
    <section className="scroll-mt-28 pb-[clamp(2.5rem,5vw,5rem)]">
      <div className="fluid-container">
        <Reveal direction="up" duration={800} distance={24}>
          <div className="grid grid-cols-1 gap-8 rounded-2xl border border-theme-border bg-theme-surface px-7 py-9 sm:px-10 lg:grid-cols-5 lg:items-center lg:gap-12">
            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{kicker}</p>
              <p className="mt-3 text-xl font-semibold text-theme-primary">{title}</p>
              {body && <p className="mt-2 text-sm leading-relaxed text-theme-secondary">{body}</p>}
              {cta && (
                <Link href={cta.href} className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                  {cta.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              )}
            </div>
            {items && (
              <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:col-span-3">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** A small picture of how a site's equipment and the WayTara platform connect. No hardware detail: that belongs on the Platform page. */
export function PlatformDiagram({ inputs, note }: { inputs: string[]; note: string }) {
  return (
    <div className="mt-12 rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">Connect the equipment. Connect the energy system.</p>
      <div className="mt-6 grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1.2fr]">
        <div className="space-y-3">
          {inputs.map((label) => (
            <div key={label} className="rounded-xl border border-theme-border bg-theme-bg px-4 py-3 text-sm font-semibold text-theme-primary">
              {label}
            </div>
          ))}
        </div>
        <ArrowRight className="mx-auto size-5 rotate-90 text-theme-muted md:rotate-0" aria-hidden="true" />
        <div className="rounded-xl border border-theme-border bg-theme-bg px-4 py-6 text-center text-sm font-semibold text-theme-primary">WayTara gateway</div>
        <ArrowRight className="mx-auto size-5 rotate-90 text-theme-muted md:rotate-0" aria-hidden="true" />
        <div className="rounded-xl border border-emerald-500/40 bg-theme-bg px-4 py-4">
          <p className="text-sm font-semibold text-theme-primary">WayTara platform</p>
          <p className="mt-2 text-xs text-theme-secondary">Energy management: monitor supported energy equipment.</p>
          <p className="mt-1.5 text-xs text-theme-secondary">Charging management: operate compatible charging infrastructure.</p>
        </div>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-theme-muted">{note}</p>
    </div>
  );
}
