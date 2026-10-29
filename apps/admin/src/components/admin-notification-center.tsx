"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Bell, LifeBuoy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import type { AdminAlerts, AdminNotification } from "@/lib/admin-alerts";
import { cn } from "@/lib/utils";

const ICONS = { lead: UserPlus, support: LifeBuoy, alert: AlertTriangle } as const;
const TONES = {
  info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
} as const;

/** "5 min ago", "2 h ago", "3 d ago". */
function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function Row({ n, now, onGo }: { n: AdminNotification; now: number; onGo: () => void }) {
  const Icon = ICONS[n.kind];
  return (
    <li>
      <Link href={n.href} onClick={onGo} className="flex gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent focus-visible:bg-accent">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", TONES[n.tone])}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{n.title}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{n.detail}</span>
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{ago(n.at, now)}</span>
      </Link>
    </li>
  );
}

/**
 * The bell in the sidebar's header: a badge with how many things need attention (new leads, tickets with unread messages, device alerts), and a panel
 * listing the latest of them, each a link to where it is dealt with. The numbers come from the server and refresh live as rows change.
 */
export function AdminNotificationCenter({ alerts }: { alerts: AdminAlerts }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = React.useState(false);
  // the time is read once per opening, so the list does not change under the cursor
  const [now, setNow] = React.useState(0);
  const total = alerts.counts.leads + alerts.counts.support + alerts.counts.alerts;
  const critical = alerts.items.some((i) => i.tone === "critical");

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setNow(Date.now());
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={total > 0 ? `Notifications, ${total} need attention` : "Notifications"} className="relative text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <Bell className="size-[18px]" />
          {total > 0 ? (
            <span className={cn("absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold leading-4 text-white", critical ? "bg-red-500" : "bg-primary")}>{total > 99 ? "99+" : total}</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">{total > 0 ? `${total} need attention` : "All clear"}</p>
        </div>
        {alerts.items.length === 0 ? (
          <div className="grid place-items-center gap-1 px-4 py-10 text-center">
            <Bell className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Nothing needs you right now</p>
            <p className="text-xs text-muted-foreground">New leads, tickets and device alerts show up here.</p>
          </div>
        ) : (
          <ul className="max-h-[26rem] divide-y overflow-y-auto">
            {alerts.items.map((n) => (
              <Row
                key={n.id}
                n={n}
                now={now || Date.parse(n.at)}
                onGo={() => {
                  setOpen(false);
                  if (isMobile) setOpenMobile(false);
                }}
              />
            ))}
          </ul>
        )}
        <div className="grid grid-cols-3 divide-x border-t text-center text-xs">
          <Link href="/leads" onClick={() => setOpen(false)} className="px-2 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            Leads {alerts.counts.leads > 0 ? <b className="text-foreground">{alerts.counts.leads}</b> : null}
          </Link>
          <Link href="/support" onClick={() => setOpen(false)} className="px-2 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            Support {alerts.counts.support > 0 ? <b className="text-foreground">{alerts.counts.support}</b> : null}
          </Link>
          <Link href="/alerts" onClick={() => setOpen(false)} className="px-2 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            Alerts {alerts.counts.alerts > 0 ? <b className="text-foreground">{alerts.counts.alerts}</b> : null}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
