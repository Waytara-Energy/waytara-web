"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { StatusPill, Stars } from "@waytara/ui/support-ui";
import { roleName, ticketCode } from "@waytara/ui/support-model";
import { cn } from "@waytara/ui/cn";
import { RealtimeRefresh } from "./realtime-refresh";

export interface BoardTicket {
  id: string;
  ticket_no: number;
  subject: string;
  status: string;
  customer_name: string | null;
  site_name: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  assigned_role: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_role: string | null;
  unread_staff: number;
  created_at: string;
  updated_at: string;
  rating: number | null;
}

type Tab = "unassigned" | "mine" | "open" | "closed";

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86_400)} d`;
}

/** The team's tickets: what nobody has taken, what is mine, everything still open, and what is closed. Live: a new ticket, a reply or a
 *  hand-over shows without a reload. */
export function SupportBoard({ tickets, meId, isAdmin }: { tickets: BoardTicket[]; meId: string; isAdmin: boolean }) {
  const [tab, setTab] = React.useState<Tab>("unassigned");
  const [query, setQuery] = React.useState("");
  // the moment the board was drawn (how long a ticket has waited is measured against it)
  const [now] = React.useState(() => Date.now());

  const counts = React.useMemo(
    () => ({
      unassigned: tickets.filter((t) => !t.assigned_to && t.status !== "closed" && t.status !== "resolved").length,
      mine: tickets.filter((t) => t.assigned_to === meId && t.status !== "closed").length,
      open: tickets.filter((t) => t.status !== "closed").length,
      closed: tickets.filter((t) => t.status === "closed").length,
    }),
    [tickets, meId],
  );

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return tickets
      .filter((t) => (tab === "unassigned" ? !t.assigned_to && t.status !== "closed" && t.status !== "resolved" : tab === "mine" ? t.assigned_to === meId && t.status !== "closed" : tab === "open" ? t.status !== "closed" : t.status === "closed"))
      .filter((t) => !q || `${t.ticket_no} ${t.subject} ${t.customer_name ?? ""} ${t.site_name ?? ""} ${t.assigned_name ?? ""}`.toLowerCase().includes(q));
  }, [tickets, tab, query, meId]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "unassigned", label: "Unassigned" },
    { id: "mine", label: "Mine" },
    { id: "open", label: "All open" },
    { id: "closed", label: "Closed" },
  ];

  return (
    <div className="space-y-4">
      <RealtimeRefresh table="support_tickets" event="UPDATE" />
      <RealtimeRefresh table="support_tickets" event="INSERT" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Tickets" className="flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              <span className={cn("rounded-full px-1.5 text-xs", t.id === "unassigned" && counts.unassigned > 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ticket, customer, site" aria-label="Search tickets" className="h-9 w-64 max-w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {query ? "No ticket matches that." : tab === "unassigned" ? "Nothing is waiting for someone to take it." : tab === "mine" ? "You have no open tickets." : tab === "open" ? "No open tickets." : "No closed tickets yet."}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {shown.map((t) => {
            const news = t.unread_staff > 0;
            const waitingH = !t.assigned_to && t.status === "open" ? (now - Date.parse(t.created_at)) / 3_600_000 : 0;
            return (
              <li key={t.id}>
                <Link href={`/support/${t.id}`} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", news ? "bg-primary" : "bg-transparent")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={cn("truncate text-sm", news ? "font-semibold" : "font-medium")}>{t.subject}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{ago(t.last_message_at ?? t.updated_at)}</span>
                    </div>
                    {t.last_message_preview && (
                      <p className={cn("mt-0.5 truncate text-sm", news ? "text-foreground" : "text-muted-foreground")}>
                        <span className="font-medium">{t.last_message_role === "customer" ? (t.customer_name?.split(" ")[0] ?? "Customer") : "Team"}:</span> {t.last_message_preview}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <StatusPill status={t.status} />
                      <span>{ticketCode(t.ticket_no)}</span>
                      <span>· {t.customer_name ?? "Customer"}</span>
                      {t.site_name && <span>· {t.site_name}</span>}
                      {t.assigned_name ? (
                        <span className={cn(t.assigned_to === meId && "font-medium text-foreground")}>
                          · {t.assigned_to === meId ? "You" : t.assigned_name} <span className="text-muted-foreground">({roleName(t.assigned_role, false).toLowerCase()})</span>
                        </span>
                      ) : t.status !== "closed" ? (
                        <span className={cn("font-medium", waitingH >= 1 ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>· Unassigned{waitingH >= 1 ? `, waiting ${ago(t.created_at)}` : ""}</span>
                      ) : null}
                      {t.status === "closed" && t.rating && <Stars value={t.rating} size="sm" />}
                    </div>
                  </div>
                  {news && <span className="mt-1 shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{t.unread_staff}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!isAdmin && <p className="text-xs text-muted-foreground">You see the tickets of the sites you are assigned to. Anyone on a site&apos;s team can take its tickets.</p>}
    </div>
  );
}
