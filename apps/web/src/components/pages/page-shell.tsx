import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { JsonLd } from "@/components/seo/json-ld";
import { SegmentMenu, type SegmentMenuItem } from "@/components/segments/segment-menu";
import type { Cta } from "@/components/segments/segment-parts";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";

/**
 * The frame of the company pages (Platform, Why WayTara, About Us): header, hero, an optional sticky in-page menu, the sections, and the
 * footer, with breadcrumb (and FAQ) data for search engines.
 */
export function PageShell({
  name,
  path,
  menu,
  faqs,
  hero,
  children,
}: {
  name: string;
  path: string;
  menu?: SegmentMenuItem[];
  faqs?: { question: string; answer: string }[];
  hero: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-theme-bg text-theme-primary">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name, path },
          ]),
          ...(faqs ? [faqJsonLd(faqs)] : []),
        ]}
      />
      <Navigation />
      <main className="flex-1">
        {hero}
        {menu && <SegmentMenu items={menu} />}
        {children}
      </main>
      <Footer />
    </div>
  );
}

/** A hero for a company page: eyebrow, headline, one paragraph, up to two actions, and an optional photo. */
export function PageHero({
  eyebrow,
  title,
  accent,
  body,
  primary,
  secondary,
  image,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  body: string;
  primary?: Cta;
  secondary?: Cta;
  image?: string;
}) {
  const hasImage = Boolean(image);
  return (
    <section className="pb-12 pt-[clamp(6.5rem,10vw,9rem)] sm:pb-16">
      <div className={hasImage ? "fluid-container grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16" : "fluid-container"}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.2rem,4.4vw,4rem)] font-bold leading-[1.12] tracking-tight text-theme-primary">
            {title}
            {accent && <span className="block text-primary-gradient">{accent}</span>}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-theme-secondary sm:text-base">{body}</p>
          {(primary || secondary) && (
            <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
              {primary && (
                <Link
                  href={primary.href}
                  className="group inline-flex h-12 items-center gap-3 rounded-full bg-emerald-600 pl-6 pr-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-500 active:scale-95"
                >
                  <span>{primary.label}</span>
                  <span className="flex size-9 items-center justify-center rounded-full bg-white text-emerald-700 transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </Link>
              )}
              {secondary && (
                <Link href={secondary.href} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
                  {secondary.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </div>
        {image && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-theme-surface">
            <Image src={image} alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}
