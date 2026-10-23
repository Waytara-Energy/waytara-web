"use client";

import Link from "next/link";
import { BadgeCheck, CalendarDays, Cpu, LifeBuoy, LogOut, MapPin, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/dashboard/actions";
import { ProgressRing } from "./progress-ring";
import { useSettingsNav } from "./settings-nav";

export interface HeroProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  /** how complete the profile is, 0 to 100 (the ring around the picture) */
  completeness: number;
  planName: string | null;
  memberSince: string | null;
  sites: number;
  devices: number;
}

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase() : (email[0] ?? "?").toUpperCase();
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

function Chip({ icon: Icon, children }: { icon: typeof Cpu; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

/** The top of Application Settings: who this is, how complete the profile is (the ring), the plan, since when, how many sites and devices, and the
 *  two things people look for first: support and signing out. It stays above the tabs, so the page always says whose settings these are. */
export function SettingsHero({ name, email, avatarUrl, completeness, planName, memberSince, sites, devices }: HeroProps) {
  const { go } = useSettingsNav();
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-500/10 via-card to-sky-500/10 p-5 shadow-sm sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
        <button type="button" onClick={() => go("profile")} className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open your profile">
          <ProgressRing percent={completeness} size={88} stroke={5}>
            <Avatar className="size-[72px] border-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback className="bg-primary/15 text-xl font-semibold text-primary">{initials(name, email)}</AvatarFallback>
            </Avatar>
          </ProgressRing>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground shadow-sm">{completeness}%</span>
        </button>

        <div className="min-w-0 flex-1 basis-64">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{name || email.split("@")[0]}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="truncate">{email}</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="size-4" />
              Verified
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {planName && (
              <Chip icon={Sparkles}>
                {planName}
              </Chip>
            )}
            {memberSince && <Chip icon={CalendarDays}>Member since {monthYear(memberSince)}</Chip>}
            <Chip icon={MapPin}>
              {sites} {sites === 1 ? "site" : "sites"}
            </Chip>
            <Chip icon={Cpu}>
              {devices} {devices === 1 ? "device" : "devices"}
            </Chip>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="bg-background/70 backdrop-blur">
            <Link href="/dashboard/support">
              <LifeBuoy className="size-3.5" />
              Get support
            </Link>
          </Button>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm" className="bg-background/70 backdrop-blur">
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
