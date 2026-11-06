"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, RotateCcw } from "lucide-react";
import type { Blueprint } from "@/lib/planner/types";
import { trackPlanner } from "./planner-analytics";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-theme-muted">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-theme-secondary">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Your Energy Blueprint": always in the same order (recommended solution, what it includes, why it fits, what is not included, existing
 * equipment, next step). Shown before any contact details are asked for, and never with sizes, prices, savings, payback or backup hours.
 * Frameless, like the rest of the site: a headline, two plain columns under a thin rule, and a note.
 */
export function BlueprintView({ blueprint, onRestart }: { blueprint: Blueprint; onRestart: () => void }) {
  const b = blueprint;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Your energy blueprint · {b.routeLabel}</p>
      <h2 className="mt-4 max-w-3xl text-[clamp(2rem,4vw,3.4rem)] font-bold leading-[1.12] tracking-tight text-theme-primary">{b.headline}</h2>
      <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-theme-secondary sm:text-lg">{b.summary}</p>

      <div className="mt-12 grid grid-cols-1 gap-x-16 gap-y-10 border-t border-theme-border pt-10 lg:grid-cols-2">
        <div className="space-y-10">
          <Block title="What we recommend">
            <ul className="space-y-5">
              {b.includes.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <div>
                    <p className="text-base font-semibold text-theme-primary">{item.title}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-theme-secondary">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Block>
          {b.notIncluded.length > 0 && (
            <Block title="What is not included">
              <Bullets items={b.notIncluded} />
            </Block>
          )}
        </div>

        <div className="space-y-10">
          {b.why.length > 0 && (
            <Block title="Why this fits">
              <Bullets items={b.why} />
            </Block>
          )}
          {b.existing.length > 0 && (
            <Block title="Your existing equipment">
              <Bullets items={b.existing} />
            </Block>
          )}
          {b.uncertain.length > 0 && (
            <Block title="Still to confirm">
              <Bullets items={b.uncertain} />
            </Block>
          )}
        </div>
      </div>

      <div className="mt-12 border-t border-theme-border pt-8">
        <p className="text-lg font-semibold tracking-tight text-theme-primary">Why we have not recommended a fixed system size</p>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-theme-secondary">
          Capacity, backup duration and cost depend on your site and electrical assessment. This blueprint is a starting point for that conversation, not a final design.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href={b.next.pageHref}
          onClick={() => trackPlanner("segment_page_opened", { page: b.next.pageHref, route: b.routeLabel })}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline"
        >
          Read more on {b.next.pageLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        <button type="button" onClick={onRestart} className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-secondary hover:text-theme-primary">
          <RotateCcw className="size-4" aria-hidden="true" />
          Start again
        </button>
      </div>
    </div>
  );
}
