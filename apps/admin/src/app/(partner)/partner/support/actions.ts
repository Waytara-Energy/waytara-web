"use server";

import { requirePartner } from "@/lib/partner-context";
import { sendPartnerMessageEmail } from "@/lib/send-partner-message-email";

/** Sends the partnerships team a message from the signed-in partner. It fails loudly (so the partner knows it did not go) rather than pretending. */
export async function sendPartnerMessage(formData: FormData): Promise<void> {
  const { application } = await requirePartner();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (subject.length < 3 || subject.length > 120) throw new Error("Give your message a short subject (3 to 120 characters).");
  if (message.length < 5 || message.length > 3000) throw new Error("Write your message (5 to 3000 characters).");

  const result = await sendPartnerMessageEmail({
    from: { name: application.contact_name, email: application.email, company: application.company_name, reference: application.reference },
    subject,
    message,
    adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL || process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com",
    applicationId: application.id,
  });
  if (result === "failed") throw new Error("We couldn't send your message just now. Please try again, or e-mail us directly.");
}
