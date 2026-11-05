"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANNER_LINK, SOLUTIONS_HUB, SOLUTION_NEEDS, SOLUTION_SEGMENTS, type PageMenu as PageMenuConfig } from "@/config/site-nav";
import { NavDropdown } from "./nav-dropdown";

/**
 * The header's "Solutions" dropdown: the six property types on the left, the three things WayTara does on the right. The label itself only
 * opens the menu; the Solutions page is reached from "All solutions" inside it.
 */
export function SolutionsMenu({ triggerClassName }: { triggerClassName: string }) {
  return (
    <NavDropdown
      panelId="solutions-menu-panel"
      panelClassName="w-[min(46rem,calc(100vw-3rem))]"
      renderTrigger={({ open, toggle, panelId }) => (
        <button type="button" aria-expanded={open} aria-haspopup="true" aria-controls={panelId} onClick={toggle} className={cn(triggerClassName, "inline-flex items-center gap-1")}>
          {SOLUTIONS_HUB.label}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </button>
      )}
      renderPanel={(close) => (
        <>
          <div className="grid grid-cols-5">
            <div className="col-span-3 p-4">
              <div className="flex items-baseline justify-between px-3 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">By property</p>
                <Link href={SOLUTIONS_HUB.href} onClick={close} className="text-xs font-semibold text-theme-highlight hover:underline focus-visible:underline focus-visible:outline-none">
                  All solutions
                </Link>
              </div>
              <ul>
                {SOLUTION_SEGMENTS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} onClick={close} className="block rounded-lg px-3 py-2 transition-colors hover:bg-theme-surface focus-visible:bg-theme-surface focus-visible:outline-none">
                      <span className="block text-[13.5px] font-semibold">{item.label}</span>
                      <span className="block text-xs text-theme-secondary">{item.blurb}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2 border-l border-theme-border bg-theme-surface/60 p-4">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-theme-muted">By need</p>
              <ul>
                {SOLUTION_NEEDS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} onClick={close} className="block rounded-lg px-3 py-2 transition-colors hover:bg-theme-bg focus-visible:bg-theme-bg focus-visible:outline-none">
                      <span className="block text-[13.5px] font-semibold">{item.label}</span>
                      <span className="block text-xs text-theme-secondary">{item.blurb}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link
            href={PLANNER_LINK.href}
            onClick={close}
            className="flex items-center justify-between border-t border-theme-border px-7 py-3 text-[13px] font-semibold text-theme-highlight transition-colors hover:bg-theme-surface focus-visible:bg-theme-surface focus-visible:outline-none"
          >
            <span>Not sure which fits? Use the Energy Planner</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </>
      )}
    />
  );
}

/**
 * A dropdown for one of the header's page items (Platform, Why WayTara, About Us, Partner): the sections of that page. The label is a link
 * to the page itself, so clicking it still goes there; hovering or focusing it shows the sections.
 */
export function PageMenu({ menu, triggerClassName }: { menu: PageMenuConfig; triggerClassName: string }) {
  const id = `${menu.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-menu-panel`;
  return (
    <NavDropdown
      panelId={id}
      panelClassName="w-[19rem]"
      renderTrigger={({ open, panelId }) => (
        <Link href={menu.href} aria-expanded={open} aria-haspopup="true" aria-controls={open ? panelId : undefined} className={cn(triggerClassName, "inline-flex items-center gap-1")}>
          {menu.label}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </Link>
      )}
      renderPanel={(close) => (
        <div className="p-2">
          <ul>
            {menu.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={close} className="block rounded-lg px-3 py-2 transition-colors hover:bg-theme-surface focus-visible:bg-theme-surface focus-visible:outline-none">
                  <span className="block text-[13.5px] font-semibold">{item.label}</span>
                  {item.blurb && <span className="block text-xs text-theme-secondary">{item.blurb}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={menu.href}
            onClick={close}
            className="mt-1 flex items-center justify-between rounded-lg border-t border-theme-border px-3 py-2.5 text-[13px] font-semibold text-theme-highlight transition-colors hover:bg-theme-surface focus-visible:bg-theme-surface focus-visible:outline-none"
          >
            <span>Open the {menu.label} page</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    />
  );
}
