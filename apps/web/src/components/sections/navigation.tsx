"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  ChevronDown,
  Search,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  HEADER_MENUS,
  PAGE_MENUS,
  SOLUTIONS_HUB,
  SOLUTION_NEEDS,
  SOLUTION_SEGMENTS,
  LOGIN_LINK,
} from "@/config/site-nav";
import { MegaMenuShell, menuPanel } from "@/components/sections/mega-menu";
import { SearchPanel } from "@/components/sections/search-panel";

const MOBILE_LINK_CLASS =
  "py-2.5 px-2 text-sm font-semibold text-theme-primary hover:text-theme-highlight hover:bg-theme-surface rounded-lg flex items-center justify-between transition-colors text-left";

interface Account {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName: string | null;
}

function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export function Navigation() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState<string | null>(null);
  // Which header item's panel is open on desktop (null: none). Opens on hover or focus, closes on leaving the header, Escape, or choosing a link.
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null);
  const [shownMenu, setShownMenu] = React.useState<string | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = React.useRef<HTMLElement>(null);
  const openMenu = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveMenu(label);
    setShownMenu(label);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // The search box stays open while the visitor is typing in it, even if the pointer wanders off the header.
    closeTimer.current = setTimeout(() => setActiveMenu((cur) => (cur === "search" && headerRef.current?.contains(document.activeElement) ? cur : null)), 120);
  };
  React.useEffect(() => {
    if (!activeMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenu(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeMenu]);
  const [account, setAccount] = React.useState<Account | null>(null);

  const isHome = pathname === "/";

  // Signed-in customer browsing the public site (e.g. via the dashboard's
  // own "Home" link) — swap "Get Started" for their avatar rather than
  // sending them through the sign-in form again. Client-side check (not a
  // server-fetched prop) since Navigation is rendered directly by each
  // marketing page, not a shared server layout.
  //
  // getSession() (not getUser()) deliberately — getUser() always makes a
  // network round trip to the Auth server to revalidate, which is what
  // made the avatar visibly slow to appear; getSession() reads the
  // already-persisted session from local storage first and is effectively
  // instant for an existing session. Nothing here is security-sensitive
  // (it only decides which UI to show — RLS still gates the profile read,
  // and the dashboard itself re-verifies on its own), so the weaker
  // unrevalidated check is the right tradeoff.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // Anonymous visitors (nearly all marketing traffic) have no Supabase
      // auth cookie — skip the whole client (~65 KB gzipped) for them. It is
      // also a dynamic import, so for everyone else it loads after the page
      // is interactive instead of blocking it.
      if (!document.cookie.includes("-auth-token")) return;
      const { createClient } = await import("@waytara/supabase/client");
      if (cancelled) return;
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;
      // Independent of each other — one round trip instead of two. The
      // plan lookup mirrors @/lib/customer-plan's server-side query
      // (customers -> plans), just via the browser client since this
      // component has no server layout to fetch it for it.
      const [{ data: profile }, { data: customer }] = await Promise.all([
        supabase.from("profiles").select("full_name, email, avatar_url, role").eq("id", session.user.id).maybeSingle(),
        supabase.from("customers").select("plan:plans(name)").eq("id", session.user.id).maybeSingle(),
      ]);
      if (!cancelled && profile) {
        setAccount({
          fullName: profile.full_name,
          email: profile.email,
          avatarUrl: profile.avatar_url,
          planName: customer?.plan?.name ?? null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    // On the home page the bar stays transparent (white links) while the sky is behind it. The hero's layer with the content (data-hero-overlay)
    // rises over the sky as the page scrolls; once its fade has passed the bar, the sky is gone from behind it and the bar turns solid, and stays
    // solid from then on. (The card touching the bar always counts too.) On any page without that layer the bar turns solid after a short scroll.
    const REACH = 24;
    const update = () => {
      const overlay = document.querySelector<HTMLElement>("[data-hero-overlay]");
      const card = document.querySelector("[data-hero-card]");
      const barBottom = headerRef.current?.getBoundingClientRect().bottom ?? 64;
      if (!overlay && !card) {
        setIsScrolled(window.scrollY > 20);
        return;
      }
      const solidAt = Number(overlay?.dataset.solidAt ?? window.innerHeight * 0.2);
      const skyCovered = overlay ? overlay.getBoundingClientRect().top + solidAt <= barBottom : false;
      const cardTouches = card ? card.getBoundingClientRect().top <= barBottom + REACH : false;
      setIsScrolled(skyCovered || cardTouches);
    };
    // The card is moved by the hero in an animation frame of its own, so look after that has happened.
    let frame = 0;
    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => requestAnimationFrame(update));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    // The hero sends this each time it has moved the card (it glides after the scroll, so it can still be moving after scrolling has stopped).
    window.addEventListener("hero-card-moved", update);
    update();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("hero-card-moved", update);
      cancelAnimationFrame(frame);
    };
  }, []);

  const shownMenuConfig = HEADER_MENUS.find((m) => m.label === shownMenu);
  const shownPanel = shownMenu === "search" ? { key: "search", render: (close: () => void) => <SearchPanel onNavigate={close} /> } : shownMenuConfig ? menuPanel(shownMenuConfig) : null;
  const isThemeStyled = !isHome || isScrolled || activeMenu !== null;

  // One look for every text link and icon in the bar: white over the hero, theme colours once the bar is solid.
  const linkClass = cn(
    "px-[clamp(0.5rem,0.85vw,1rem)] py-1.5 rounded-lg text-[clamp(12px,0.88vw,13.5px)] font-semibold transition-all duration-200 cursor-pointer select-none",
    isThemeStyled
      ? "text-theme-primary hover:text-theme-highlight hover:bg-theme-surface"
      : "text-white hover:text-white hover:bg-white/15 drop-shadow-sm"
  );
  const iconLinkClass = cn(
    "p-2 rounded-lg transition-all duration-200 flex items-center justify-center",
    isThemeStyled
      ? "text-theme-primary hover:text-theme-highlight hover:bg-theme-surface"
      : "text-white hover:text-white hover:bg-white/15 drop-shadow-sm"
  );

  return (
    <>
    <header
      ref={headerRef}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200 ease-out h-[clamp(3.5rem,4.5vw,4.25rem)] flex items-center select-none border-0",
        // While a menu is open the bar and the panel are one surface: same solid colour, no seam (otherwise the bar's tint shows the page through it).
        activeMenu !== null
          ? "bg-theme-bg text-theme-primary"
          : isThemeStyled
            ? "bg-theme-bg/95 text-theme-primary shadow-md backdrop-blur-md"
            : "bg-transparent text-white"
      )}
      onMouseLeave={scheduleClose}
      onMouseEnter={() => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveMenu(null);
      }}
    >
      <div className="fluid-container flex items-center justify-between h-full">
        
        {/* 1. Left: Minimal Fluid Logo */}
        <div className="flex items-center">
          <Logo variant={!isThemeStyled ? "white" : "default"} />
        </div>

        {/* 2. Center: Clean Direct Navigation Links (Fluid Sizing with Smooth In-Page Anchor Scrolling) */}
        <nav aria-label="Main" className="hidden lg:flex items-center space-x-[clamp(0.25rem,0.6vw,0.75rem)]">
          {HEADER_MENUS.map((menu) => (
            <Link
              key={menu.label}
              href={menu.href}
              aria-expanded={activeMenu === menu.label}
              aria-haspopup="true"
              onMouseEnter={() => openMenu(menu.label)}
              onFocus={() => openMenu(menu.label)}
              onClick={() => setActiveMenu(null)}
              className={cn(linkClass, activeMenu === menu.label && "text-theme-highlight")}
            >
              {menu.label}
            </Link>
          ))}
        </nav>

        {/* 3. Right: search, theme toggle and Login. Contact is reached from the menus, the planner and the footer. */}
        <div className="hidden sm:flex items-center space-x-[clamp(0.2rem,0.5vw,0.6rem)]">
          {/* Search: opens the same panel as the menus */}
          <button
            type="button"
            aria-label="Search"
            aria-expanded={activeMenu === "search"}
            onClick={() => (activeMenu === "search" ? setActiveMenu(null) : openMenu("search"))}
            className={cn(iconLinkClass, activeMenu === "search" && "text-theme-highlight")}
          >
            <Search className="h-[clamp(17px,1.15vw,19.5px)] w-[clamp(17px,1.15vw,19.5px)]" />
          </button>

          {/* Theme Toggle Icon */}
          <ThemeToggle
            className={cn(
              "p-2 rounded-lg transition-all duration-200 flex items-center justify-center",
              isThemeStyled
                ? "text-theme-primary hover:text-theme-highlight hover:bg-theme-surface"
                : "text-white hover:bg-white/15 drop-shadow-sm"
            )}
            iconClassName={isThemeStyled ? "text-theme-primary" : "text-white"}
          />

          {/* Login button on every page — or, signed in, the account avatar */}
          {account ? (
            <Link
              href="/dashboard"
              aria-label="Go to your dashboard"
              className="ml-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Avatar className="h-8 w-8 border-0">
                {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.fullName ?? "Account"} />}
                <AvatarFallback className="text-xs">{initials(account.fullName, account.email)}</AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Button
              asChild
              size="sm"
              variant={!isThemeStyled ? "secondary" : "gradient"}
              className={cn(
                "h-8 sm:h-8.5 px-3.5 sm:px-4 text-xs sm:text-[13px] font-semibold rounded-lg transition-all duration-200 ml-1.5 shadow-sm",
                !isThemeStyled
                  ? "bg-white text-slate-950 hover:bg-slate-100 border-0 shadow-md font-bold"
                  : ""
              )}
            >
              <Link href={LOGIN_LINK.href}>{LOGIN_LINK.label}</Link>
            </Button>
          )}
        </div>

        {/* Mobile Hamburger Drawer */}
        <div className="flex lg:hidden items-center gap-1">
          <ThemeToggle
            className={cn(
              "p-2 rounded-lg",
              !isThemeStyled ? "text-white" : "text-theme-primary"
            )}
            iconClassName={!isThemeStyled ? "text-white" : "text-theme-primary"}
          />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-lg p-0",
                  !isThemeStyled ? "text-white hover:bg-white/10" : "text-theme-primary"
                )}
                aria-label="Toggle Mobile Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-6 flex flex-col justify-between">
              <div>
                <SheetHeader className="text-left pb-4 border-b border-theme-border">
                  <SheetTitle>
                    <Logo />
                  </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col gap-1 mt-6">
                  {/* Solutions and the page items fold open to their sections */}
                  {[
                    { label: SOLUTIONS_HUB.label, links: [{ label: "All solutions", href: SOLUTIONS_HUB.href }, ...SOLUTION_SEGMENTS, ...SOLUTION_NEEDS] },
                    ...PAGE_MENUS.map((m) => ({ label: m.label, links: [{ label: `${m.label} page`, href: m.href }, ...m.items] })),
                  ].map((group) => (
                    <React.Fragment key={group.label}>
                      <button
                        type="button"
                        aria-expanded={mobileOpen === group.label}
                        onClick={() => setMobileOpen((v) => (v === group.label ? null : group.label))}
                        className={MOBILE_LINK_CLASS}
                      >
                        <span>{group.label}</span>
                        <ChevronDown className={cn("h-4 w-4 opacity-40 transition-transform duration-200", mobileOpen === group.label && "rotate-180")} />
                      </button>
                      {mobileOpen === group.label && (
                        <div className="mb-1 ml-2 flex flex-col gap-0.5 border-l border-theme-border pl-3">
                          {group.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="rounded-lg px-2 py-2 text-[13px] font-medium text-theme-secondary transition-colors hover:bg-theme-surface hover:text-theme-primary"
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-theme-border">
                {/* Same account-aware logic as the desktop header's
                    Login button / avatar (see the "Right: Knowledge,
                    Contact, Theme Toggle" block above) — signed-in customers
                    get their account summary instead of a sign-in prompt. */}
                {account ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl p-2 -mx-2 hover:bg-theme-surface transition-colors"
                    aria-label="Go to your dashboard"
                  >
                    <Avatar className="h-11 w-11 border-0 shrink-0">
                      {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.fullName ?? "Account"} />}
                      <AvatarFallback className="text-sm">{initials(account.fullName, account.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-theme-primary truncate">
                        {account.fullName || "My Account"}
                      </p>
                      {account.planName && (
                        <p className="text-xs font-semibold text-theme-highlight truncate">
                          {account.planName} Plan
                        </p>
                      )}
                      <p className="text-xs text-theme-muted truncate">{account.email}</p>
                    </div>
                  </Link>
                ) : (
                  <Button asChild variant="gradient" className="w-full justify-center text-xs h-10">
                    <Link href={LOGIN_LINK.href} onClick={() => setMobileMenuOpen(false)}>
                      {LOGIN_LINK.label}
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div>

      {/* The one full-width panel (its content swaps as the pointer moves along the bar) and, outside the header, the dimmed page behind it. */}
      <MegaMenuShell menu={shownPanel} open={activeMenu !== null} onNavigate={() => setActiveMenu(null)} />
    </header>
    <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 top-[clamp(3.5rem,4.5vw,4.25rem)] hidden z-40 bg-black/25 backdrop-blur-md transition-opacity duration-[250ms] ease-out lg:block",
          activeMenu ? "opacity-100" : "opacity-0"
        )}
      />
    </>
  );
}
