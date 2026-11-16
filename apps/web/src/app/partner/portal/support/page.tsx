import { redirect } from "next/navigation";
import { ActionForm } from "@waytara/ui/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { findSessionRecord } from "@/lib/partner-track-server";
import { sendPartnerMessage } from "../actions";

export const dynamic = "force-dynamic";

/** Support for a partner or an applicant: a message to the partnerships team, answered by e-mail at the address on their account. */
export default async function PartnerSupportPage() {
  const app = await findSessionRecord();
  if (!app) redirect("/login");
  return (
    <main className="fluid-container pb-20">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-tight text-theme-primary">Support</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-theme-secondary">Write to the partnerships team: a change to your e-mail address or the places you cover, a question about a licence, or anything else. We reply to {app.email}.</p>
        </div>
        <ActionForm action={sendPartnerMessage} loading="Sending…" success="Message sent. We will reply by e-mail." className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required minLength={3} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" name="message" rows={7} required minLength={5} maxLength={3000} />
          </div>
          <SubmitButton pendingText="Sending…">Send message</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
