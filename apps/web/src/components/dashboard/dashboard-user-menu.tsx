"use client";

import Link from "next/link";
import { Home, LogOut, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/dashboard/actions";
import { SECONDARY_NAV_ITEMS } from "./nav-config";

function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

// Avatar ring by plan tier — basic gets a plain neutral border, pro a
// green gradient, advance a multi-color ring (the "Google One" look this
// was asked to match: a colorful ring signaling the top tier at a glance,
// not just another shade of the brand green). Same gradient reused for the
// small dot next to the plan name in the dropdown label, so the tier reads
// consistently in both places.
const PLAN_RING_CLASS: Record<string, string> = {
  pro: "bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600",
  advance:
    "bg-[conic-gradient(from_180deg_at_50%_50%,_#6366f1,_#ec4899,_#f59e0b,_#22c55e,_#0ea5e9,_#6366f1)]",
};

export function DashboardUserMenu({
  fullName,
  email,
  avatarUrl,
  planName,
  planCode,
}: {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName?: string | null;
  planCode?: string | null;
}) {
  const ringClass = (planCode && PLAN_RING_CLASS[planCode]) || "bg-border";
  const dotClass = (planCode && PLAN_RING_CLASS[planCode]) || "bg-muted-foreground/50";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full p-[2px]", ringClass)}>
          <Avatar className="h-full w-full ring-2 ring-background">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Account"} />}
            <AvatarFallback className="text-xs">{initials(fullName, email)}</AvatarFallback>
          </Avatar>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{fullName ?? "Your account"}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          {planName && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
              {planName} Plan
            </p>
          )}
        </DropdownMenuLabel>
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
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
