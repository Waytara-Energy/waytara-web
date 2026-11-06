import type { Mail } from "./support-mail";
import { renderMail } from "@waytara/ui/mail-layout";

// The e-mail for the customer's own alerts. One e-mail lists everything that fired in a run for one customer.

export interface FiredAlert {
  title: string;
  /** "Battery level" */
  metricLabel: string;
  /** "18%" */
  valueText: string;
  /** "below 20%" */
  limitText: string;
  siteName: string | null;
  severity: "info" | "warning" | "critical";
}

export interface AlertMailInput {
  name: string | null;
  alerts: FiredAlert[];
  /** the dashboard the button opens */
  dashboardUrl: string;
  /** Settings > Notifications, where the alerts are managed */
  settingsUrl: string;
}

const first = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

export function buildAlertEmail(input: AlertMailInput): Mail {
  const list = input.alerts;
  const one = list.length === 1 ? list[0] : null;
  const subject = one ? `Your alert: ${one.title}` : `${list.length} of your alerts went off`;
  const lead = one ? "One of your alerts went off." : "Some of your alerts went off.";
  const items = list.map((a) => `${a.metricLabel} is ${a.valueText} (${a.limitText})${a.siteName ? `, ${a.siteName}` : ""}`);
  const { html, text } = renderMail({
    preheader: lead,
    title: subject,
    greeting: first(input.name) ? `Hi ${first(input.name)},` : "Hi,",
    blocks: [
      { type: "p", text: lead },
      { type: "list", items },
      { type: "note", text: `You set these alerts yourself or left WayTara's smart alerts on. Change or switch them off in Settings > Notifications.` },
    ],
    button: { label: "Open your dashboard", url: input.dashboardUrl },
    why: "You get this e-mail because alert e-mails are on for your account.",
    audience: "customer",
  });
  return { subject, text, html };
}
