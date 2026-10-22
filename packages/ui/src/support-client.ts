import type { createClient } from "@waytara/supabase/client";
import { MAX_FILES, attachmentPath, type AttachmentView, type MessageView, type TicketStatus, type TicketView } from "./support-model";

// Everything a support screen does to the database, from the browser, as the signed-in person: the support functions (which check who may do
// what) and the file uploads. The same for the customer app and the admin app.

type Browser = ReturnType<typeof createClient>;

/** A failure with words a person can read (the database functions raise plain sentences; anything else gets a general one). */
export class SupportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupportError";
  }
}

function plain(error: { message: string; code?: string } | null, fallback: string): SupportError {
  const m = error?.message ?? "";
  if (/JWT|not authenticated|Please sign in/i.test(m)) return new SupportError("Please sign in again.");
  // our own sentences are written for people; a raw database message is not
  if (error?.code && ["42501", "22023", "54000", "P0002"].includes(error.code) && m.length < 200) return new SupportError(m);
  return new SupportError(fallback);
}

export interface NewTicket {
  siteId: string | null;
  equipmentId: string | null;
  category: string;
  subject: string;
  body: string;
}

export interface Assignee {
  id: string;
  full_name: string;
  role: string;
  is_you: boolean;
  open_tickets: number;
}

export function supportApi(supabase: Browser) {
  const rpc = async (fn: string, args: Record<string, unknown>, fallback: string): Promise<unknown> => {
    const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>)(fn, args);
    if (error) throw plain(error, fallback);
    return data;
  };

  /** Uploads the files of a message, then tells the database about them. Returns the names of the files that did not make it. */
  async function attach(ticketId: string, messageId: string, files: readonly File[], internal = false): Promise<string[]> {
    const done: { path: string; name: string; size: number; mime: string }[] = [];
    const failed: string[] = [];
    for (const file of files.slice(0, MAX_FILES)) {
      const path = attachmentPath(ticketId, file.name, internal);
      const { error } = await supabase.storage.from("support-attachments").upload(path, file, { contentType: file.type || undefined, cacheControl: "3600", upsert: false });
      if (error) failed.push(file.name);
      else done.push({ path, name: file.name, size: file.size, mime: file.type });
    }
    if (done.length > 0) await rpc("support_attach", { p_message: messageId, p_files: done }, "The files could not be added to your message.");
    return failed;
  }

  return {
    async createTicket(t: NewTicket): Promise<{ ticketId: string; messageId: string; ticketNo: number }> {
      const r = (await rpc("support_create_ticket", { p_site: t.siteId, p_equipment: t.equipmentId, p_category: t.category, p_subject: t.subject, p_body: t.body }, "The ticket could not be opened. Try again in a moment.")) as { ticket_id: string; message_id: string; ticket_no: number };
      return { ticketId: r.ticket_id, messageId: r.message_id, ticketNo: r.ticket_no };
    },
    async sendMessage(ticketId: string, body: string, internal = false): Promise<string> {
      return (await rpc("support_send_message", { p_ticket: ticketId, p_body: body, p_internal: internal }, "The message could not be sent. Try again.")) as string;
    },
    attach,
    async take(ticketId: string): Promise<void> {
      await rpc("support_take", { p_ticket: ticketId }, "Could not take the ticket.");
    },
    async assign(ticketId: string, to: string | null): Promise<void> {
      await rpc("support_assign", { p_ticket: ticketId, p_to: to }, "Could not hand the ticket over.");
    },
    async setStatus(ticketId: string, status: TicketStatus): Promise<void> {
      await rpc("support_set_status", { p_ticket: ticketId, p_status: status }, "Could not change the status.");
    },
    async close(ticketId: string, rating?: number | null, comment?: string | null): Promise<void> {
      await rpc("support_customer_close", { p_ticket: ticketId, p_rating: rating ?? null, p_comment: comment ?? null }, "Could not close the ticket.");
    },
    async reopen(ticketId: string): Promise<void> {
      await rpc("support_customer_reopen", { p_ticket: ticketId }, "Could not reopen the ticket.");
    },
    async rate(ticketId: string, rating: number, comment?: string | null): Promise<void> {
      await rpc("support_rate", { p_ticket: ticketId, p_rating: rating, p_comment: comment ?? null }, "Could not save your rating.");
    },
    async markRead(ticketId: string): Promise<void> {
      await rpc("support_mark_read", { p_ticket: ticketId }, "");
    },
    async assignees(ticketId: string): Promise<Assignee[]> {
      return ((await rpc("support_assignees", { p_ticket: ticketId }, "Could not load the team.")) as Assignee[] | null) ?? [];
    },

    /** The ticket, its messages and their files as the signed-in person may see them (the database decides). */
    async load(ticketId: string): Promise<{ ticket: TicketView | null; messages: MessageView[]; attachments: AttachmentView[] }> {
      const [t, m, a] = await Promise.all([
        supabase.from("support_tickets").select("*").eq("id", ticketId).maybeSingle(),
        supabase.from("support_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
        supabase.from("support_attachments").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      ]);
      return { ticket: (t.data as unknown as TicketView | null) ?? null, messages: (m.data as unknown as MessageView[] | null) ?? [], attachments: (a.data as unknown as AttachmentView[] | null) ?? [] };
    },

    /** Links that open the private files for an hour. */
    async signedUrls(paths: readonly string[]): Promise<Record<string, string>> {
      if (paths.length === 0) return {};
      const { data } = await supabase.storage.from("support-attachments").createSignedUrls([...paths], 3600);
      const out: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
      return out;
    },
  };
}

export type SupportApi = ReturnType<typeof supportApi>;
