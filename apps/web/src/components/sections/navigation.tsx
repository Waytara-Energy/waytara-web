"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  HelpCircle,
  Phone,
  ChevronRight,
  Zap,
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
import { createClient } from "@waytara/supabase/client";
import { TEMP_HIDE_LANDING_SECTIONS } from "@/config/landing-flags";

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

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/#about-us" },
  { label: "Our Services", href: "/#customer-segments" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Why WayTara", href: "/#why-integrated" },
  { label: "Our Team", href: "/#our-team" },
];

// TEMP_HIDE_LANDING_SECTIONS (src/config/landing-flags.ts) — How It Works
// is hidden along with its section; restored once the flag flips off.
const VISIBLE_NAV_LINKS = TEMP_HIDE_LANDING_SECTIONS
  ? NAV_LINKS.filter((link) => link.label !== "How It Works")
  : NAV_LINKS;

export function Navigation() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
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
      if (!cancelled && profile?.role === "customer") {
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
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (href.startsWith("/#")) {
      const targetId = href.replace("/#", "");
      if (pathname === "/") {
        e.preventDefault();
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
          window.history.pushState(null, "", `#${targetId}`);
        }
      }
    } else if (href === "/" && pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.history.pushState(null, "", "/");
    }
  };

  const isThemeStyled = !isHome || isScrolled;

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out h-[clamp(3.5rem,4.5vw,4.25rem)] flex items-center select-none border-0",
        isThemeStyled
          ? "bg-theme-bg/95 text-theme-primary shadow-md backdrop-blur-md"
          : "bg-transparent text-white"
      )}
    >
      <div className="fluid-container flex items-center justify-between h-full">
        
        {/* 1. Left: Minimal Fluid Logo */}
        <div className="flex items-center">
          <Logo variant={!isThemeStyled ? "white" : "default"} />
        </div>

        {/* 2. Center: Clean Direct Navigation Links (Fluid Sizing with Smooth In-Page Anchor Scrolling) */}
        <nav className="hidden lg:flex items-center space-x-[clamp(0.25rem,0.6vw,0.75rem)]">
          {VISIBLE_NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className={cn(
                "px-[clamp(0.5rem,0.85vw,1rem)] py-1.5 rounded-lg text-[clamp(12px,0.88vw,13.5px)] font-semibold transition-all duration-200 cursor-pointer select-none",
                isThemeStyled
                  ? "text-theme-primary hover:text-theme-highlight hover:bg-theme-surface"
                  : "text-white hover:text-white hover:bg-white/15 drop-shadow-sm"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* 3. Right: Knowledge (?), Contact (Phone), and Theme Toggle */}
        <div className="hidden sm:flex items-center space-x-[clamp(0.2rem,0.5vw,0.6rem)]">
          {/* ? Icon -> Knowledge Centre — TEMP_HIDE_LANDING_SECTIONS */}
          {!TEMP_HIDE_LANDING_SECTIONS && (
            <Link
              href="/knowledge-centre"
              className={cn(
                "p-2 rounded-lg transition-all duration-200 flex items-center justify-center",
                isThemeStyled
                  ? "text-theme-primary hover:text-theme-highlight hover:bg-theme-surface"
                  : "text-white hover:text-white hover:bg-white/15 drop-shadow-sm"
              )}
              title="Knowledge Centre & Guides"
              aria-label="Knowledge Centre"
            >
              <HelpCircle className="h-[clamp(17px,1.15vw,19.5px)] w-[clamp(17px,1.15vw,19.5px)]" />
            </Link>
          )}

          {/* Phone Icon -> Contact Us */}
          <Link
            href="/contact"
            className={cn(
              "p-2 rounded-lg transition-all duration-200 flex items-center justify-center",
              isThemeStyled
                ? "text-theme-primary hover:text-theme-highlight hover:bg-theme-surface"
                : "text-white hover:text-white hover:bg-white/15 drop-shadow-sm"
            )}
            title="Contact & Engineering Support"
            aria-label="Contact Us"
          >
            <Phone className="h-[clamp(17px,1.15vw,19.5px)] w-[clamp(17px,1.15vw,19.5px)]" />
          </Link>

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

          {/* Get Started Button — or, signed in, the account avatar */}
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
              <Link href="/login">
                <Zap
                  className={cn(
                    "h-3.5 w-3.5 mr-1 transition-colors",
                    isThemeStyled
                      ? "text-white fill-white"
                      : "text-emerald-500 fill-emerald-500"
                  )}
                />
                <span>Get Started</span>
              </Link>
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
                  {VISIBLE_NAV_LINKS.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      onClick={(e) => {
                        setMobileMenuOpen(false);
                        handleNavClick(e, link.href);
                      }}
                      className="py-2.5 px-2 text-sm font-semibold text-theme-primary hover:text-theme-highlight hover:bg-theme-surface rounded-lg flex items-center justify-between transition-colors"
                    >
                      <span>{link.label}</span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-theme-border">
                {/* Same account-aware logic as the desktop header's
                    Get Started button / avatar (see the "Right: Knowledge,
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
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Zap className="h-3.5 w-3.5 mr-1.5 fill-white" />
                      Get Started
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div>
    </header>
  );
}
