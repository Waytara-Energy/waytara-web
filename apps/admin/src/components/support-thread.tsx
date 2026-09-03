"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Paperclip, Send, X } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { useRealtimeTable, type RealtimeRowEvent } from "@waytara/ui/realtime-provider";
import { Button } from "@waytara/ui/button";
import { cn } from "@waytara/ui/cn";
import { attachmentFileName } from "@/lib/support-attachments";
import { sendSupportReply, updateTicketStatus } from "@/app/(dashboard)/support/actions";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"] as const;

interface TicketMessage {
  id: string;
  sender_id: string | null;
  sender_role: string;
  body: string;
  attachment_path: string | null;
  created_at: string;
}

/** apps/admin's own thread view — same interaction pattern as apps/web's
 *  SupportThread (support_messages realtime subscription instead of a
 *  poll, signed URLs for the private support-attachments bucket) but
 *  hand-rolled in plain Tailwind: this app has no shadcn setup of its
 *  own, so there's no local Message/MessageBubble/MessageScroller/Menubar
 *  to reuse, and apps/web's copies aren't importable here (no cross-app
 *  imports, only packages/* is shared — and this thread view is small
 *  enough on its own not to be worth a new shared package export). */
export function SupportThread({
  ticket,
  initialMessages,
  currentUserId,
}: {
  ticket: { id: string; subject: string; status: string; customerName: string };
  initialMessages: TicketMessage[];
  currentUserId: string;
}) {
  const [messages, setMessages] = React.useState<TicketMessage[]>(initialMessages);
  const [status, setStatus] = React.useState(ticket.status);
  const [body, setBody] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [sending, setSending] = React.useState(false);
  const [attachmentUrls, setAttachmentUrls] = React.useState<Record<string, string>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  useRealtimeTable<TicketMessage>(
    "support_messages",
    "INSERT",
    `ticket_id=eq.${ticket.id}`,
    React.useCallback((payload: RealtimeRowEvent<TicketMessage>) => {
      setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
    }, [])
  );

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // support-attachments is private — resolve a signed URL per attachment,
  // cached by path, same as apps/web's copy.
  React.useEffect(() => {
    const paths = messages.map((m) => m.attachment_path).filter((p): p is string => !!p && !attachmentUrls[p]);
    if (paths.length === 0) return;
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const entries: Record<string, string> = {};
      for (const path of paths) {
        const { data } = await supabase.storage.from("support-attachments").createSignedUrl(path, 3600);
        if (data?.signedUrl) entries[path] = data.signedUrl;
      }
      if (!cancelled && Object.keys(entries).length > 0) {
        setAttachmentUrls((prev) => ({ ...prev, ...entries }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    const formData = new FormData();
    formData.set("ticketId", ticket.id);
    formData.set("body", body);
    if (file) formData.set("attachment", file);

    await sendSupportReply(formData);

    setBody("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // No refetch — the support_messages realtime subscription above will
    // append this message the same way it does for the customer's.
    setSending(false);
  }

  async function handleStatusChange(next: string) {
    const previous = status;
    setStatus(next);
    await updateTicketStatus(ticket.id, next).catch(() => setStatus(previous));
  }

  return (
    <div className="flex h-[75vh] min-h-[420px] max-w-2xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="size-3" />
            Back to Support
          </Link>
          <p className="mt-1 truncate text-sm font-semibold">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground">{ticket.customerName}</p>
        </div>
        <select
          value={status}
          onChange={(e) => void handleStatusChange(e.target.value)}
          className="h-8 shrink-0 rounded-md border border-border bg-background px-2 text-xs font-medium capitalize"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const isOwn = m.sender_id === currentUserId;
              return (
                <div key={m.id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                  <p className="mb-1 px-1 text-xs text-muted-foreground">
                    <span className="capitalize">{isOwn ? "You" : m.sender_role}</span> ·{" "}
                    {new Date(m.created_at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <div
                    className={cn(
                      "max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      isOwn
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm border border-border bg-muted text-foreground"
                    )}
                  >
                    {m.body}
                  </div>
                  {m.attachment_path && (
                    <a
                      href={attachmentUrls[m.attachment_path]}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="mt-1 flex max-w-[75%] items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground hover:bg-accent"
                    >
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{attachmentFileName(m.attachment_path)}</span>
                    </a>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form ref={formRef} onSubmit={handleSend} className="space-y-2">
        {file && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${file.name}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a reply..."
            rows={2}
            disabled={sending}
            className="h-auto flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="size-4" />
          </Button>
          <Button type="submit" size="icon" disabled={sending || !body.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
