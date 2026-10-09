import "server-only";
import { Resend } from "resend";
import { fmtDate } from "@/lib/savings";
import { reportHeadline } from "./custom-report-csv";
import type { CustomReport } from "./custom-report";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ReportEmailInput {
  customerName: string;
  report: CustomReport;
  /** "Every Monday at 09:30", or "Sent on request". */
  why: string;
  dashboardUrl: string;
  fileNames: string[];
}

export function buildReportEmail(input: ReportEmailInput): { subject: string; text: string; html: string } {
  const { report } = input;
  const period = `${fmtDate(report.period.from)} to ${fmtDate(report.period.to)}`;
  const subject = `${report.name} - ${report.period.label}`;
  const headline = reportHeadline(report);
  const files = input.fileNames.length > 0 ? `Attached: ${input.fileNames.join(", ")}.` : "";
  const text = [
    `Hi ${input.customerName},`,
    "",
    `Here is your report "${report.name}" for ${period}.`,
    headline,
    files,
    "",
    `${input.why}. Open it, change it or stop it any time: ${input.dashboardUrl}`,
    "",
    "Figures come from the inverter's own counters, not the electricity board's meter, and are estimates.",
    "- The WayTara Team",
  ].join("\n");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:560px">
<p>Hi ${esc(input.customerName)},</p>
<p>Here is your report <strong>${esc(report.name)}</strong> for ${esc(period)}.</p>
<p style="background:#f8fafc;border-radius:8px;padding:12px 14px;font-size:15px"><strong>${esc(headline)}</strong></p>
${files ? `<p>${esc(files)}</p>` : ""}
<p><a href="${esc(input.dashboardUrl)}" style="background:#16a34a;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none">Open Reports</a></p>
<p style="color:#64748b;font-size:12px">${esc(input.why)}. Figures come from the inverter&#39;s own counters, not the electricity board&#39;s meter, and are estimates.<br>- The WayTara Team</p>
</div>`;
  return { subject, text, html };
}

/** Sends the e-mail through Resend with the report files attached. Never throws: returns an error text when it could not be sent. */
export async function sendReportEmail(to: string[], mail: { subject: string; text: string; html: string }, attachments: { filename: string; content: Buffer }[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "E-mail is not set up on this server (RESEND_API_KEY is missing)." };
  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject: mail.subject, text: mail.text, html: mail.html, attachments });
    if (error) return { ok: false, error: error.message || "The e-mail service rejected the message." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The e-mail could not be sent." };
  }
}
