import { renderMail } from "@waytara/ui/mail-layout";
import { allowRequest } from "./rate-limit";
import { sendMail } from "./send-mail";
import { SITE } from "./site";
import type { Mail } from "./support-mail";

/** What the website's forms are called in the `source` of a lead. */
export type LeadSource = "contact_page" | "solutions_page" | "energy_planner" | "package_card" | "platform_compatibility" | "support_request";

const WORDS: Record<LeadSource, { subject: string; title: string; body: string }> = {
  contact_page: { subject: "We received your message", title: "We have your message", body: "Thank you for writing to WayTara. Someone from the team will read it and get back to you by phone or e-mail." },
  solutions_page: { subject: "We received your message", title: "We have your message", body: "Thank you for writing to WayTara. Someone from the team will read it and get back to you by phone or e-mail." },
  package_card: { subject: "We received your message", title: "We have your message", body: "Thank you for writing to WayTara. Someone from the team will read it and get back to you by phone or e-mail." },
  energy_planner: { subject: "We received your energy plan request", title: "We have your energy plan request", body: "Thank you for using the WayTara energy planner. An engineer will look at what you sent and get in touch by phone or e-mail." },
  platform_compatibility: { subject: "We received your equipment details", title: "We have your equipment details", body: "Thank you. We will check whether your equipment works with the WayTara platform, and what connecting it would involve, and get back to you by phone or e-mail." },
  support_request: { subject: "We received your support request", title: "We have your support request", body: "Thank you for writing to WayTara support. Someone from the team will get back to you by phone or e-mail." },
};

/**
 * The confirmation to someone who has just sent one of the website's forms. It says we have it and what happens next, and it does not repeat what they
 * wrote (the address may not be theirs), and it makes no promise about when. A person who did not send it is told they can ignore it.
 */
export function buildLeadAckMail(input: { name: string; source: string }): Mail {
  const words = WORDS[input.source as LeadSource] ?? WORDS.contact_page;
  const first = input.name.trim().split(/\s+/)[0] || "there";
  const { html, text } = renderMail({
    preheader: "We have it, and someone will get back to you.",
    title: words.title,
    greeting: `Hi ${first},`,
    blocks: [
      { type: "p", text: words.body },
      ...(input.source === "support_request" ? ([{ type: "p", text: `If it cannot wait, call us on ${SITE.phone}.` }] as const) : []),
      { type: "note", text: "If you did not send this to WayTara, you can ignore this e-mail: nothing will happen." },
    ],
    why: "You get this e-mail because this address was used on a form on the WayTara website.",
    audience: "public",
  });
  return { subject: words.subject, text, html };
}

/** At most this many confirmations to one address in an hour, so a form cannot be used to flood someone else's inbox. */
const ACKS_PER_ADDRESS_PER_HOUR = 2;

/** Sends the confirmation. Never throws: the lead is already saved, and a missing confirmation must never fail the form. */
export async function acknowledgeLead(lead: { full_name: string; email: string; source: string }): Promise<void> {
  try {
    if (!(await allowRequest("lead-ack:address", lead.email.trim().toLowerCase(), ACKS_PER_ADDRESS_PER_HOUR, 60 * 60))) return;
    await sendMail(lead.email, buildLeadAckMail({ name: lead.full_name, source: lead.source }));
  } catch (error) {
    console.error("[lead-ack] could not send the confirmation:", error);
  }
}
