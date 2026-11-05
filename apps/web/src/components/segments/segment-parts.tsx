import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
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
  title: string;
  body: string;
  /** A small uppercase label at the top right of the cell. */
  tag?: string;
  includes?: string[];
}

/** Features in hairline-divided columns: three or four across, stacked on a phone. */
export function FeatureColumns({ items }: { items: Feature[] }) {
  const cols = items.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
  return (
    <Reveal direction="up" duration={800} distance={24}>
      {/* The 1px gaps show the hairline colour behind the cells, so the dividers are right at any column count. */}
      <ul className={cn("grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-theme-border bg-theme-border", cols)}>
        {items.map(({ icon: Icon, title, body, tag, includes }) => (
          <li key={title} className="flex flex-col bg-theme-surface px-7 py-8 sm:px-8">
            <div className="flex items-center justify-between">
              <Icon className="size-6 stroke-[1.5] text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              {tag && <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">{tag}</span>}
            </div>
            <h3 className="mt-6 text-base font-semibold text-theme-primary">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-theme-secondary">{body}</p>
            {includes && (
              <ul className="mt-5 space-y-2.5 border-t border-theme-border pt-5">
                {includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-theme-secondary">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Reveal>
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
