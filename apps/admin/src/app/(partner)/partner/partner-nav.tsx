"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/partner", label: "Home" },
  { href: "/partner/profile", label: "Profile and team" },
  { href: "/partner/licences", label: "Licences and documents" },
  { href: "/partner/support", label: "Support" },
] as const;

/** The four pages a partner has. The one they are on is marked; the bar scrolls sideways on a phone. */
export function PartnerNav() {
  const path = usePathname();
  return (
    <nav aria-label="Partner area" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {ITEMS.map((i) => {
          const on = i.href === "/partner" ? path === "/partner" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={on ? "page" : undefined}
                className={cn("-mb-px inline-block border-b-2 px-3 py-2.5 text-sm transition-colors", on ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
