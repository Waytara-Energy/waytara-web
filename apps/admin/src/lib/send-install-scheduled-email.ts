import { Resend } from "resend";
import { renderMail } from "@waytara/ui/mail-layout";

export interface InstallScheduledEmailInput {
  to: string;
  name: string | null;
  scheduledDate: string;
  timeSlot: "morning" | "afternoon" | "evening";
}

const SLOT_LABELS: Record<InstallScheduledEmailInput["timeSlot"], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/**
 * Onboarding pipeline redesign, Phase 8: fires when an employee (re)sets
 * the installation date and time slot — until now, scheduling silently
 * updated a timestamp with no customer notification at all. Same
 * non-fatal-if-unconfigured / explicit-error-check pattern as every other
 * Resend sender in this codebase.
 */
export async function sendInstallScheduledEmail(input: InstallScheduledEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[send-install-scheduled-email] RESEND_API_KEY not set — skipping send.");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || "WayTara Energy <onboarding@resend.dev>";
  const formattedDate = new Date(input.scheduledDate).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const resend = new Resend(apiKey);

  try {
    const { html, text } = renderMail({
      preheader: `Your installation is scheduled for ${formattedDate}.`,
      title: "Your installation is scheduled",
      greeting: `Hi ${input.name ?? "there"},`,
      blocks: [
        { type: "facts", rows: [["Date", formattedDate], ["Slot", SLOT_LABELS[input.timeSlot]]] },
        { type: "p", text: "Our installer will arrive at your site during that window. Please make sure someone is available to let them in." },
      ],
      why: "You get this e-mail because the date of your installation was set or changed.",
      audience: "public",
    });
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: "Your WayTara installation is scheduled",
      text,
      html,
    });

    if (error) {
      console.error("[send-install-scheduled-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-install-scheduled-email] Resend send failed:", error);
  }
}
