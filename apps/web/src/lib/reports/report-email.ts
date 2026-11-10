import "server-only";
import { fmtDate } from "@/lib/savings";
import { reportHeadline } from "./custom-report-csv";
import type { CustomReport } from "./custom-report";
import { renderMail } from "@waytara/ui/mail-layout";


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
  const { html, text } = renderMail({
    preheader: headline,
    title: subject,
    greeting: `Hi ${input.customerName},`,
    blocks: [
      { type: "p", text: `Here is your report "${report.name}" for ${period}.` },
      { type: "quote", label: "In short", text: headline },
      ...(files ? ([{ type: "p", text: files }] as const) : []),
      { type: "note", text: "Figures come from the inverter's own counters, not the electricity board's meter, and are estimates." },
    ],
    button: { label: "Open Reports", url: input.dashboardUrl },
    why: `${input.why}.`,
    audience: "customer",
  });
  return { subject, text, html };
}

/** Sends the e-mail with the report files attached. Never throws: returns an error text when it could not be sent. */
export async function sendReportEmail(to: string[], mail: { subject: string; text: string; html: string }, attachments: { filename: string; content: Buffer }[]): Promise<{ ok: true } | { ok: false; error: string }> {
  // loaded here, not at the top, so the builder above can be used (and tested) without the server-only sender
  const { sendMail } = await import("../send-mail");
  const result = await sendMail(to, mail, attachments);
  if (result === "sent") return { ok: true };
  return { ok: false, error: result === "suppressed" ? "E-mail is not set up on this server (RESEND_API_KEY is missing)." : "The e-mail service rejected the message." };
}
