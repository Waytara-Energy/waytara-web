"use client";

import Link from "next/link";
import type { HeaderMenu } from "@/config/site-nav";

/**
 * The full-width panel that drops from the header (the Apple pattern): a small label and a column of large links on the left, a small label and
 * a few small links on the right. The page behind it is dimmed and blurred by the header, not here.
 */
export function MegaMenuPanel({ menu, onNavigate }: { menu: HeaderMenu; onNavigate: () => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-10 sm:px-10">
      <div className="grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs text-theme-muted">{menu.bigLabel}</p>
          <ul className="mt-4 space-y-1.5">
            {menu.big.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className="inline-block text-[clamp(1.35rem,2vw,1.75rem)] font-semibold leading-[1.25] tracking-tight text-theme-primary outline-none transition-colors hover:text-theme-highlight focus-visible:text-theme-highlight"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs text-theme-muted">{menu.asideTitle}</p>
          <ul className="mt-4 space-y-2.5">
            {menu.aside.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={onNavigate} className="text-xs font-semibold text-theme-primary outline-none transition-colors hover:text-theme-highlight focus-visible:text-theme-highlight">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
