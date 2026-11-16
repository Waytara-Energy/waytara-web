import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient } from "@waytara/supabase/server";
import { accessExpiry, newAccessToken } from "@waytara/supabase/partner-access";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerAckMail, buildPartnerAdminMail } from "@/lib/partner-mail";
import { PARTNER_REFERENCE_CODE, PARTNER_TYPE_IDS, TN_DISTRICTS, checkPartnerAnswers, makePartnerReference } from "@/lib/partner-network";
import { createServiceRoleClient } from "@waytara/supabase/service-role";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional());
const district = z.enum(TN_DISTRICTS as [string, ...string[]]);

// The short first-stage application of the Partner Network: who they are, where they work, and the few questions of their kind (checked by
// checkPartnerAnswers). No documents, licences or team details at this stage.
const partnerSchema = z.object({
  type: z.enum(PARTNER_TYPE_IDS),
  contactName: z.string().trim().min(2, "Your name is required").max(200),
  phone: z.string().trim().min(6, "A mobile number is required").max(32),
  email: z.string().trim().email("A valid e-mail is required").max(320),
  district,
  otherDistricts: z.array(district).max(40).default([]),
  answers: z.record(z.string(), z.unknown()),
  message: optionalText(2000),
  // Honeypot: real visitors never see or fill this field.
  website_url: z.string().optional(),
  // The applicant ticked the terms, privacy and partner-agreement box.
  consent: z.literal(true, { message: "Please agree to the terms to send your application" }),
});

// Per client IP, plus a global ceiling, the same way as the enquiry form (Postgres-backed limiter).
const PER_IP_MAX = 3;
const PER_IP_WINDOW_SECONDS = 60 * 60;
const GLOBAL_MAX = 100;
const GLOBAL_WINDOW_SECONDS = 60 * 60;

function adminRecipients(): string[] {
  const raw = process.env.PARTNERS_NOTIFICATION_EMAIL || process.env.LEADS_NOTIFICATION_EMAIL || "hello@waytaraenergy.com";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const allowed = (await allowRequest("partners:ip", ip, PER_IP_MAX, PER_IP_WINDOW_SECONDS)) && (await allowRequest("partners:global", "all", GLOBAL_MAX, GLOBAL_WINDOW_SECONDS));
    if (!allowed) {
      return NextResponse.json({ success: false, error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const parsed = partnerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Please check the form and try again.", details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // Honeypot tripped: pretend it worked so the bot learns nothing, but store and send nothing.
    if (d.website_url) return NextResponse.json({ success: true, data: { id: "ok", reference: "WTP-0000-00000" } });

    const checked = checkPartnerAnswers(d.type, d.answers);
    if (!checked.ok) return NextResponse.json({ success: false, error: checked.error }, { status: 400 });
    const { qa, services, byKey } = checked.value;

    const others = d.otherDistricts.filter((x, i, all) => x !== d.district && all.indexOf(x) === i);
    // What the old list view shows at a glance: a contractor's licence, or a technician's competency certificate.
    const certifications = d.type === "contractor" ? `TNELB licence: ${byKey.tnelb}${byKey.tnelb_grade ? ` (grade ${byKey.tnelb_grade})` : ""}` : d.type === "technician" ? `Wireman or Supervisor certificate: ${byKey.certificate}` : null;

    // Generated here, not read back: the insert-only role cannot select the row (see the migration).
    const id = crypto.randomUUID();
    // The tracking link: only the hash of its code is stored; the code goes to the applicant in the confirmation e-mail.
    const access = newAccessToken();
    const row = {
      id,
      access_token_hash: access.hash,
      access_expires_at: accessExpiry(),
      partner_type: d.type,
      // a technician has no company: the person's own name stands in for it in the admin list
      company_name: byKey.business ?? d.contactName,
      contact_name: d.contactName,
      phone: d.phone,
      email: d.email,
      website: null,
      states: ["Tamil Nadu"],
      cities: others.length > 0 ? `${d.district}; also ${others.join(", ")}` : d.district,
      services,
      years_in_business: null,
      installs_completed: null,
      team_size: null,
      certifications,
      message: d.message ?? null,
      answers: qa,
      // The form only sends when the terms box is ticked (the schema requires it): this records when.
      terms_accepted_at: new Date().toISOString(),
    };

    const supabase = await createClient();
    // The reference counts up by kind of partner (WTP-261116-EC0001), numbered by the database so two applications at once never share a number. If that cannot be
    // done just now the older random form is used, so an application is never lost over a reference; a clash (unique index) is tried again with another.
    let reference = "";
    let failed: { message: string } | null = null;
    const numbered = await createServiceRoleClient().rpc("next_partner_reference", { p_kind: PARTNER_REFERENCE_CODE[d.type] });
    for (let attempt = 0; attempt < 3; attempt++) {
      reference = attempt === 0 && typeof numbered.data === "string" && numbered.data ? numbered.data : makePartnerReference(new Date(), secureRandom);
      const { error } = await supabase.from("partner_applications").insert({ ...row, reference });
      failed = error;
      if (!error || error.code !== "23505") break;
    }
    if (failed) {
      console.error("API /api/partners insert error:", failed);
      return NextResponse.json({ success: false, error: "Couldn't save your application. Please try again." }, { status: 500 });
    }

    // Saved is what matters: the e-mails are best effort and never block or fail the response (sendMail never throws). They go out after the response
    // is sent and are registered with `after` so the host finishes them (started with `void` they could be cut off when the answer was returned).
    const adminUrl = process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com";
    const adminMail = buildPartnerAdminMail({ ...row, reference, district: d.district, otherDistricts: others }, adminUrl);
    const trackUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || SITE.url).replace(/\/+$/, "")}/partner/start?t=${access.token}`;
    after(() => Promise.all([...adminRecipients().map((to) => sendMail(to, adminMail)), sendMail(d.email, buildPartnerAckMail(d.contactName, reference, trackUrl))]));

    return NextResponse.json({ success: true, data: { id, reference } });
  } catch (error) {
    console.error("API /api/partners error:", error);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
