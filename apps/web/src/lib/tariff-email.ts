import { CATEGORY_LABEL, type TariffCategory } from "./tariff";
import { fmtDate } from "./savings";
import { renderMail } from "@waytara/ui/mail-layout";

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


/** The e-mail a customer gets when the electricity rate used for their savings changes. */
export function buildTariffEmail(input: TariffEmailInput): { subject: string; text: string; html: string } {
  const up = input.newRate > input.oldRate;
  const subject = `Electricity rate ${up ? "up" : "down"} in ${input.state}: your savings now use ₹${input.newRate.toFixed(2)}/kWh`;
  const greeting = `Hi ${input.customerName ?? "there"},`;
  const where = input.siteNames.length > 0 ? ` for ${input.siteNames.join(", ")}` : "";
  const lead = `The ${CATEGORY_LABEL[input.category]} electricity rate in ${input.state} changed from ₹${input.oldRate.toFixed(2)} to ₹${input.newRate.toFixed(2)} per kWh from ${fmtDate(input.effectiveFrom)}.`;
  const effect = `From that date your Cost & Savings page values each unit at the new rate${where}; earlier months keep the rate they had.`;
  const { html, text } = renderMail({
    preheader: lead,
    title: subject,
    greeting,
    blocks: [
      { type: "p", text: lead },
      { type: "p", text: effect },
      { type: "note", text: "Rates are an estimate of the typical charge for your kind of property; your own bill depends on your slab and fixed charges." },
    ],
    button: { label: "See your savings", url: input.dashboardUrl },
    why: "You get this e-mail because the electricity rate used for your savings changed.",
    audience: "customer",
  });
  return { subject, text, html };
}

/** Sends it; never throws (a failed e-mail must not stop the daily job). Returns whether the message was accepted. */
export async function sendTariffEmail(to: string, input: Omit<TariffEmailInput, "dashboardUrl">): Promise<boolean> {
  if ((process.env.DEVICE_ALERT_EMAILS ?? "on").toLowerCase() === "off") return false;
  const dashboardUrl = `${process.env.CUSTOMER_APP_URL || "https://www.waytaraenergy.com"}/dashboard/performance`;
  // loaded here, not at the top, so the builder above can be used (and tested) without the server-only sender
  const { sendMail } = await import("./send-mail");
  return (await sendMail(to, buildTariffEmail({ ...input, dashboardUrl }))) === "sent";
}
