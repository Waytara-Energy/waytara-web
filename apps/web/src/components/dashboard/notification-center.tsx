"use client";

import * as React from "react";
import { AlertTriangle, Bell, Check } from "lucide-react";
import { useRealtimeTable, type RealtimeRowEvent } from "@waytara/ui/realtime-provider";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { acknowledgeAlert } from "@/app/dashboard/actions";
import type { AlertRow } from "./recent-alerts";

type Filter = "all" | "unread" | "critical" | "warning";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
];

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Header notification bell — every alert across every one of the
 *  customer's devices (not scoped to whichever site happens to be
 *  selected, since the header is mounted once in the layout, outside any
 *  one site's page), with a filter row and a per-item "mark as read"
 *  action. Replaces Overview's old "Recent Alerts" card: one place for
 *  this across every dashboard page instead of a card that only ever
 *  showed up on one of them. Realtime rollout matches that old card's own
 *  — seeded from the server's initial query, then kept live by an
 *  `alerts` subscription over the same device set. */
export function NotificationCenter({ deviceIds, initialAlerts }: { deviceIds: string[]; initialAlerts: AlertRow[] }) {
  const [alerts, setAlerts] = React.useState<AlertRow[]>(initialAlerts);
  const [filter, setFilter] = React.useState<Filter>("all");
  const filterStr = `device_id=in.(${deviceIds.join(",")})`;

  useRealtimeTable<AlertRow>(
    "alerts",
    "INSERT",
    filterStr,
    React.useCallback((payload: RealtimeRowEvent<AlertRow>) => {
      setAlerts((prev) => (prev.some((a) => a.id === payload.new.id) ? prev : [payload.new, ...prev].slice(0, 30)));
    }, [])
  );

  useRealtimeTable<AlertRow>(
    "alerts",
    "UPDATE",
    filterStr,
    React.useCallback((payload: RealtimeRowEvent<AlertRow>) => {
      setAlerts((prev) => prev.map((a) => (a.id === payload.new.id ? payload.new : a)));
    }, [])
  );

  const unreadCount = alerts.reduce((n, a) => n + (a.acknowledged_at ? 0 : 1), 0);
  const filtered = alerts.filter((a) => {
    if (filter === "unread") return !a.acknowledged_at;
    if (filter === "critical") return a.severity === "critical";
    if (filter === "warning") return a.severity === "warning";
    return true;
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative h-8 w-8 shrink-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="h-7 gap-0.5 bg-muted/50 p-0.5">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="h-6 rounded-md px-2 text-[11px] data-[state=active]:shadow-none">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {filter === "all" ? "Nothing here yet." : "Nothing matches this filter."}
            </p>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-2.5 border-b px-3 py-2.5 last:border-0 ${a.acknowledged_at ? "opacity-60" : ""}`}
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${a.severity === "critical" ? "text-rose-500" : "text-amber-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground capitalize">{a.severity}</p>
                  <p className="text-xs text-muted-foreground">{a.message}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(a.ts)}</p>
                </div>
                {!a.acknowledged_at && (
                  <form action={acknowledgeAlert.bind(null, a.id)}>
                    <SubmitButton variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Mark as read">
                      <Check className="h-3.5 w-3.5" />
                    </SubmitButton>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
