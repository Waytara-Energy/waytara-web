import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { onboardingGaps } from "@waytara/supabase/partner-onboarding";
import { digilockerCoveredSubjects } from "@waytara/supabase/partner-digilocker";
import { fail, openEditable } from "@/lib/partner-track-api";
import { loadOnboarding } from "@/lib/partner-onboarding-server";
import { signedAgreement } from "@/lib/partner-agreement-server";
import { runAllForSubmitted } from "@/lib/partner-verify-server";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerSubmittedAckMail, buildPartnerSubmittedAdminMail } from "@/lib/partner-mail";

const schema = z.object({ declaration: z.literal(true), safety: z.literal(true) });

function adminRecipients(): string[] {
  const raw = process.env.PARTNERS_NOTIFICATION_EMAIL || process.env.LEADS_NOTIFICATION_EMAIL || "hello@waytaraenergy.com";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The applicant sends their onboarding for verification. Everything we truly need must be there (checked here, not only on the page), and they must have ticked the
 * declaration. It is then locked (the page becomes read-only), the application moves to Verification, and the team and the applicant are told.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "submit", 30);
    if (opened instanceof NextResponse) return opened;
    const { app } = opened;

    if (!schema.safeParse(await req.json().catch(() => null)).success) return fail("Please tick both boxes: that what you sent is true, and that you will follow the safety rules.", 400);

    const state = await loadOnboarding(app.id);
    // a person verified through DigiLocker (and whose name on the form is still the one that was verified) need not send a photo ID
    const covered = await digilockerCoveredSubjects(createServiceRoleClient(), app.id, state.data);
    const gaps = onboardingGaps(app.partnerType, state.data, state.documents, new Date(), covered);
    if (gaps.length > 0) return fail("A few things are still missing.", 400, { gaps });
    // the partner agreement of the current version must have been accepted with the e-mail code before it can be sent
    if (!(await signedAgreement(app.id))) return fail("Please read and sign the partner agreement first.", 400);

    const db = createServiceRoleClient();
    // Locked first, only if it is still open (so two quick clicks cannot send it twice).
    const { data: locked } = await db
      .from("partner_onboarding")
      .update({ submitted_at: new Date().toISOString() })
      .eq("application_id", app.id)
      .is("submitted_at", null)
      .select("application_id")
      .maybeSingle();
    if (!locked) return fail("You have already sent this.", 409);

    // the team's note (a request for more, say) is answered by this, so it is cleared rather than left on the Verification page
    const { error } = await db.from("partner_applications").update({ status: "verification", status_message: null, status_message_at: null }).eq("id", app.id).eq("status", "onboarding");
    if (error) {
      console.error("API /api/partner/track/submit status error:", error);
      // put it back so they can try again rather than being stuck with a locked page and an unmoved application
      await db.from("partner_onboarding").update({ submitted_at: null }).eq("application_id", app.id);
      return fail("Couldn't send it just now. Please try again.", 500);
    }

    const adminUrl = process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com";
    const reference = app.reference ?? "";
    const adminMail = buildPartnerSubmittedAdminMail({ id: app.id, reference, company_name: app.companyName, partner_type: app.partnerType ?? "", documents: state.documents.length }, adminUrl);
    // the e-mails, and the automatic checks (PAN, GST, bank, names, faces) so the team finds their results ready: both after the answer, neither able to fail it
    after(() => Promise.all([...adminRecipients().map((to) => sendMail(to, adminMail)), sendMail(app.email, buildPartnerSubmittedAckMail(app.contactName, reference)), runAllForSubmitted(app.id, app.partnerType)]));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API /api/partner/track/submit error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
