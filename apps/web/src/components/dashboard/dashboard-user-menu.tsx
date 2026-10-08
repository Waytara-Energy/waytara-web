"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronsUpDown, Home, LogOut, Monitor, MessageSquare, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Spinner } from "@/components/ui/spinner";
import { logout } from "@/app/dashboard/actions";
import { SECONDARY_NAV_ITEMS } from "./nav-config";
import { useHasMounted } from "@/hooks/use-has-mounted";

const APPEARANCE_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export function DashboardUserMenu({
  fullName,
  email,
  avatarUrl,
  planName,
  variant = "avatar",
}: {
  /** "avatar": just the round avatar (a header). "sidebar": avatar, name and plan in a row that opens upward. */
  variant?: "avatar" | "sidebar";
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName?: string | null;
}) {
  const { theme, setTheme } = useTheme();
  // Same hydration-safety gate the old standalone ThemeToggle used —
  // `theme` is unknown on the server (next-themes reads localStorage/
  // matchMedia client-side only), so the toggle defaults to "system"
  // (this app's own defaultTheme) until mounted rather than briefly
  // showing the wrong option selected.
  const mounted = useHasMounted();

  // logout() redirects on completion, so the menu unmounts on its own —
  // this pending state is just so "Sign out" doesn't look unresponsive
  // for however long that takes. preventDefault keeps Radix from closing
  // the menu the instant the item is selected, so the spinner is actually
  // visible rather than flashing behind the closing animation.
  const [loggingOut, startLogoutTransition] = React.useTransition();
  function handleLogout(event: Event) {
    event.preventDefault();
    startLogoutTransition(() => {
      void logout();
    });
  }

  return (
    <DropdownMenu>
      {variant === "sidebar" ? (
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent">
          <Avatar className="h-8 w-8 shrink-0 border-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Account"} />}
            <AvatarFallback className="text-xs">{initials(fullName, email)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium leading-tight text-sidebar-foreground">{fullName ?? "Your account"}</span>
            <span className="block truncate text-xs leading-tight text-sidebar-foreground/60">{planName ?? email}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/60" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-8 w-8 border-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Account"} />}
            <AvatarFallback className="text-xs">{initials(fullName, email)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"} className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
            <span className="truncate">{fullName ?? "Your account"}</span>
            {planName && <span className="shrink-0 text-xs font-normal text-muted-foreground">· {planName}</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-sm text-foreground">Appearance</span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={mounted ? (theme ?? "system") : "system"}
            onValueChange={(value) => value && setTheme(value)}
          >
            {APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value} aria-label={label} title={label} className="px-2">
                <Icon className="size-3.5" />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <DropdownMenuSeparator />
        {SECONDARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/">
            <Home />
            Home
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/contact">
            <MessageSquare />
            Feedback
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={loggingOut} onSelect={handleLogout}>
          {loggingOut ? <Spinner /> : <LogOut />}
          {loggingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
