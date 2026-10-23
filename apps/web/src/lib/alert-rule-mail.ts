import type { Mail } from "./support-mail";

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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const first = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";
const TONE: Record<FiredAlert["severity"], string> = { info: "#0ea5e9", warning: "#f59e0b", critical: "#dc2626" };

export function buildAlertEmail(input: AlertMailInput): Mail {
  const list = input.alerts;
  const hello = first(input.name) ? `Hi ${first(input.name)},` : "Hi,";
  const one = list.length === 1 ? list[0] : null;
  const subject = one ? `Your alert: ${one.title}` : `${list.length} of your alerts went off`;
  const lead = one ? "One of your alerts went off." : "Some of your alerts went off.";
  const lines = list.map((a) => `- ${a.metricLabel} is ${a.valueText} (${a.limitText})${a.siteName ? `, ${a.siteName}` : ""}`);

  const text = [hello, "", lead, "", ...lines, "", `Open your dashboard: ${input.dashboardUrl}`, "", `You set these alerts yourself or left WayTara's smart alerts on. Change or switch them off in Settings > Notifications: ${input.settingsUrl}`, "- The WayTara Team"].join("\n");

  const rows = list
    .map(
      (a) =>
        `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid #e2e8f0"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${TONE[a.severity]};margin-right:8px"></span><strong>${esc(a.metricLabel)}</strong> is <strong>${esc(a.valueText)}</strong><br><span style="color:#64748b;font-size:12px">${esc(a.limitText)}${a.siteName ? ` · ${esc(a.siteName)}` : ""}</span></td></tr>`
    )
    .join("");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:540px">
<p>${esc(hello)}</p>
<p>${esc(lead)}</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">${rows}</table>
<p style="margin-top:16px"><a href="${esc(input.dashboardUrl)}" style="background:#16a34a;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;display:inline-block">Open your dashboard</a></p>
<p style="color:#64748b;font-size:12px">You set these alerts yourself or left WayTara's smart alerts on. <a href="${esc(input.settingsUrl)}" style="color:#64748b">Change or switch them off</a> in Settings &gt; Notifications.<br>- The WayTara Team</p>
</div>`;
  return { subject, text, html };
}
