"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { PAGE_MENUS, SOLUTIONS_HUB, SOLUTION_NEEDS, SOLUTION_SEGMENTS } from "@/config/site-nav";
import { AccountSection, AuthSlot, type Account, type AuthState, type Fleet } from "@/components/sections/account-panel";

// The groups that fold open to their pages: Solutions, then every page item.
const GROUPS = [
  { label: SOLUTIONS_HUB.label, links: [{ label: "All solutions", href: SOLUTIONS_HUB.href }, ...SOLUTION_SEGMENTS, ...SOLUTION_NEEDS] },
  ...PAGE_MENUS.map((m) => ({ label: m.label, links: [{ label: `${m.label} page`, href: m.href }, ...m.items] })),
];

/**
 * The phone's menu: it slides down from the top and fills the whole screen (the pattern of Framer's), with the logo at the left and, at the right, the
 * account slot (the avatar, or Login, or a loader while it is not known yet) and a close button. Under them the site's pages as large rows that fold open;
 * for a signed-in visitor, under those, two quiet rows: Dashboard (with how many devices are online) and Sign out.
 *
 * It stays in the page when closed (moved off the top and hidden, with `inert` so nothing in it can be focused) so that it can animate both ways.
 * It must not sit inside the header: the header's blur would make the header, not the screen, the thing it is "fixed" to.
 */
export function MobileMenu({
  open,
  onClose,
  authState,
  account,
  fleet,
}: {
  open: boolean;
  onClose: () => void;
  authState: AuthState;
  account: Account | null;
  fleet: Fleet;
}) {
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // While it is open the page behind does not scroll, Escape closes it, and focus starts on the close button.
  React.useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // A moment later: while the menu is still sliding in it is not yet visible, and a hidden element cannot take focus.
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 80);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-primary transition-[transform,visibility] duration-300 ease-out motion-reduce:transition-none lg:hidden",
        open ? "visible translate-y-0" : "invisible -translate-y-full"
      )}
    >
      {/* The bar: the same height as the site's header, so nothing jumps when the menu opens. */}
      <div className="fluid-container flex h-[clamp(3.5rem,4.5vw,4.25rem)] shrink-0 items-center justify-between">
        <Logo imageClassName="h-[30px]" />
        <div className="flex items-center gap-2.5">
          <AuthSlot state={authState} account={account} solid compact onNavigate={onClose} avatarSize="size-[32px]" />
          <button
            ref={closeRef}
            type="button"
            aria-label="Close the menu"
            onClick={onClose}
            className="flex size-[32px] cursor-pointer items-center justify-center rounded-lg bg-theme-surface text-theme-primary outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="size-[20px]" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="fluid-container pb-12 pt-3">
          <nav aria-label="Menu">
            <ul>
              {GROUPS.map((group) => {
                const expanded = openGroup === group.label;
                return (
                  <li key={group.label} className="border-b border-theme-border/60">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpenGroup((v) => (v === group.label ? null : group.label))}
                      className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[22px] font-semibold tracking-tight text-theme-primary outline-none focus-visible:text-theme-highlight"
                    >
                      <span>{group.label}</span>
                      <ChevronDown aria-hidden="true" className={cn("size-5 text-theme-muted transition-transform duration-200", expanded && "rotate-180")} />
                    </button>
                    {expanded && (
                      <ul className="mb-3 flex flex-col gap-0.5 pb-1">
                        {group.links.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              onClick={onClose}
                              className="block rounded-lg px-1 py-2.5 text-base font-medium text-theme-secondary outline-none transition-colors hover:text-theme-primary focus-visible:text-theme-primary"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Signed in: two quiet rows. Signed out: nothing more (the bar above already has Login). */}
          {authState === "in" && account && (
            <div className="mt-2">
              <AccountSection fleet={fleet} onNavigate={onClose} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
