import { ActionForm } from "@waytara/ui/action-form";
import { FormSubmit } from "@/components/form-submit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePartner } from "@/lib/partner-context";
import { sendPartnerMessage } from "./actions";

export const dynamic = "force-dynamic";

/** Support for a partner: a message to the partnerships team, answered by e-mail at the address on their account. */
export default async function PartnerSupportPage() {
  const { application } = await requirePartner();
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">Write to the partnerships team: a change to your e-mail address or the places you cover, a question about a licence, or anything else. We reply to {application.email}.</p>
      </div>
      <ActionForm action={sendPartnerMessage} loading="Sending…" success="Message sent. We will reply by e-mail." className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" name="subject" required minLength={3} maxLength={120} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="message">Message</Label>
          <textarea id="message" name="message" rows={7} required minLength={5} maxLength={3000} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <FormSubmit pendingText="Sending…">Send message</FormSubmit>
      </ActionForm>
    </div>
  );
}
