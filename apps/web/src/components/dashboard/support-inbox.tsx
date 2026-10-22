"use client";

import * as React from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { StatusPill, Stars } from "@waytara/ui/support-ui";
import { isActive, roleName, ticketCode } from "@waytara/ui/support-model";
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

/** The customer's tickets: the ones still open first, the finished ones on the other tab, an unread count on each ticket that has news. */
export function SupportInbox({ tickets, customerId }: { tickets: InboxTicket[]; customerId: string }) {
  const [tab, setTab] = React.useState<"active" | "done">("active");
  const active = tickets.filter((t) => isActive(t.status) || t.status === "resolved");
  const done = tickets.filter((t) => t.status === "closed");
  const shown = tab === "active" ? active : done;
  const unreadTotal = tickets.reduce((n, t) => n + (t.unread_customer > 0 ? 1 : 0), 0);

  return (
    <div className="space-y-4">
      {/* a ticket changing (someone takes it, replies, resolves it) or a new one: the list follows without a reload */}
      <RealtimeRefresh table="support_tickets" event="UPDATE" filter={`customer_id=eq.${customerId}`} debounceMs={800} />
      <RealtimeRefresh table="support_tickets" event="INSERT" filter={`customer_id=eq.${customerId}`} debounceMs={800} />

      <div role="tablist" aria-label="Tickets" className="flex gap-1 border-b border-border">
        {(
          [
            { id: "active", label: "Open", count: active.length },
            { id: "done", label: "Closed", count: done.length },
          ] as const
        ).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{t.count}</span>
            {t.id === "active" && unreadTotal > 0 && <span className="size-2 rounded-full bg-primary" aria-label={`${unreadTotal} with news`} />}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LifeBuoy className="size-5" />
          </span>
          <p className="font-medium text-foreground">{tab === "active" ? "No open tickets" : "No closed tickets yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tab === "active" ? "Need help? Open a ticket and the team that looks after your site will pick it up." : "Tickets you close, or that the team closes, are kept here."}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {shown.map((t) => {
            const news = t.unread_customer > 0;
            const who = t.last_message_role === "customer" ? "You" : t.assigned_name ? t.assigned_name.split(" ")[0] : "Team";
            return (
              <li key={t.id}>
                <Link href={`/dashboard/support/${t.id}`} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", news ? "bg-primary" : "bg-transparent")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={cn("truncate text-sm text-foreground", news ? "font-semibold" : "font-medium")}>{t.subject}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{ago(t.last_message_at ?? t.updated_at)}</span>
                    </div>
                    {t.last_message_preview && (
                      <p className={cn("mt-0.5 truncate text-sm", news ? "text-foreground" : "text-muted-foreground")}>
                        <span className="font-medium">{who}:</span> {t.last_message_preview}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <StatusPill status={t.status} />
                      <span>{ticketCode(t.ticket_no)}</span>
                      {t.site_name && <span>· {t.site_name}</span>}
                      <span>· {t.assigned_name ? `${t.assigned_name} · ${roleName(t.assigned_role, true)}` : t.status === "closed" ? "Closed" : "Waiting for the team"}</span>
                      {t.status === "closed" && t.rating && <Stars value={t.rating} size="sm" />}
                    </div>
                  </div>
                  {news && <span className="mt-1 shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{t.unread_customer}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
