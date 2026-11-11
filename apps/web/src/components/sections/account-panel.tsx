"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from "@/components/dashboard/nav-config";
import { LOGIN_LINK } from "@/config/site-nav";
import { isMonitoredCategory } from "@/lib/equipment-children";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------------------------------------------------------------------------
   The signed-in side of the header: the account slot (avatar, loader or Login), the data behind the avatar's panel (the customer's devices and
   their connection status), and the panel itself, used by the desktop header (on hover) and by the phone's full-screen menu.
   ------------------------------------------------------------------------------------------------------------------------------------------ */

export interface Account {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  planName: string | null;
}

/** "pending": not known yet (the account slot then shows Login or a loader, decided by the first-paint script); "anon": checked, not signed in; "in": signed in. */
export type AuthState = "pending" | "anon" | "in";

export function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

type BrowserClient = ReturnType<(typeof import("@waytara/supabase/client"))["createClient"]>;
let clientPromise: Promise<BrowserClient> | null = null;
/** The browser's database client, made once and only when it is first needed (about 65 KB gzipped: anonymous visitors never load it). */
export function getBrowserClient(): Promise<BrowserClient> {
  clientPromise ??= import("@waytara/supabase/client").then((m) => m.createClient());
  return clientPromise;
}

/* ---- the account slot ----------------------------------------------------------------------------------------------------------------- */

/**
 * What sits at the right of the header: the avatar when signed in, the Login button when not, and a loader while it is not known yet.
 * Which of the last two shows before the page's scripts have run is decided by CSS from a tiny script in the page's first paint (see globals.css
 * and the root layout), so a signed-in visitor never sees "Login" flash up and an anonymous one never sees a loader.
 */
export function AuthSlot({
  state,
  account,
  solid,
  compact = false,
  onNavigate,
  onAvatarEnter,
  avatarSize = "h-8 w-8",
}: {
  state: AuthState;
  account: Account | null;
  /** The bar is on the page colour (not the transparent one over the sky). */
  solid: boolean;
  compact?: boolean;
  onNavigate?: () => void;
  /** Called when the avatar is hovered or focused (the desktop header opens its panel then). */
  onAvatarEnter?: () => void;
  avatarSize?: string;
}) {
  return (
    <span data-auth-slot="" data-state={state} className="inline-flex items-center">
      {state === "in" && account && (
        <Link
          href="/dashboard"
          aria-label="Go to your dashboard"
          aria-haspopup={onAvatarEnter ? "true" : undefined}
          onMouseEnter={onAvatarEnter}
          onFocus={onAvatarEnter}
          onClick={onNavigate}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Avatar className={cn(avatarSize, "rounded-lg border-0")}>
            {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.fullName ?? "Account"} />}
            <AvatarFallback className="rounded-lg text-xs">{initials(account.fullName, account.email)}</AvatarFallback>
          </Avatar>
        </Link>
      )}

      <span className="auth-login inline-flex">
        <Button
          asChild
          size="sm"
          variant={solid ? "gradient" : "secondary"}
          className={cn(
            "rounded-lg font-semibold shadow-sm transition-all duration-200",
            compact ? "h-[32px] px-3 text-xs" : "h-8 px-3.5 text-xs sm:h-8.5 sm:px-4 sm:text-[13px]",
            !solid && "border-0 bg-white font-bold text-slate-950 shadow-md hover:bg-slate-100"
          )}
        >
          <Link href={LOGIN_LINK.href} onClick={onNavigate}>
            {LOGIN_LINK.label}
          </Link>
        </Button>
      </span>

      <span
        role="status"
        aria-label="Checking whether you are signed in"
        className={cn("auth-loader items-center justify-center rounded-lg border border-current/25 bg-current/5", avatarSize)}
      >
        <Spinner className="size-4 opacity-80" />
      </span>
    </span>
  );
}

/* ---- the customer's devices and their status ------------------------------------------------------------------------------------------ */

export type DeviceStatus = "online" | "unreachable" | "offline" | "waiting" | "unknown";

export interface FleetDevice {
  id: string;
  name: string;
  /** The kind and model, in short. */
  detail: string | null;
  status: DeviceStatus;
}
export interface FleetSite {
  id: string;
  name: string;
  devices: FleetDevice[];
}
export type Fleet = { state: "idle" } | { state: "loading" } | { state: "error" } | { state: "ready"; sites: FleetSite[] };

const STATUS_TEXT: Record<DeviceStatus, string> = {
  online: "Online",
  unreachable: "Not responding",
  offline: "Offline",
  waiting: "Not connected yet",
  unknown: "Status unknown",
};
const STATUS_DOT: Record<DeviceStatus, string> = {
  online: "bg-emerald-500",
  unreachable: "bg-amber-500",
  offline: "bg-red-500",
  waiting: "bg-slate-400",
  unknown: "bg-slate-400",
};

function categoryLabel(category: string | null | undefined): string | null {
  if (category === "ev_charger") return "EV charger";
  if (category === "solar_inverter") return "Solar inverter";
  return null;
}

/**
 * The signed-in customer's sites and devices with each device's connection status, read once, the first time `wanted` is true (when the avatar is
 * hovered or the phone's menu is opened), through the same row-level security as the dashboard: a customer only ever sees their own.
 * Until it has been asked for, the state is "idle" (the panel then shows its loading state).
 */
export function useFleet(wanted: boolean): Fleet {
  const [fleet, setFleet] = React.useState<Fleet>({ state: "idle" });
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!wanted || started.current) return;
    started.current = true;
    (async () => {
      try {
        const sb = await getBrowserClient();
        const { data, error } = await sb
          .from("sites")
          .select("id, name, equipment(id, label, parent_id, created_at, device_type:equipment_inventory(category, name, model))")
          .is("customer_hidden_at", null)
          .order("created_at", { ascending: true });
        if (error) throw error;

        const sites = (data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          devices: (s.equipment ?? [])
            .filter((d) => d.parent_id === null && (!d.device_type || isMonitoredCategory(d.device_type.category)))
            .slice()
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
        }));
        const ids = sites.flatMap((s) => s.devices.map((d) => d.id));
        const { loadHeartbeats } = await import("@/lib/telemetry/loaders");
        const beats = ids.length > 0 ? await loadHeartbeats(sb as Parameters<typeof loadHeartbeats>[0], ids) : new Map();

        const toStatus = (id: string): DeviceStatus => {
          const verdict = beats.get(id)?.verdict;
          if (!verdict) return "unknown";
          if (verdict.status === "online") return "online";
          if (verdict.status === "device_unreachable") return "unreachable";
          if (verdict.status === "offline") return "offline";
          return "waiting";
        };
        setFleet({
          state: "ready",
          sites: sites.map((s) => ({
            id: s.id,
            name: s.name,
            devices: s.devices.map((d) => ({
              id: d.id,
              name: d.label || d.device_type?.name || "Device",
              detail: [categoryLabel(d.device_type?.category), d.device_type?.model].filter(Boolean).join(" · ") || null,
              status: toStatus(d.id),
            })),
          })),
        });
      } catch {
        setFleet({ state: "error" });
      }
    })();
  }, [wanted]);

  return fleet;
}

/* ---- the pieces of the panel ---------------------------------------------------------------------------------------------------------- */

function DeviceList({ fleet, onNavigate }: { fleet: Fleet; onNavigate: () => void }) {
  if (fleet.state === "idle" || fleet.state === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-theme-secondary" role="status">
        <Spinner className="size-4" /> Loading your devices…
      </p>
    );
  }
  if (fleet.state === "error") {
    return <p className="text-sm text-theme-secondary">Your devices could not be loaded just now. They are all in your dashboard.</p>;
  }
  const withDevices = fleet.sites.filter((s) => s.devices.length > 0);
  if (withDevices.length === 0) return <p className="text-sm text-theme-secondary">No devices are connected to your account yet.</p>;
  const showSite = withDevices.length > 1;
  return (
    <div className="space-y-4">
      {withDevices.map((site) => (
        <div key={site.id}>
          {showSite && <p className="mb-1.5 text-xs text-theme-muted">{site.name}</p>}
          <ul className="space-y-1">
            {site.devices.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard/devices?device=${d.id}`}
                  onClick={onNavigate}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-theme-surface focus-visible:bg-theme-surface"
                >
                  <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", STATUS_DOT[d.status])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-theme-primary group-hover:text-theme-highlight">{d.name}</span>
                    {d.detail && <span className="block truncate text-xs text-theme-muted">{d.detail}</span>}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-theme-secondary">{STATUS_TEXT[d.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const QUICK_LINKS = [...NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

function QuickLinks({ onNavigate }: { onNavigate: () => void }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
      {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-[13px] font-semibold text-theme-primary outline-none transition-colors hover:text-theme-highlight focus-visible:text-theme-highlight"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0 text-theme-secondary" />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SignOutButton({ className }: { className?: string }) {
  // logout() ends the session and redirects to the sign-in page, so this only shows "busy" until the page leaves. The action is loaded when it is
  // clicked, not with the page: nobody who is not signing out needs it, and it keeps server-only code out of everything that imports the header.
  const [busy, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        startTransition(async () => {
          const { logout } = await import("@/app/dashboard/actions");
          await logout();
        })
      }
      className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-[13px] font-semibold text-red-500 outline-none transition-colors hover:text-red-600 focus-visible:text-red-600 disabled:opacity-60", className)}
    >
      {busy ? <Spinner className="size-4" /> : <LogOut aria-hidden="true" className="size-4" />}
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** The desktop panel under the header when the avatar is hovered: the devices with their status at the left, the account, the dashboard's pages and Sign out at the right. */
export function AccountPanel({ fleet, onNavigate }: { account: Account; fleet: Fleet; onNavigate: () => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-10 pt-8 sm:px-10">
      <div className="grid grid-cols-1 gap-x-16 gap-y-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <p className="mega-item text-xs text-theme-muted">Your devices</p>
          <div className="mega-item mt-3" style={{ animationDelay: "50ms" }}>
            <DeviceList fleet={fleet} onNavigate={onNavigate} />
          </div>
        </div>

        <div>
          <p className="mega-item text-xs text-theme-muted" style={{ animationDelay: "40ms" }}>Your dashboard</p>
          <div className="mega-item mt-3" style={{ animationDelay: "70ms" }}>
            <QuickLinks onNavigate={onNavigate} />
          </div>
          <div className="mega-item mt-4 border-t border-theme-border pt-3" style={{ animationDelay: "100ms" }}>
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The foot of the phone's menu, kept to two quiet rows: Dashboard (with a line saying how many devices are online) and Sign out. */
export function AccountSection({ fleet, onNavigate }: { fleet: Fleet; onNavigate: () => void }) {
  let summary: string | null = null;
  if (fleet.state === "ready") {
    const devices = fleet.sites.flatMap((s) => s.devices);
    summary = devices.length === 0 ? "No devices yet" : `${devices.filter((d) => d.status === "online").length} of ${devices.length} ${devices.length === 1 ? "device" : "devices"} online`;
  }
  return (
    <ul>
      <li className="border-b border-theme-border/60">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center justify-between py-4 outline-none focus-visible:text-theme-highlight">
          <span>
            <span className="block text-[17px] font-semibold leading-tight text-theme-primary">Dashboard</span>
            <span className="mt-0.5 block text-sm text-theme-muted">{summary ?? "Loading your devices…"}</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 text-theme-muted" />
        </Link>
      </li>
      <li>
        <SignOutButton className="py-4 text-[17px]" />
      </li>
    </ul>
  );
}
