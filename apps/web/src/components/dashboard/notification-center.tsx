"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, BellOff, Check, CheckCheck, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useRealtimeTable, type RealtimeRowEvent } from "@waytara/ui/realtime-provider";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Spinner } from "@/components/ui/spinner";
import { acknowledgeAlert, acknowledgeAllAlerts } from "@/app/dashboard/actions";
import { alertTitleAndBody, applyFilter, faultItems, filterCounts, NOTIFICATION_FILTERS, unreadTotal, type NotificationFilter } from "@/lib/notification-items";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDeviceFaultCodes } from "./use-device-faults";
import type { AlertRow } from "./recent-alerts";

const TONE_ICON = { critical: "text-rose-500", warning: "text-amber-500" } as const;

/** One notification, minimal: an icon, a headline, the time, and one line of the message. Tapping it opens it out to the whole
 *  message, where it happened, and what can be done - and again to fold it back. Unread ones are bold with a dot. */
function NotificationRow({
  tone,
  icon: Icon,
  unread,
  title,
  summary,
  time,
  meta,
  open,
  onToggle,
  actions,
  children,
}: {
  tone: "critical" | "warning";
  icon: LucideIcon;
  unread: boolean;
  title: string;
  summary: string;
  time: string;
  meta: string;
  open: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card/40 transition-colors", open ? "border-border bg-card/70" : "border-transparent hover:bg-card/60", !unread && !open && "opacity-70")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="relative mt-0.5 shrink-0">
          <Icon className={cn("size-4", TONE_ICON[tone])} />
          {unread && <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-rose-500" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", unread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>{title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span>
          </span>
          <span className={cn("block text-xs text-muted-foreground", !open && "truncate")}>{summary}</span>
        </span>
      </button>
      {/* The details open out smoothly (a grid row growing from nothing to its content). */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="space-y-2 px-3 pb-3 pl-10 text-xs text-muted-foreground">
            {children}
            <p className="text-[11px]">{meta}</p>
            {actions && <div className="pt-0.5">{actions}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface NotificationDevice {
  id: string;
  name: string;
}

function timeAgo(ts: string, now: number): string {
  const minutes = Math.floor((now - new Date(ts).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** The bell in the header. It opens a panel that slides in from the right, above the page like the sidebar (its left edge fades,
 *  a click outside closes it), listing the faults the inverters are reporting right now and the alerts raised for them, with chips
 *  to filter them. Alerts are every alert across every one of the customer's devices (the bell is not scoped to the selected site),
 *  seeded from the server and kept live by `alerts` subscriptions; faults come from the devices' live fault registers. */
export function NotificationCenter({
  deviceIds,
  devices,
  initialAlerts,
  initialFaults,
}: {
  deviceIds: string[];
  devices: NotificationDevice[];
  initialAlerts: AlertRow[];
  initialFaults: Record<string, number | null>;
}) {
  const [alerts, setAlerts] = React.useState<AlertRow[]>(initialAlerts);
  const [filter, setFilter] = React.useState<NotificationFilter>("all");
  // closed -> open (slides in) -> closing (slides out) -> closed
  const [phase, setPhase] = React.useState<"closed" | "open" | "closing">("closed");
  const [now, setNow] = React.useState(() => Date.now());
  const [markingAll, startMarkAll] = React.useTransition();
  const filterStr = `device_id=in.(${deviceIds.join(",")})`;
  const isMobile = useIsMobile();

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

  const codes = useDeviceFaultCodes(deviceIds, initialFaults);
  const faults = React.useMemo(() => faultItems(codes), [codes]);
  const unread = unreadTotal(faults, alerts);
  const counts = filterCounts(faults, alerts);
  const shown = applyFilter(faults, alerts, filter);
  const nameOf = (id: string) => devices.find((d) => d.id === id)?.name ?? "Device";
  const open = phase !== "closed";
  // Which notifications are opened out (tap one to read it in full, like a phone notification).
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // "Mark all read" (on the Unread chip): every unread alert at once. The rows update at once; the database follows.
  const unreadAlertIds = alerts.filter((a) => !a.acknowledged_at).map((a) => a.id);
  function markAllRead() {
    const ids = unreadAlertIds;
    startMarkAll(async () => {
      await acknowledgeAllAlerts(ids);
      const at = new Date().toISOString();
      setAlerts((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, acknowledged_at: a.acknowledged_at ?? at } : a)));
    });
  }

  function show() {
    setNow(Date.now());
    setPhase("open");
  }
  const close = React.useCallback(() => setPhase((p) => (p === "open" ? "closing" : p)), []);

  // Escape closes it.
  React.useEffect(() => {
    if (phase !== "open") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, close]);

  return (
    <>
      <Button type="button" variant="outline" size="icon" className="relative h-8 w-8 shrink-0" onClick={() => (open ? close() : show())} aria-expanded={open} aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-semibold text-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </Button>

      {open &&
        createPortal(
          <>
            {/* The page behind is dimmed, and a click anywhere outside closes the panel. */}
            <div aria-hidden className={cn("fixed inset-0 z-[60] bg-white/60 backdrop-blur-[2px] transition-opacity dark:bg-black/50 dark:backdrop-blur-none duration-300 animate-in fade-in", phase === "closing" && "opacity-0")} onClick={close} />
            <aside
              role="dialog"
              aria-label="Notifications"
              onAnimationEnd={() => setPhase((p) => (p === "closing" ? "closed" : p))}
              className={cn(
                // On a phone: about three quarters of the screen, black (the `dark` class gives the contents their dark colours).
                "fixed inset-y-0 right-0 z-[61] flex w-full max-w-sm flex-col text-foreground max-md:w-3/4 max-md:min-w-64",
                isMobile && "dark",
                phase === "open" ? "[animation:panel-in-right_350ms_cubic-bezier(0.32,0.72,0,1)_both]" : "[animation:panel-out-right_250ms_cubic-bezier(0.32,0.72,0,1)_both]"
              )}
            >
              {/* Above the page: a solid background that fades out at its left edge (black on a phone), contents kept clear of the fade. */}
              <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_left,#000_calc(100%-1rem),transparent)]", isMobile ? "bg-black" : "bg-background")} />
              <div className="flex items-center justify-between gap-2 py-3 pl-6 pr-4">
                <h2 className="text-sm font-semibold">Notifications</h2>
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={close} aria-label="Close notifications">
                  <X className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 pb-3 pl-6 pr-4" role="group" aria-label="Filter notifications">
                {NOTIFICATION_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      filter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {f.label}
                    <span className={cn("tabular-nums", filter === f.value ? "opacity-80" : "opacity-60")}>{counts[f.value]}</span>
                  </button>
                ))}
              </div>

              {filter === "unread" && unreadAlertIds.length > 0 && (
                <div className="flex items-center justify-between gap-3 pb-2 pl-6 pr-4">
                  <span className="text-xs text-muted-foreground">
                    {unreadAlertIds.length} unread alert{unreadAlertIds.length === 1 ? "" : "s"}
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-3 text-xs text-primary hover:text-primary" disabled={markingAll} onClick={markAllRead}>
                    {markingAll ? <Spinner className="size-3.5" /> : <CheckCheck className="size-3.5" />}
                    Mark all read
                  </Button>
                </div>
              )}

              <div className="flex-1 space-y-1.5 overflow-y-auto pb-6 pl-6 pr-4">
                {shown.faults.length === 0 && shown.alerts.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                    <BellOff className="size-6 opacity-60" />
                    {filter === "all" ? "Nothing needs your attention." : "Nothing matches this filter."}
                  </div>
                )}

                {shown.faults.map((f) => (
                  <NotificationRow
                    key={`fault-${f.deviceId}`}
                    tone={f.info.severity}
                    icon={TriangleAlert}
                    unread
                    title={`${f.info.code} — ${f.info.label}`}
                    summary={f.info.description}
                    time="Active now"
                    meta={nameOf(f.deviceId)}
                    open={expanded.has(`fault-${f.deviceId}`)}
                    onToggle={() => toggle(`fault-${f.deviceId}`)}
                  >
                    <p className="font-medium text-foreground">{f.info.solution}</p>
                  </NotificationRow>
                ))}

                {shown.alerts.map((a) => {
                  const { title, body } = alertTitleAndBody(a.message, a.severity);
                  return (
                    <NotificationRow
                      key={a.id}
                      tone={a.severity === "critical" ? "critical" : "warning"}
                      icon={AlertTriangle}
                      unread={!a.acknowledged_at}
                      title={title}
                      summary={body}
                      time={timeAgo(a.ts, now)}
                      meta={`${nameOf(a.device_id)} · ${new Date(a.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`}
                      open={expanded.has(a.id)}
                      onToggle={() => toggle(a.id)}
                      actions={
                        !a.acknowledged_at && (
                          <form action={acknowledgeAlert.bind(null, a.id)}>
                            <SubmitButton variant="outline" size="sm" className="h-7 gap-1.5 text-xs" pendingText="Marking…">
                              <Check className="size-3.5" />
                              Mark as read
                            </SubmitButton>
                          </form>
                        )
                      }
                    />
                  );
                })}
              </div>
            </aside>
          </>,
          document.body
        )}
    </>
  );
}
