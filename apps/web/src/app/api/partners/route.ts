import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@waytara/supabase/server";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerAckMail, buildPartnerAdminMail } from "@/lib/partner-mail";
import { PARTNER_INSTALL_RANGES, PARTNER_SERVICES, PARTNER_STATES, PARTNER_TEAM_SIZES } from "@/lib/partner-options";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional());

const partnerSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(200),
  contactName: z.string().trim().min(2, "Contact name is required").max(200),
  phone: z.string().trim().min(6, "Phone is required").max(32),
  email: z.string().trim().email("A valid e-mail is required").max(320),
  website: optionalText(300),
  states: z.array(z.enum(PARTNER_STATES)).min(1, "Choose at least one state").max(40),
  cities: optionalText(1000),
  services: z.array(z.enum(PARTNER_SERVICES.map((s) => s.id) as [string, ...string[]])).min(1, "Choose at least one service").max(10),
  yearsInBusiness: z.preprocess(blank, z.coerce.number().int().min(0).max(100).optional()),
  installsCompleted: z.preprocess(blank, z.enum(PARTNER_INSTALL_RANGES).optional()),
  teamSize: z.preprocess(blank, z.enum(PARTNER_TEAM_SIZES).optional()),
  certifications: optionalText(1000),
  message: optionalText(5000),
  // Honeypot: real visitors never see or fill this field.
  website_url: z.string().optional(),
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
    if (d.website_url) return NextResponse.json({ success: true, data: { id: "ok" } });

    // Generated here, not read back: the insert-only role cannot select the row (see the migration).
    const id = crypto.randomUUID();
    const row = {
      id,
      company_name: d.companyName,
      contact_name: d.contactName,
      phone: d.phone,
      email: d.email,
      website: d.website ?? null,
      states: d.states,
      cities: d.cities ?? null,
      services: d.services,
      years_in_business: d.yearsInBusiness ?? null,
      installs_completed: d.installsCompleted ?? null,
      team_size: d.teamSize ?? null,
      certifications: d.certifications ?? null,
      message: d.message ?? null,
    };

    const supabase = await createClient();
    const { error } = await supabase.from("partner_applications").insert(row);
    if (error) {
      console.error("API /api/partners insert error:", error);
      return NextResponse.json({ success: false, error: "Couldn't save your application. Please try again." }, { status: 500 });
    }

    // Saved is what matters: the e-mails are best effort and never block or fail the response (sendMail never throws).
    const adminUrl = process.env.ADMIN_APP_URL || "https://admin.waytaraenergy.com";
    const adminMail = buildPartnerAdminMail({ ...row }, adminUrl);
    for (const to of adminRecipients()) void sendMail(to, adminMail);
    void sendMail(d.email, buildPartnerAckMail(d.contactName, d.companyName));

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("API /api/partners error:", error);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
