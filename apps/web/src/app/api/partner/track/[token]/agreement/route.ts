import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { AGREEMENT_IS_DRAFT, AGREEMENT_VERSION } from "@waytara/supabase/partner-agreement";
import { isPlausibleCode } from "@waytara/supabase/partner-otp";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { fail, openEditable } from "@/lib/partner-track-api";
import { agreementHash, checkAgreementCode, issueAgreementCode, signedAgreement } from "@/lib/partner-agreement-server";
import { loadOnboarding } from "@/lib/partner-onboarding-server";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerAgreementCodeMail } from "@/lib/partner-mail";

const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("send") }), z.object({ action: z.literal("sign"), code: z.string() })]);

/** Whether the partner has accepted the current agreement. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "agreement", 120);
    if (opened instanceof NextResponse) return opened;
    const signed = await signedAgreement(opened.app.id);
    return NextResponse.json({ success: true, data: { version: AGREEMENT_VERSION, draft: AGREEMENT_IS_DRAFT, signed } });
  } catch (error) {
    console.error("API /api/partner/track/agreement error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}

/**
 * Signing the agreement with an e-mail code. `send` e-mails a 6-digit code to the address we confirmed with the partner; `sign` checks it and, when it is right, records
 * the acceptance: which version, a fingerprint of its exact text, who, the address it came from and when. Only the signed-in partner, and only while onboarding is open.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "agreement-sign", 40);
    if (opened instanceof NextResponse) return opened;
    const { app } = opened;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please try again.", 400);

    if (parsed.data.action === "send") {
      if (!(await allowRequest("partner-agreement:code-app", app.id, 6, 60 * 60))) return fail("Too many codes were asked for. Please try again in an hour.", 429);
      const issued = await issueAgreementCode(app.id);
      if (!issued.ok) return fail(issued.error, issued.status);
      after(() => sendMail(app.email, buildPartnerAgreementCodeMail(app.contactName, issued.code)));
      return NextResponse.json({ success: true });
    }

    if (!isPlausibleCode(parsed.data.code.trim())) return fail("The code is six digits.", 400);
    const already = await signedAgreement(app.id);
    if (already) return NextResponse.json({ success: true, data: already });
    const checked = await checkAgreementCode(app.id, parsed.data.code.trim());
    if (!checked.ok) return fail(checked.error, checked.status);

    const state = await loadOnboarding(app.id);
    const { data, error } = await createServiceRoleClient()
      .from("partner_agreements")
      .insert({
        application_id: app.id,
        version: AGREEMENT_VERSION,
        text_hash: agreementHash(app.partnerType),
        signer_name: state.data.person.name || app.contactName,
        signer_email: app.email,
        signer_ip: clientIp(req.headers).slice(0, 80),
        signer_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
      })
      .select("version, signed_at")
      .single();
    // two quick submits: the second finds it already recorded
    if (error?.code === "23505") return NextResponse.json({ success: true, data: await signedAgreement(app.id) });
    if (error || !data) {
      console.error("API /api/partner/track/agreement insert error:", error);
      return fail("Couldn't record that just now. Please try again.", 500);
    }
    return NextResponse.json({ success: true, data: { version: data.version, signedAt: data.signed_at } });
  } catch (error) {
    console.error("API /api/partner/track/agreement error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
