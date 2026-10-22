"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronLeft, FileText } from "lucide-react";
import { Composer, RatingForm, StatusPill, StatusSteps, Stars, Thread, type OutgoingMessage } from "@waytara/ui/support-ui";
import { categoryLabel, fileKind, isActive, roleName, ticketCode, STATUS_STEPS, type AttachmentView, type MessageView, type TicketView } from "@waytara/ui/support-model";
import { useSupportThread } from "@waytara/ui/use-support-thread";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null);

function Widget({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Handler({ ticket, closed }: { ticket: TicketView; closed: boolean }) {
  if (ticket.assigned_name) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary">{ticket.assigned_name.trim().charAt(0).toUpperCase()}</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-medium text-foreground">{ticket.assigned_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {roleName(ticket.assigned_role, true)} · {closed ? "handled your ticket" : "is handling your ticket"}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
        <span className="absolute inline-flex size-3 animate-ping rounded-full bg-amber-400/60" />
        <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
      </span>
      <p className="text-sm text-muted-foreground">{closed ? "Closed before anyone took it" : "Waiting for the team to pick this up. We will e-mail you when someone does."}</p>
    </div>
  );
}

/** The four steps of a ticket, one under the other, with when each happened. */
function Progress({ ticket }: { ticket: TicketView }) {
  const at = Math.max(0, STATUS_STEPS.findIndex((s) => s.id === ticket.status));
  const times: Record<string, string | null> = { open: ticket.created_at, in_progress: null, resolved: ticket.resolved_at, closed: ticket.closed_at };
  return (
    <ol className="space-y-0">
      {STATUS_STEPS.map((s, i) => {
        const done = i < at || (i === at && (s.id === "closed" || s.id === "resolved"));
        const now = i === at && !done;
        return (
          <li key={s.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("flex size-5 items-center justify-center rounded-full border-2 text-[10px]", done ? "border-emerald-500 bg-emerald-500 text-white" : now ? "border-primary bg-primary/15" : "border-border bg-background")}>
                {done ? <Check className="size-3" strokeWidth={3} /> : now ? <span className="size-1.5 rounded-full bg-primary" /> : null}
              </span>
              {i < STATUS_STEPS.length - 1 && <span className={cn("my-0.5 w-px flex-1", i < at ? "bg-emerald-500" : "bg-border")} style={{ minHeight: "1.1rem" }} />}
            </div>
            <div className="pb-2.5 leading-tight">
              <p className={cn("text-sm", i <= at ? "font-medium text-foreground" : "text-muted-foreground")}>
                {i + 1}. {s.label}
              </p>
              {(times[s.id] || (s.id === "in_progress" && ticket.assigned_name)) && (
                <p className="text-xs text-muted-foreground">{s.id === "in_progress" ? `with ${ticket.assigned_name}` : when(times[s.id])}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One ticket, as the customer sees it: the conversation in the middle (live, with "seen" marks and files), and beside it, like a set of
 *  widgets, who is handling it, how far it has come, its details, the files shared and where else to look. */
export function SupportConversation({
  initialTicket,
  initialMessages,
  initialAttachments,
  ownId,
  siteName,
  deviceName,
}: {
  initialTicket: TicketView;
  initialMessages: MessageView[];
  initialAttachments: AttachmentView[];
  ownId: string;
  siteName: string | null;
  deviceName: string | null;
}) {
  const { api, ticket, messages, attachmentsByMessage, urls, refresh } = useSupportThread({ initialTicket, initialMessages, initialAttachments, viewer: "customer" });
  const [closing, setClosing] = React.useState(false);
  const [rateLater, setRateLater] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const bottom = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (m: OutgoingMessage): Promise<string[]> => {
    const id = await api.sendMessage(ticket.id, m.body, false);
    const failed = m.files.length > 0 ? await api.attach(ticket.id, id, m.files).catch(() => m.files.map((f) => f.name)) : [];
    await refresh();
    return failed;
  };

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

  const closed = ticket.status === "closed";
  const resolved = ticket.status === "resolved";
  const files = [...attachmentsByMessage.values()].flat();

  return (
    <div className="flex h-full min-h-0 gap-4">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <Button asChild variant="ghost" size="icon" className="-ml-1 mt-0.5 size-8 shrink-0 lg:hidden">
              <Link href="/dashboard/support" aria-label="Back to your tickets">
                <ChevronLeft className="size-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">{ticket.subject}</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {ticketCode(ticket.ticket_no)} · {categoryLabel(ticket.category)}
                {siteName ? ` · ${siteName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill status={ticket.status} />
            {isActive(ticket.status) && !closing && (
              <Button variant="outline" size="sm" onClick={() => setClosing(true)}>
                Close ticket
              </Button>
            )}
          </div>
        </header>

        {/* on a screen too narrow for the widgets, the essentials sit here */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border bg-muted/30 px-4 py-2.5 xl:hidden">
          <Handler ticket={ticket} closed={closed} />
          <StatusSteps status={ticket.status} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Thread messages={messages} attachments={attachmentsByMessage} urls={urls} ticket={ticket} viewer="customer" ownId={ownId} />
          <div ref={bottom} />
        </div>

        <div className="space-y-3 border-t border-border p-3">
          {problem && (
            <p className="text-sm text-destructive" role="alert">
              {problem}
            </p>
          )}

          {resolved && !closing && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-sm font-medium text-foreground">{ticket.assigned_name ?? "The team"} marked this as resolved. Is your issue sorted?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => setClosing(true)}>
                  Yes, close the ticket
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => api.reopen(ticket.id))}>
                  No, reopen it
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Or just write below: a reply opens the ticket again.</p>
            </div>
          )}

          {closing && !closed && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-3 text-center text-sm font-medium text-foreground">{resolved ? "Glad it is sorted. How did we do?" : "Close this ticket. How did we do so far?"}</p>
              <RatingForm
                submitLabel="Close and rate"
                skipLabel="Close without rating"
                onSubmit={(r, c) => act(async () => { await api.close(ticket.id, r, c); setClosing(false); })}
                onSkip={() => act(async () => { await api.close(ticket.id, null, null); setClosing(false); })}
              />
              <button type="button" onClick={() => setClosing(false)} className="mx-auto mt-2 block text-xs text-muted-foreground underline-offset-2 hover:underline">
                Keep it open
              </button>
            </div>
          )}

          {closed && !ticket.rating && !rateLater && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="mb-3 text-center text-sm font-medium text-foreground">This ticket is closed. How did we do?</p>
              <RatingForm submitLabel="Send my rating" skipLabel="Not now" onSubmit={(r, c) => act(() => api.rate(ticket.id, r, c))} onSkip={async () => setRateLater(true)} />
            </div>
          )}

          {closed && ticket.rating && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
              <span className="text-muted-foreground">Your rating</span>
              <Stars value={ticket.rating} size="sm" />
              {ticket.rating_comment && <span className="min-w-0 flex-1 truncate text-foreground">&ldquo;{ticket.rating_comment}&rdquo;</span>}
            </div>
          )}

          <Composer
            onSend={send}
            disabled={closed}
            disabledNote={
              <>
                This ticket is closed. If you still need help, <Link href="/dashboard/support" className="font-medium text-primary underline-offset-2 hover:underline">open a new ticket</Link>.
              </>
            }
            placeholder={resolved ? "Not fixed yet? Write here and the ticket opens again…" : "Write a message…"}
          />
        </div>
      </section>

      <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto xl:flex" aria-label="About this ticket">
        <Widget title="Handled by">
          <Handler ticket={ticket} closed={closed} />
        </Widget>

        <Widget title="Progress">
          <Progress ticket={ticket} />
        </Widget>

        <Widget title="Ticket details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Ticket</dt>
            <dd className="text-right font-medium">{ticketCode(ticket.ticket_no)}</dd>
            <dt className="text-muted-foreground">About</dt>
            <dd className="text-right">{categoryLabel(ticket.category)}</dd>
            {siteName && (
              <>
                <dt className="text-muted-foreground">Site</dt>
                <dd className="truncate text-right">{siteName}</dd>
              </>
            )}
            {deviceName && (
              <>
                <dt className="text-muted-foreground">Device</dt>
                <dd className="truncate text-right">{deviceName}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Opened</dt>
            <dd className="text-right">{when(ticket.created_at)}</dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="text-right">{when(ticket.updated_at)}</dd>
          </dl>
        </Widget>

        {files.length > 0 && (
          <Widget title={`Files shared (${files.length})`}>
            <ul className="space-y-1.5">
              {files.map((f) => (
                <li key={f.id}>
                  <a href={urls[f.path]} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fileKind(f.file_name, f.mime_type) === "image" ? "Photo" : "File"}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Widget>
        )}

        <Widget title="While you wait">
          <ul className="space-y-1.5 text-sm">
            {[
              { href: "/dashboard/maintenance", label: "Check your device's health" },
              { href: "/dashboard/monitoring", label: "See live readings" },
              { href: "/dashboard/support", label: "Read the help and guides" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-foreground transition-colors hover:bg-muted">
                  {l.label}
                  <ArrowUpRight className="size-3.5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Widget>
      </aside>
    </div>
  );
}
