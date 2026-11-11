"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HEADER_MENUS } from "@/config/site-nav";
import { MegaMenuShell, menuPanel } from "@/components/sections/mega-menu";
import { SearchPanel } from "@/components/sections/search-panel";
import { AccountPanel, AuthSlot, getBrowserClient, useFleet, type Account, type AuthState } from "@/components/sections/account-panel";
import { MobileMenu } from "@/components/sections/mobile-menu";

export function Navigation() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
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

  // The phone's menu closes on its own if the window becomes wide enough for the desktop header.
  React.useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const onChange = () => wide.matches && setMobileMenuOpen(false);
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  const [account, setAccount] = React.useState<Account | null>(null);
  // "pending" until it is known; for a visitor with no sign-in cookie it just stays "pending" (they are anonymous, and the account slot shows Login
  // for that case without needing anything to change: see globals.css).
  const [authState, setAuthState] = React.useState<AuthState>("pending");

  const isHome = pathname === "/";

  // Signed-in customer browsing the public site (e.g. via the dashboard's own "Home" link) — swap "Login" for their avatar rather than sending them
  // through the sign-in form again. Client-side check (not a server-fetched prop) since Navigation is rendered directly by each marketing page, not a
  // shared server layout.
  //
  // getSession() (not getUser()) deliberately — getUser() always makes a network round trip to the Auth server to revalidate, which is what made the
  // avatar visibly slow to appear; getSession() reads the already-persisted session from local storage first and is effectively instant for an
  // existing session. Nothing here is security-sensitive (it only decides which UI to show — RLS still gates the profile read, and the dashboard itself
  // re-verifies on its own), so the weaker unrevalidated check is the right tradeoff.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // Anonymous visitors (nearly all marketing traffic) have no Supabase auth cookie — skip the whole client (~65 KB gzipped) for them. It is also
      // loaded on demand, so for everyone else it arrives after the page is interactive instead of blocking it.
      if (!document.cookie.includes("-auth-token")) return;
      const supabase = await getBrowserClient();
      if (cancelled) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setAuthState("anon");
        return;
      }
      // Independent of each other — one round trip instead of two. The plan lookup mirrors @/lib/customer-plan's server-side query (customers ->
      // plans), just via the browser client since this component has no server layout to fetch it for it.
      const [{ data: profile }, { data: customer }] = await Promise.all([
        supabase.from("profiles").select("full_name, email, avatar_url, role").eq("id", session.user.id).maybeSingle(),
        supabase.from("customers").select("plan:plans(name)").eq("id", session.user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (profile) {
        setAccount({
          fullName: profile.full_name,
          email: profile.email,
          avatarUrl: profile.avatar_url,
          planName: customer?.plan?.name ?? null,
        });
        setAuthState("in");
      } else {
        setAuthState("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The customer's devices and their status are read the first time the avatar's panel (or the phone's menu) is opened.
  const fleet = useFleet(authState === "in" && (activeMenu === "account" || mobileMenuOpen));

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobileMenu = React.useCallback(() => setMobileMenuOpen(false), []);

  const shownMenuConfig = HEADER_MENUS.find((m) => m.label === shownMenu);
  const shownPanel =
    shownMenu === "search"
      ? { key: "search", render: (close: () => void) => <SearchPanel onNavigate={close} /> }
      : shownMenu === "account" && account
        ? { key: "account", render: (close: () => void) => <AccountPanel account={account} fleet={fleet} onNavigate={close} /> }
        : shownMenuConfig
          ? menuPanel(shownMenuConfig)
          : null;
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

        {/* 3. Right (wide screens): search, theme toggle and the account slot. Contact is reached from the menus, the planner and the footer. */}
        <div className="hidden lg:flex items-center space-x-[clamp(0.2rem,0.5vw,0.6rem)]">
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

          {/* Login button on every page — or, signed in, the account avatar (hover it for the devices and the dashboard's pages), or a loader while
              it is not known yet */}
          <div className="ml-1.5">
            <AuthSlot
              state={authState}
              account={account}
              solid={isThemeStyled}
              onNavigate={() => setActiveMenu(null)}
              onAvatarEnter={() => openMenu("account")}
            />
          </div>
        </div>

        {/* 3. Right (phones and tablets): theme toggle, the account slot (avatar, Login or a loader) and the menu button. */}
        <div className="flex lg:hidden items-center gap-1.5">
          <ThemeToggle
            className={cn("p-2 rounded-lg", !isThemeStyled ? "text-white" : "text-theme-primary")}
            iconClassName={!isThemeStyled ? "text-white" : "text-theme-primary"}
          />
          <span className={cn(!isThemeStyled ? "text-white" : "text-theme-primary")}>
            <AuthSlot state={authState} account={account} solid={isThemeStyled} compact />
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open the menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen(true)}
            className={cn("h-9 w-9 rounded-lg p-0", !isThemeStyled ? "text-white hover:bg-white/10" : "text-theme-primary")}
          >
            <Menu className="h-5 w-5" />
          </Button>
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

    {/* Outside the header on purpose (see MobileMenu). */}
    <MobileMenu open={mobileMenuOpen} onClose={closeMobileMenu} authState={authState} account={account} fleet={fleet} />
    </>
  );
}
