import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeader } from "@/components/shared/section-header";
import { SOLUTION_SEGMENTS } from "@/config/site-nav";

interface WhoWeServeProps {
  id?: string;
  badge?: string;
  title?: string;
  accent?: string;
  summary?: string;
  /** Under each card, the two ways in: plan a new system, or connect equipment the visitor already has (the Solutions hub shows these). */
  showRoutes?: boolean;
}

/** The six kinds of property WayTara serves: a photo, a name and one line each, every card leading to its own page. */
export function WhoWeServe({
  id = "who-we-serve",
  badge = "Who we serve",
  title = "From homes to campuses,",
  accent = "built around the site.",
  summary = "Pick the kind of property you have to see what WayTara does for it.",
  showRoutes = false,
}: WhoWeServeProps) {
  return (
    <section id={id} className="section-padding bg-theme-bg scroll-mt-28">
      <div className="fluid-container">
        <Reveal direction="up" duration={700} distance={24}>
          <SectionHeader badge={badge} title={title} accent={accent} summary={summary} />
        </Reveal>

        <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTION_SEGMENTS.map((segment, i) => (
            <li key={segment.href}>
              <Reveal direction="up" duration={800} distance={24} delay={(i % 3) * 100}>
                <Link href={segment.href} className="group block outline-none">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-theme-surface ring-offset-2 ring-offset-theme-bg group-focus-visible:ring-2 group-focus-visible:ring-emerald-500">
                    {segment.image && (
                      <Image
                        src={segment.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                    )}
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-theme-primary">{segment.label}</h3>
                      <p className="mt-1 text-sm text-theme-secondary">{segment.blurb}</p>
                    </div>
                    <ArrowUpRight
                      className="mt-1 size-5 shrink-0 text-theme-muted transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-theme-highlight"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
                {showRoutes && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold">
                    <Link href={`/planner?start=build&for=${segment.href.split("/").pop()}`} className="text-theme-highlight underline-offset-4 hover:underline">
                      Plan a new system
                    </Link>
                    <Link href="/technology#compatibility" className="text-theme-secondary underline-offset-4 hover:text-theme-primary hover:underline">
                      Connect existing equipment
                    </Link>
                  </div>
                )}
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
