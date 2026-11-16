"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/partner/portal", label: "Application" },
  { href: "/partner/portal/profile", label: "Profile and team" },
  { href: "/partner/portal/licences", label: "Licences and documents" },
  { href: "/partner/portal/support", label: "Support" },
] as const;

/** The partner's pages as a quiet row of tabs (the avatar menu has the same links). Scrolls sideways on a phone. */
export function PortalNav() {
  const path = usePathname();
  return (
    <nav aria-label="Partner area" className="fluid-container -mt-2 mb-8 overflow-x-auto">
      <ul className="mx-auto flex min-w-max max-w-5xl gap-1 border-b border-theme-border">
        {ITEMS.map((i) => {
          const on = i.href === "/partner/portal" ? path === i.href : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={on ? "page" : undefined} className={cn("-mb-px inline-block border-b-2 px-3 py-2.5 text-sm transition-colors", on ? "border-theme-primary font-medium text-theme-primary" : "border-transparent text-theme-muted hover:text-theme-primary")}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
