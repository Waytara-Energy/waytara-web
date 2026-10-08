import { Resend } from "resend";
import { CATEGORY_LABEL, type TariffCategory } from "./tariff";
import { fmtDate } from "./savings";

export interface TariffEmailInput {
  customerName: string | null;
  state: string;
  category: TariffCategory;
  oldRate: number;
  newRate: number;
  effectiveFrom: string;
  /** The customer's sites this applies to. */
  siteNames: string[];
  dashboardUrl: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The e-mail a customer gets when the electricity rate used for their savings changes. */
export function buildTariffEmail(input: TariffEmailInput): { subject: string; text: string; html: string } {
  const up = input.newRate > input.oldRate;
  const subject = `Electricity rate ${up ? "up" : "down"} in ${input.state}: your savings now use ₹${input.newRate.toFixed(2)}/kWh`;
  const greeting = `Hi ${input.customerName ?? "there"},`;
  const where = input.siteNames.length > 0 ? ` for ${input.siteNames.join(", ")}` : "";
  const lead = `The ${CATEGORY_LABEL[input.category]} electricity rate in ${input.state} changed from ₹${input.oldRate.toFixed(2)} to ₹${input.newRate.toFixed(2)} per kWh from ${fmtDate(input.effectiveFrom)}.`;
  const effect = `From that date your Cost & Savings page values each unit at the new rate${where}; earlier months keep the rate they had.`;
  const text = [greeting, "", lead, effect, "", `See your savings: ${input.dashboardUrl}`, "", "Rates are an estimate of the typical charge for your kind of property; your own bill depends on your slab and fixed charges.", "- The WayTara Team"].join("\n");
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:560px">
<p>${esc(greeting)}</p>
<p><strong>${esc(lead)}</strong></p>
<p>${esc(effect)}</p>
<p><a href="${esc(input.dashboardUrl)}" style="background:#16a34a;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none">See your savings</a></p>
<p style="color:#64748b;font-size:12px">Rates are an estimate of the typical charge for your kind of property; your own bill depends on your slab and fixed charges.<br>- The WayTara Team</p>
</div>`;
  return { subject, text, html };
}

/** Sends it through Resend; never throws (a failed e-mail must not stop the daily job). Returns whether Resend accepted it. */
export async function sendTariffEmail(to: string, input: Omit<TariffEmailInput, "dashboardUrl">): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[tariff-email] RESEND_API_KEY not set - skipping send.");
    return false;
  }
  if ((process.env.DEVICE_ALERT_EMAILS ?? "on").toLowerCase() === "off") return false;
  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const dashboardUrl = `${process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com"}/dashboard/performance`;
  const { subject, text, html } = buildTariffEmail({ ...input, dashboardUrl });
  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject, text, html });
    if (error) {
      console.error("[tariff-email] Resend rejected the send:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[tariff-email] Resend send failed:", error);
    return false;
  }
}
