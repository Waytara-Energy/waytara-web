// The e-mails about a device going offline, still being offline and coming back, and about the hub itself. Pure logic (no database, no
// network): the route that sends them stays thin and this is tested. What to send is decided in the database (waytara.fleet_tick writes
// rows into waytara.notification_outbox); this file only decides who gets which rows together, and how they read.

import { fmtIst } from "./device-alerts";

export type OutboxKind = "offline" | "still_offline" | "back_online" | "hub_down" | "hub_back";

export interface OutboxRow {
  id: number;
  audience: "customer" | "admin";
  kind: OutboxKind;
  customer_id: string | null;
  device_id: string | null;
  alert_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
}

/** A customer is never e-mailed about devices twice within this time: whatever comes up in between waits and joins the next e-mail. */
export const MIN_GAP_MS = 10 * 60_000;
/** One e-mail lists at most this many devices; the rest waits for the next one. */
export const MAX_ITEMS_PER_EMAIL = 20;

export interface Plan {
  /** customer id to the rows that go into that customer's one e-mail */
  customers: Map<string, OutboxRow[]>;
  /** the hub's messages to admins (one e-mail each, to every admin) */
  admin: OutboxRow[];
  /** rows that stay in the queue: their customer was e-mailed less than MIN_GAP_MS ago, or the e-mail is already full */
  waiting: OutboxRow[];
}

/** Which due rows go out now. `lastEmailAt` is each customer's last device-status e-mail (ISO), `nowMs` the current time. */
export function planBatch(rows: readonly OutboxRow[], lastEmailAt: ReadonlyMap<string, string>, nowMs: number): Plan {
  const plan: Plan = { customers: new Map(), admin: [], waiting: [] };
  const ordered = [...rows].sort((a, b) => a.id - b.id);
  for (const row of ordered) {
    if (row.audience === "admin" || row.customer_id === null) {
      plan.admin.push(row);
      continue;
    }
    const last = lastEmailAt.get(row.customer_id);
    if (last !== undefined && nowMs - new Date(last).getTime() < MIN_GAP_MS) {
      plan.waiting.push(row);
      continue;
    }
    const list = plan.customers.get(row.customer_id) ?? [];
    if (list.length >= MAX_ITEMS_PER_EMAIL) {
      plan.waiting.push(row);
      continue;
    }
    list.push(row);
    plan.customers.set(row.customer_id, list);
  }
  return plan;
}

/** "under a minute", "7 minutes", "1 hour 5 minutes", "2 days 3 hours" */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return "under a minute";
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  if (days > 0) return hours > 0 ? `${plural(days, "day")} ${plural(hours, "hour")}` : plural(days, "day");
  if (hours > 0) return minutes > 0 ? `${plural(hours, "hour")} ${plural(minutes, "minute")}` : plural(hours, "hour");
  return plural(minutes, "minute");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export interface DigestItem {
  kind: "offline" | "still_offline" | "back_online";
  deviceLabel: string;
  siteName: string | null;
  /** the alert's own sentence (offline and still offline) */
  message: string | null;
  sinceMs: number | null;
  /** how long it has been offline (still offline) or was down (back online) */
  seconds: number | null;
}

/** The row's payload, read defensively (it is JSON written by the database function). */
export function itemOf(row: OutboxRow): DigestItem | null {
  if (row.kind !== "offline" && row.kind !== "still_offline" && row.kind !== "back_online") return null;
  const p = row.payload ?? {};
  const since = str(p.since) ?? str(p.back_at);
  return {
    kind: row.kind,
    deviceLabel: str(p.device_label) ?? "Your device",
    siteName: str(p.site_name),
    message: str(p.message),
    sinceMs: since ? new Date(since).getTime() : null,
    seconds: num(p.offline_for_s) ?? num(p.down_for_s),
  };
}

const SECTIONS: { kind: DigestItem["kind"]; title: string }[] = [
  { kind: "offline", title: "Offline" },
  { kind: "still_offline", title: "Still offline" },
  { kind: "back_online", title: "Back online" },
];

function lineOf(it: DigestItem): string {
  const where = it.siteName ? ` (${it.siteName})` : "";
  if (it.kind === "back_online") return `${it.deviceLabel}${where} is reporting again${it.seconds !== null ? `; it was down for ${fmtDuration(it.seconds)}` : ""}.`;
  const base = it.message ?? `${it.deviceLabel}${where} is not reporting.`;
  const label = it.message && !it.message.includes(it.deviceLabel) ? ` (${it.deviceLabel}${where})` : "";
  const since = it.sinceMs !== null ? ` Offline since ${fmtIst(it.sinceMs)}${it.kind === "still_offline" && it.seconds !== null ? ` (${fmtDuration(it.seconds)})` : ""}.` : "";
  return `${base}${label}${since}`;
}

export interface DigestInput {
  customerName: string | null;
  items: DigestItem[];
  dashboardUrl: string;
}

/** One e-mail for one customer: every device that changed since their last e-mail, in sections. */
export function buildStatusDigest(input: DigestInput): { subject: string; text: string; html: string } {
  const items = input.items;
  const first = items[0];
  let subject = "Updates about your devices";
  if (items.length === 1 && first) {
    subject = first.kind === "offline" ? `${first.deviceLabel} is offline` : first.kind === "still_offline" ? `Reminder: ${first.deviceLabel} is still offline` : `${first.deviceLabel} is back online`;
  } else if (items.every((i) => i.kind === "offline")) {
    subject = `${items.length} of your devices are offline`;
  } else if (items.every((i) => i.kind === "back_online")) {
    subject = `${items.length} of your devices are back online`;
  }
  const greeting = `Hi ${input.customerName ?? "there"},`;
  const lead = items.some((i) => i.kind !== "back_online")
    ? "We can no longer reach the device(s) below. If power or internet was cut, it will reconnect by itself when it is back."
    : "Good news: your device(s) are reporting again.";
  const reminder = items.some((i) => i.kind === "still_offline")
    ? "Open the dashboard and press Acknowledge on the alert to stop the reminders (they also stop once the device is back)."
    : "";
  const sections = SECTIONS.map((s) => ({ title: s.title, lines: items.filter((i) => i.kind === s.kind).map(lineOf) })).filter((s) => s.lines.length > 0);

  const text = [
    greeting,
    "",
    lead,
    ...sections.flatMap((s) => ["", `${s.title}:`, ...s.lines.map((l) => `  - ${l}`)]),
    reminder ? "" : null,
    reminder || null,
    "",
    `Open your dashboard: ${input.dashboardUrl}`,
    "",
    "You get these e-mails because alert e-mails are on for your account (Settings > Application Settings). We group updates into one e-mail.",
    "- The WayTara Team",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:560px">
<p>${esc(greeting)}</p>
<p><strong>${esc(lead)}</strong></p>
${sections.map((s) => `<p style="margin-bottom:4px"><strong>${esc(s.title)}</strong></p><ul style="margin-top:0;padding-left:18px">${s.lines.map((l) => `<li style="margin-bottom:6px">${esc(l)}</li>`).join("")}</ul>`).join("\n")}
${reminder ? `<p style="color:#475569;font-size:13px">${esc(reminder)}</p>` : ""}
<p><a href="${esc(input.dashboardUrl)}" style="background:#16a34a;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none">Open your dashboard</a></p>
<p style="color:#64748b;font-size:12px">You get these e-mails because alert e-mails are on for your account (Settings &gt; Application Settings). We group updates into one e-mail.<br>- The WayTara Team</p>
</div>`;
  return { subject, text, html };
}

/** The hub's own messages, for admins. */
export function buildHubEmail(rows: readonly OutboxRow[], dashboardUrl: string): { subject: string; text: string; html: string } {
  const down = rows.find((r) => r.kind === "hub_down");
  const back = rows.find((r) => r.kind === "hub_back");
  const sinceDown = down ? str(down.payload.since) : null;
  const backFor = back ? num(back.payload.down_for_s) : null;
  const subject = back && !down ? "The WayTara hub is back" : down && back ? "The WayTara hub went down and is back" : "The WayTara hub is not answering";
  const lines: string[] = [];
  if (down) {
    lines.push(`The hub has not answered the database's 10-second check since ${sinceDown ? fmtIst(new Date(sinceDown).getTime()) : "a few minutes ago"}.`);
    lines.push("While it is down, boards cannot send readings and customers are NOT e-mailed about their devices being offline.");
  }
  if (back) lines.push(`The hub is answering again${backFor !== null ? ` after ${fmtDuration(backFor)}` : ""}. Boards reconnect by themselves within a minute or two.`);
  const text = ["Hi,", "", ...lines, "", `Dashboard: ${dashboardUrl}`, "- WayTara monitoring"].join("\n");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:560px"><p>Hi,</p>${lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p><a href="${esc(dashboardUrl)}">Open the dashboard</a></p><p style="color:#64748b;font-size:12px">- WayTara monitoring</p></div>`;
  return { subject, text, html };
}
