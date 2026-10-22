"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { StatusPill, Stars } from "@waytara/ui/support-ui";
import { isActive, ticketCode } from "@waytara/ui/support-model";
import { cn } from "@/lib/utils";
import { RealtimeRefresh } from "./realtime-refresh";

export interface InboxTicket {
  id: string;
  ticket_no: number;
  subject: string;
  status: string;
  site_name: string | null;
  assigned_name: string | null;
  assigned_role: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_role: string | null;
  unread_customer: number;
  updated_at: string;
  rating: number | null;
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** The customer's tickets, on the left of the Support page: the open ones first, the finished ones on the other tab, an unread count on each
 *  ticket that has news, and the one being read marked. `action` is the New ticket button. */
export function SupportInbox({ tickets, customerId, action }: { tickets: InboxTicket[]; customerId: string; action: React.ReactNode }) {
  const [tab, setTab] = React.useState<"active" | "done">("active");
  const openId = usePathname().match(/\/dashboard\/support\/([0-9a-f-]{36})/)?.[1] ?? null;
  const active = tickets.filter((t) => isActive(t.status) || t.status === "resolved");
  const done = tickets.filter((t) => t.status === "closed");
  const shown = tab === "active" ? active : done;
  const unreadTotal = tickets.reduce((n, t) => n + (t.unread_customer > 0 ? 1 : 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      {/* a ticket changing (someone takes it, replies, resolves it) or a new one: the list follows without a reload */}
      <RealtimeRefresh table="support_tickets" event="UPDATE" filter={`customer_id=eq.${customerId}`} debounceMs={800} />
      <RealtimeRefresh table="support_tickets" event="INSERT" filter={`customer_id=eq.${customerId}`} debounceMs={800} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Support</h1>
          <p className="mt-0.5 text-sm text-theme-muted">We e-mail you at every step.</p>
        </div>
        {action}
      </div>

      <div role="tablist" aria-label="Tickets" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            { id: "active", label: "Open", count: active.length },
            { id: "done", label: "Closed", count: done.length },
          ] as const
        ).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
            <span className="text-xs text-muted-foreground">{t.count}</span>
            {t.id === "active" && unreadTotal > 0 && <span className="size-2 rounded-full bg-primary" aria-label={`${unreadTotal} with news`} />}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LifeBuoy className="size-5" />
          </span>
          <p className="font-medium text-foreground">{tab === "active" ? "No open tickets" : "No closed tickets yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tab === "active" ? "Need help? Open a ticket and the team that looks after your site will pick it up." : "Tickets you close, or that the team closes, are kept here."}</p>
        </div>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1 max-lg:overflow-visible">
          {shown.map((t) => {
            const news = t.unread_customer > 0;
            const open = t.id === openId;
            const who = t.last_message_role === "customer" ? "You" : t.assigned_name ? t.assigned_name.split(" ")[0] : "Team";
            return (
              <li key={t.id}>
                <Link href={`/dashboard/support/${t.id}`} aria-current={open ? "page" : undefined} className={cn("block rounded-xl px-3.5 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", open ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={cn("flex min-w-0 items-center gap-2 text-sm text-foreground", news ? "font-semibold" : "font-medium")}>
                      {news && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={`${t.unread_customer} new`} />}
                      <span className="truncate">{t.subject}</span>
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{ago(t.last_message_at ?? t.updated_at)}</span>
                  </div>
                  {t.last_message_preview && (
                    <p className={cn("mt-1 line-clamp-2 text-[13px] leading-snug", news ? "text-foreground" : "text-muted-foreground")}>
                      <span className="font-medium">{who}:</span> {t.last_message_preview}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusPill status={t.status} />
                    <span>{ticketCode(t.ticket_no)}</span>
                    {t.status === "closed" && t.rating ? <Stars value={t.rating} size="sm" /> : !t.assigned_name && t.status !== "closed" ? <span>Waiting for the team</span> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
