"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Composer, StatusPill, StatusSteps, Stars, Thread, type OutgoingMessage } from "@waytara/ui/support-ui";
import { categoryLabel, roleName, ticketCode, type AttachmentView, type MessageView, type TicketView } from "@waytara/ui/support-model";
import type { Assignee } from "@waytara/ui/support-client";
import { useSupportThread } from "@waytara/ui/use-support-thread";
import { cn } from "@waytara/ui/cn";

const btn = "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
const primary = `${btn} bg-primary text-primary-foreground hover:opacity-90`;
const outline = `${btn} border border-border bg-transparent text-foreground hover:bg-accent`;

const clock = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** One ticket, as the team sees it: the conversation (with internal notes), and beside it who has the ticket (take it, hand it to someone),
 *  its status, the customer, the site and the rating. Every action is e-mailed to the customer by the database's queue. */
export function SupportDesk({
  initialTicket,
  initialMessages,
  initialAttachments,
  meId,
  deviceName,
}: {
  initialTicket: TicketView;
  initialMessages: MessageView[];
  initialAttachments: AttachmentView[];
  meId: string;
  deviceName: string | null;
}) {
  const { api, ticket, messages, attachmentsByMessage, urls, refresh } = useSupportThread({ initialTicket, initialMessages, initialAttachments, viewer: "staff" });
  const [team, setTeam] = React.useState<Assignee[]>([]);
  const [pick, setPick] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const bottom = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let live = true;
    void api.assignees(initialTicket.id).then((list) => live && setTeam(list), () => undefined);
    return () => {
      live = false;
    };
  }, [api, initialTicket.id]);

  React.useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const send = async (m: OutgoingMessage): Promise<string[]> => {
    const id = await api.sendMessage(ticket.id, m.body, m.internal);
    const failed = m.files.length > 0 ? await api.attach(ticket.id, id, m.files, m.internal).catch(() => m.files.map((f) => f.name)) : [];
    await refresh();
    return failed;
  };

  const mine = ticket.assigned_to === meId;
  const closed = ticket.status === "closed";
  const resolved = ticket.status === "resolved";
  const others = team.filter((p) => p.id !== ticket.assigned_to);
  const customerSeen = ticket.customer_last_read_at ? clock(ticket.customer_last_read_at) : null;

  return (
    <div className="grid gap-4 lg:h-[calc(100svh-8rem)] lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex min-h-[28rem] min-w-0 flex-col gap-3 lg:min-h-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Link href="/support" aria-label="Back to the tickets" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
              <ChevronLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{ticket.subject}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {ticketCode(ticket.ticket_no)} · {categoryLabel(ticket.category)} · {ticket.customer_name ?? "Customer"}
                {ticket.site_name ? ` · ${ticket.site_name}` : ""}
              </p>
            </div>
          </div>
          <StatusPill status={ticket.status} />
        </div>
        <StatusSteps status={ticket.status} />

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-4">
          <Thread messages={messages} attachments={attachmentsByMessage} urls={urls} ticket={ticket} viewer="staff" ownId={meId} />
          <div ref={bottom} />
        </div>

        <Composer
          onSend={send}
          allowInternal
          disabled={closed}
          disabledNote={
            <span>
              This ticket is closed.{" "}
              <button type="button" onClick={() => void act(() => api.setStatus(ticket.id, "in_progress"))} className="font-medium text-primary underline-offset-2 hover:underline">
                Reopen it
              </button>{" "}
              to write again.
            </span>
          }
          placeholder={ticket.assigned_to ? "Reply to the customer…" : "Reply to the customer (answering takes the ticket)…"}
        />
      </section>

      <aside className="space-y-3 lg:min-h-0 lg:overflow-y-auto">
        {problem && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {problem}
          </p>
        )}

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who has it</p>
          {ticket.assigned_name ? (
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{ticket.assigned_name.trim().charAt(0).toUpperCase()}</span>
              <div className="leading-tight">
                <p className="text-sm font-medium">{mine ? "You" : ticket.assigned_name}</p>
                <p className="text-xs text-muted-foreground">{roleName(ticket.assigned_role, false)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-300">Nobody has taken this ticket yet. Anyone on the site&apos;s team can.</p>
          )}

          {!mine && !closed && (
            <button type="button" disabled={busy} onClick={() => void act(() => api.take(ticket.id))} className={cn(primary, "w-full")}>
              {ticket.assigned_to ? "Take it over" : "Take this ticket"}
            </button>
          )}

          {!closed && others.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="hand-over">
                Hand it to someone else
              </label>
              <select id="hand-over" value={pick} onChange={(e) => setPick(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Choose a person…</option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.is_you ? " (you)" : ""} · {roleName(p.role, false)} · {p.open_tickets} open
                  </option>
                ))}
              </select>
              <button type="button" disabled={busy || !pick} onClick={() => void act(async () => { await api.assign(ticket.id, pick); setPick(""); })} className={cn(outline, "w-full")}>
                Hand over
              </button>
            </div>
          )}
          {mine && !closed && (
            <button type="button" disabled={busy} onClick={() => void act(() => api.assign(ticket.id, null))} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              Put it back for the team
            </button>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-2">
            {!resolved && !closed && (
              <button type="button" disabled={busy} onClick={() => void act(() => api.setStatus(ticket.id, "resolved"))} className={primary}>
                Mark resolved
              </button>
            )}
            {!closed && (
              <button type="button" disabled={busy} onClick={() => void act(() => api.setStatus(ticket.id, "closed"))} className={outline}>
                Close ticket
              </button>
            )}
            {(resolved || closed) && (
              <button type="button" disabled={busy} onClick={() => void act(() => api.setStatus(ticket.id, "in_progress"))} className={outline}>
                Reopen
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{resolved ? "The customer has been asked to confirm and rate." : closed ? "Closed." : "Resolving e-mails the customer and asks them to confirm. Closing e-mails them and asks for a rating."}</p>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Details</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="truncate text-right">{ticket.customer_name ?? "—"}</dd>
            <dt className="text-muted-foreground">Site</dt>
            <dd className="truncate text-right">{ticket.site_name ?? "—"}</dd>
            {deviceName && (
              <>
                <dt className="text-muted-foreground">Device</dt>
                <dd className="truncate text-right">{deviceName}</dd>
              </>
            )}
            <dt className="text-muted-foreground">About</dt>
            <dd className="text-right">{categoryLabel(ticket.category)}</dd>
            <dt className="text-muted-foreground">Opened</dt>
            <dd className="text-right">{clock(ticket.created_at)}</dd>
            <dt className="text-muted-foreground">Customer saw</dt>
            <dd className="text-right">{customerSeen ?? "not yet"}</dd>
          </dl>
        </div>

        {ticket.rating && (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer rating</p>
            <Stars value={ticket.rating} />
            {ticket.rating_comment && <p className="text-sm text-foreground">&ldquo;{ticket.rating_comment}&rdquo;</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
