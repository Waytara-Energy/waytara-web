"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Composer, RatingForm, StatusPill, StatusSteps, Stars, Thread, type OutgoingMessage } from "@waytara/ui/support-ui";
import { categoryLabel, isActive, roleName, ticketCode, type AttachmentView, type MessageView, type TicketView } from "@waytara/ui/support-model";
import { useSupportThread } from "@waytara/ui/use-support-thread";
import { Button } from "@/components/ui/button";

/** One ticket, as the customer sees it: who is handling it, the conversation (live, with "seen" marks and files), a box to answer, and the
 *  end of the ticket: confirm it is resolved (and rate) or reopen it. */
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

  return (
    <div className="mx-auto flex h-[calc(100svh-8.5rem)] min-h-[460px] max-w-3xl flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button asChild variant="ghost" size="icon" className="mt-0.5 size-8 shrink-0">
            <Link href="/dashboard/support" aria-label="Back to your tickets">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">{ticket.subject}</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {ticketCode(ticket.ticket_no)} · {categoryLabel(ticket.category)}
              {siteName ? ` · ${siteName}` : ""}
              {deviceName ? ` · ${deviceName}` : ""} · opened {new Date(ticket.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
        {ticket.assigned_name ? (
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{ticket.assigned_name.trim().charAt(0).toUpperCase()}</span>
            <div className="text-sm leading-tight">
              <p className="font-medium text-foreground">{ticket.assigned_name}</p>
              <p className="text-xs text-muted-foreground">
                {roleName(ticket.assigned_role, true)} · {closed ? "handled your ticket" : "is handling your ticket"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400/60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
            </span>
            <p className="text-muted-foreground">{closed ? "Closed before anyone took it" : "Waiting for the team to pick this up. We will e-mail you when someone does."}</p>
          </div>
        )}
        <StatusSteps status={ticket.status} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card/50 p-4">
        <Thread messages={messages} attachments={attachmentsByMessage} urls={urls} ticket={ticket} viewer="customer" ownId={ownId} />
        <div ref={bottom} />
      </div>

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
        <div className="rounded-xl border border-border bg-card p-4">
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
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-center text-sm font-medium text-foreground">This ticket is closed. How did we do?</p>
          <RatingForm submitLabel="Send my rating" skipLabel="Not now" onSubmit={(r, c) => act(() => api.rate(ticket.id, r, c))} onSkip={async () => setRateLater(true)} />
        </div>
      )}

      {closed && ticket.rating && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
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
  );
}
