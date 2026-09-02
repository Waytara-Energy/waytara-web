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
        {/* The ring is this span's own background showing through its
            padding gap — not a box-shadow `ring-*` on the Avatar itself,
            which would paint right over that gap and hide it (confirmed
            live: that's exactly what made the ring invisible before).
            `border-0` also strips Avatar's own default border, which would
            otherwise draw a second, dimmer ring just inside this one. */}
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full p-[3px]", ringClass)}>
          <Avatar className="h-full w-full border-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Account"} />}
            <AvatarFallback className="text-xs">{initials(fullName, email)}</AvatarFallback>
          </Avatar>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
            <span className="truncate">{fullName ?? "Your account"}</span>
            {planName && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground">
                <span aria-hidden>·</span>
                <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
                {planName}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
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
