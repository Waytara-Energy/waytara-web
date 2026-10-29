"use client";

import * as React from "react";
import { ChevronsUpDown, Loader2, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { logout } from "@/app/(dashboard)/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface AdminAccount {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", employee: "Employee", site_engineer: "Site engineer" };

function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** The foot of the sidebar: the account (picture, name, role) opening a small menu with the theme and Sign out. */
export function AdminUserMenu({ account }: { account: AdminAccount }) {
  const { theme, setTheme } = useTheme();
  const [loggingOut, startLogout] = React.useTransition();
  const name = account.fullName ?? account.email ?? "Your account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:p-0">
          <Avatar className="size-8 shrink-0 border-0">
            {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt={name} /> : null}
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(account.fullName, account.email)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-medium leading-tight text-sidebar-foreground">{name}</span>
            <span className="block truncate text-xs leading-tight text-sidebar-foreground/60">{ROLE_LABEL[account.role ?? ""] ?? account.role ?? "Staff"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{name}</span>
          {account.email ? <span className="block truncate text-xs text-muted-foreground">{account.email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn("flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring", theme === value ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground")}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={loggingOut}
          onSelect={(e) => {
            e.preventDefault();
            startLogout(() => {
              void logout();
            });
          }}
        >
          {loggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
          {loggingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
