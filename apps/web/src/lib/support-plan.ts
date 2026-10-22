// Which queued support e-mails go out, which are dropped and which are merged (see /api/cron/send-support-notifications). Pure, so the rules
// are tested; the route only reads and writes.

import type { SupportKind, SupportPayload } from "./support-mail";

export interface QueueRow {
  id: number;
  ticket_id: string;
  recipient_id: string;
  audience: "customer" | "staff";
  kind: SupportKind;
  payload: SupportPayload & { message_id?: string | null };
  created_at: string;
  attempts: number;
}

export interface TicketFacts {
  id: string;
  /** when the customer last opened the thread, and when staff last did */
  customer_last_read_at: string | null;
  staff_last_read_at: string | null;
}

export interface RecipientFacts {
  id: string;
  email: string | null;
  deactivated_at: string | null;
  deleted_at: string | null;
  /** from profiles.notification_preferences */
  support_emails?: boolean | null;
}

export interface Plan {
  /** one e-mail each; `covers` are the rows it stands for (the newest first), all marked sent with it */
  send: { row: QueueRow; covers: QueueRow[] }[];
  /** rows closed without an e-mail, and why */
  close: { ids: number[]; note: string }[];
}

const REPLY: ReadonlySet<SupportKind> = new Set(["staff_reply", "customer_reply"]);

/** The rules:
 *  - nobody to write to (no address, switched off, deactivated or deleted): closed;
 *  - a reply the person has already read in the app is not e-mailed (the e-mail is held back ~45 s for exactly this);
 *  - several replies for one person on one ticket become one e-mail, about the newest;
 *  - everything else goes out as it is. */
export function planSupportBatch(rows: readonly QueueRow[], tickets: ReadonlyMap<string, TicketFacts>, people: ReadonlyMap<string, RecipientFacts>): Plan {
  const plan: Plan = { send: [], close: [] };
  const closeWith = (note: string, ...r: QueueRow[]) => {
    if (r.length === 0) return;
    const existing = plan.close.find((c) => c.note === note);
    if (existing) existing.ids.push(...r.map((x) => x.id));
    else plan.close.push({ ids: r.map((x) => x.id), note });
  };

  const replies = new Map<string, QueueRow[]>();
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const person = people.get(row.recipient_id);
    if (!person || !person.email || person.deactivated_at || person.deleted_at) {
      closeWith("no address to write to, or the account is closed", row);
      continue;
    }
    if (row.audience === "customer" && person.support_emails === false) {
      closeWith("the customer has switched support e-mails off", row);
      continue;
    }
    if (REPLY.has(row.kind)) {
      const ticket = tickets.get(row.ticket_id);
      const readAt = row.audience === "customer" ? ticket?.customer_last_read_at : ticket?.staff_last_read_at;
      if (readAt && Date.parse(readAt) >= Date.parse(row.created_at)) {
        closeWith("read in the app before the e-mail was due", row);
        continue;
      }
      const key = `${row.recipient_id}|${row.ticket_id}|${row.kind}`;
      replies.set(key, [...(replies.get(key) ?? []), row]);
      continue;
    }
    plan.send.push({ row, covers: [row] });
  }

  for (const group of replies.values()) {
    const newest = group[group.length - 1]!;
    plan.send.push({ row: newest, covers: [...group].reverse() });
  }
  plan.send.sort((a, b) => a.row.id - b.row.id);
  return plan;
}

/** When to try a failed e-mail again: 2, 4, 6 ... minutes, then every 6 hours. */
export function retryDelayMs(attempts: number): number {
  return attempts >= 5 ? 6 * 3_600_000 : Math.min(30, attempts * 2) * 60_000;
}
