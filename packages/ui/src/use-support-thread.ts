"use client";

import * as React from "react";
import { createClient } from "@waytara/supabase/client";
import { useRealtimeTable, type RealtimeRowEvent } from "./realtime-provider";
import { supportApi, type SupportApi } from "./support-client";
import type { AttachmentView, MessageView, TicketView, Viewer } from "./support-model";

/** The live state of one ticket for a screen: the ticket, its messages and files, kept current as people write (no reload), with the links to
 *  open the private files, and the "I have read this" mark sent while the ticket is on screen. */
export function useSupportThread({
  initialTicket,
  initialMessages,
  initialAttachments,
  viewer,
}: {
  initialTicket: TicketView;
  initialMessages: MessageView[];
  initialAttachments: AttachmentView[];
  viewer: Viewer;
}) {
  const ticketId = initialTicket.id;
  const api = React.useMemo<SupportApi>(() => supportApi(createClient()), []);
  const [ticket, setTicket] = React.useState<TicketView>(initialTicket);
  const [messages, setMessages] = React.useState<MessageView[]>(initialMessages);
  const [attachments, setAttachments] = React.useState<AttachmentView[]>(initialAttachments);
  const [urls, setUrls] = React.useState<Record<string, string>>({});

  const addMessage = React.useCallback((row: MessageView) => {
    setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at))));
  }, []);
  const addAttachment = React.useCallback((row: AttachmentView) => {
    setAttachments((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]));
  }, []);

  useRealtimeTable<MessageView>("support_messages", "INSERT", `ticket_id=eq.${ticketId}`, React.useCallback((e: RealtimeRowEvent<MessageView>) => addMessage(e.new), [addMessage]));
  useRealtimeTable<AttachmentView>("support_attachments", "INSERT", `ticket_id=eq.${ticketId}`, React.useCallback((e: RealtimeRowEvent<AttachmentView>) => addAttachment(e.new), [addAttachment]));
  useRealtimeTable<TicketView>("support_tickets", "UPDATE", `id=eq.${ticketId}`, React.useCallback((e: RealtimeRowEvent<TicketView>) => setTicket((cur) => ({ ...cur, ...e.new })), []));

  /** Read everything again (after the person sends something, so it shows at once whether or not the live channel is quick). */
  const refresh = React.useCallback(async () => {
    const fresh = await api.load(ticketId);
    if (fresh.ticket) setTicket(fresh.ticket);
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of fresh.messages) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
    setAttachments((prev) => {
      const byId = new Map(prev.map((a) => [a.id, a]));
      for (const a of fresh.attachments) byId.set(a.id, a);
      return [...byId.values()];
    });
  }, [api, ticketId]);

  // links to the private files, resolved once per path
  const wanted = React.useMemo(() => [...attachments.map((a) => a.path), ...messages.map((m) => m.attachment_path).filter((p): p is string => !!p)].filter((p) => !urls[p]), [attachments, messages, urls]);
  React.useEffect(() => {
    if (wanted.length === 0) return;
    let cancelled = false;
    void api.signedUrls(wanted).then((found) => {
      if (!cancelled && Object.keys(found).length > 0) setUrls((prev) => ({ ...prev, ...found }));
    });
    return () => {
      cancelled = true;
    };
  }, [api, wanted]);

  // "seen": while this ticket is on screen and the tab is in front, tell the database the thread was read (after anything new arrives)
  const unread = viewer === "customer" ? ticket.unread_customer : ticket.unread_staff;
  const newest = messages[messages.length - 1]?.created_at ?? "";
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mark = () => {
      if (document.visibilityState === "visible") void api.markRead(ticketId).catch(() => undefined);
    };
    timer = setTimeout(mark, 600);
    document.addEventListener("visibilitychange", mark);
    window.addEventListener("focus", mark);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", mark);
      window.removeEventListener("focus", mark);
    };
  }, [api, ticketId, unread, newest]);

  const attachmentsByMessage = React.useMemo(() => {
    const map = new Map<string, AttachmentView[]>();
    for (const a of attachments) map.set(a.message_id, [...(map.get(a.message_id) ?? []), a]);
    return map;
  }, [attachments]);

  return { api, ticket, messages, attachmentsByMessage, urls, refresh };
}
