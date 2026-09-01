import { Resend } from "resend";

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
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: "Your WayTara installation is scheduled",
      text: [
        `Hi ${input.name ?? "there"},`,
        ``,
        `Your installation is scheduled for ${formattedDate}, ${SLOT_LABELS[input.timeSlot]} slot.`,
        `Our installer will arrive at your site during that window — please make sure someone is available to let them in.`,
        ``,
        `— The WayTara Team`,
      ].join("\n"),
    });

    if (error) {
      console.error("[send-install-scheduled-email] Resend rejected the send:", error);
    }
  } catch (error) {
    console.error("[send-install-scheduled-email] Resend send failed:", error);
  }
}
