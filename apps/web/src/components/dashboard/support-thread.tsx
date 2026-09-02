"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Paperclip, Send } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Message, MessageHeader } from "@/components/ui/message";
import { MessageBubble } from "@/components/ui/message-bubble";
import { MessageScroller } from "@/components/ui/message-scroller";
import { Attachment } from "@/components/ui/attachment";
import { Textarea } from "@/components/ui/textarea";
import { attachmentFileName } from "@/lib/support-attachments";
import { markTicketResolved, sendSupportMessage } from "@/app/dashboard/support/actions";

const STATUS_BADGE_VARIANT: Record<string, "alert" | "default" | "secondary"> = {
  open: "alert",
  in_progress: "default",
  resolved: "secondary",
  closed: "secondary",
};

interface TicketMessage {
  id: string;
  sender_id: string | null;
  sender_role: string;
  body: string;
  attachment_path: string | null;
  created_at: string;
}

const MESSAGE_COLUMNS = "id, sender_id, sender_role, body, attachment_path, created_at";

/** The thread itself — MessageScroller + Message/MessageBubble, a Menubar
 *  for "Attach file"/"Mark resolved", and a composer. Polls
 *  support_messages on an interval rather than a Realtime subscription,
 *  matching MonitoringPanel's established convention for "how this app
 *  makes something feel live". */
export function SupportThread({
  ticket,
  initialMessages,
  currentUserId,
}: {
  ticket: { id: string; subject: string; status: string };
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

  const refetch = React.useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("support_messages")
      .select(MESSAGE_COLUMNS)
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  }, [ticket.id]);

  React.useEffect(() => {
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  // support-attachments is a private bucket — a plain public URL won't
  // work, so each attachment needs its own signed URL, resolved once and
  // cached by path.
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

    await sendSupportMessage(formData);

    setBody("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refetch();
    setSending(false);
  }

  async function handleMarkResolved() {
    await markTicketResolved(ticket.id);
    setStatus("resolved");
  }

  const isResolved = status === "resolved" || status === "closed";

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/dashboard/support">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <p className="truncate text-sm font-semibold text-foreground">{ticket.subject}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[status] ?? "secondary"} className="capitalize">
            {status.replace(/_/g, " ")}
          </Badge>
          <Menubar className="border-none bg-transparent p-0 shadow-none">
            <MenubarMenu>
              <MenubarTrigger className="cursor-pointer px-2">Actions</MenubarTrigger>
              <MenubarContent align="end">
                <MenubarItem onSelect={() => fileInputRef.current?.click()}>
                  <Paperclip className="mr-2 size-4" />
                  Attach file
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem disabled={isResolved} onSelect={() => void handleMarkResolved()}>
                  <CheckCircle2 className="mr-2 size-4" />
                  Mark resolved
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-xl border border-border">
        <MessageScroller watch={messages.length} className="h-full">
          {messages.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((m) => {
              const isOwn = m.sender_id === currentUserId;
              return (
                <Message key={m.id} isOwn={isOwn}>
                  <MessageHeader>
                    <span className="capitalize">{isOwn ? "You" : m.sender_role}</span>
                    <span>&middot;</span>
                    <span>
                      {new Date(m.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </MessageHeader>
                  <MessageBubble variant={isOwn ? "own" : "other"}>{m.body}</MessageBubble>
                  {m.attachment_path && (
                    <div className="mt-1 max-w-[75%]">
                      <Attachment
                        fileName={attachmentFileName(m.attachment_path)}
                        href={attachmentUrls[m.attachment_path]}
                      />
                    </div>
                  )}
                </Message>
              );
            })
          )}
        </MessageScroller>
      </div>

      <form ref={formRef} onSubmit={handleSend} className="space-y-2">
        {file && (
          <Attachment
            fileName={file.name}
            fileSize={file.size}
            onRemove={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message..."
            rows={2}
            disabled={sending}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={sending || !body.trim()}>
            {sending ? <Spinner className="size-4" /> : <Send className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
