import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient } from "@waytara/supabase/server";
import { notifyTeamOfNewLead } from "@/lib/notify-team";
import { acknowledgeLead } from "@/lib/lead-ack";
import { allowRequest, clientIp } from "@/lib/rate-limit";

const leadSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().trim().email("A valid e-mail is required"),
  phone: z.string().min(6, "Phone is required"),
  message: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  source: z
    .enum(["contact_page", "solutions_page", "energy_planner", "package_card", "platform_compatibility", "support_request"])
    .default("contact_page"),
  segment: z.enum(["home", "commercial", "ev_fleet"]).optional(),
  packageId: z.string().optional(),
  // Energy planner context — no dedicated columns on `leads` for these, so
  // they get folded into `message` as readable context instead.
  propertyType: z.string().optional(),
  monthlyBill: z.coerce.number().optional(),
  backupNeeds: z.string().optional(),
  evPlans: z.string().optional(),
  roofType: z.string().optional(),
  recommendedPackage: z.string().optional(),
  // Energy Planner: what the visitor asked for next, and their answers with the recommendation as text.
  nextStep: z.string().max(80).optional(),
  plannerSummary: z.string().max(3000).optional(),
  // Platform page compatibility check: what the visitor already has. Folded into `message` like the planner context above.
  // Public support page: what kind of problem it is.
  supportTopic: z.string().max(80).optional(),
  existingEquipment: z.string().max(300).optional(),
  equipmentDetails: z.string().max(1000).optional(),
  ocppVersion: z.string().max(40).optional(),
  estimatedSolarKw: z.coerce.number().optional(),
  estimatedBatteryKwh: z.coerce.number().optional(),
  // Honeypot: real visitors never see or fill this field (see the forms'
  // `website` input, positioned off-screen). Bots that blanket-fill every
  // field trip it.
  website: z.string().optional(),
});

// Rate limiting is Postgres-backed (see lib/rate-limit.ts): per client IP, plus
// a global ceiling so a distributed flood still can't spam the team inbox.
const PER_IP_MAX = 5;
const PER_IP_WINDOW_SECONDS = 10 * 60;
const GLOBAL_MAX = 300;
const GLOBAL_WINDOW_SECONDS = 60 * 60;

const MAX_MESSAGE = 5000;

function formatContext(data: z.infer<typeof leadSchema>): string | null {
  const lines: string[] = [];
  if (data.message) lines.push(data.message);

  const extras: [string, unknown][] = [
    ["Segment", data.segment],
    ["Package", data.packageId],
    ["Property type", data.propertyType],
    ["Monthly bill", data.monthlyBill ? `₹${data.monthlyBill}` : undefined],
    ["Backup needs", data.backupNeeds],
    ["EV plans", data.evPlans],
    ["Roof type", data.roofType],
    ["Recommended package", data.recommendedPackage],
    ["Support topic", data.supportTopic],
    ["Existing equipment", data.existingEquipment],
    ["Make and model", data.equipmentDetails],
    ["Charger OCPP version", data.ocppVersion],
    ["Estimated solar", data.estimatedSolarKw ? `${data.estimatedSolarKw} kW` : undefined],
    ["Estimated battery", data.estimatedBatteryKwh ? `${data.estimatedBatteryKwh} kWh` : undefined],
  ];
  if (data.nextStep) extras.unshift(["Next step requested", data.nextStep]);
  const extraLines = extras
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `${label}: ${value}`);

  if (extraLines.length) {
    if (lines.length) lines.push("");
    lines.push(...extraLines);
  }
  if (data.plannerSummary) {
    if (lines.length) lines.push("");
    lines.push("--- Energy Planner ---", data.plannerSummary);
  }

  if (lines.length === 0) return null;
  const text = lines.join("\n");
  // leads.message is limited to 5000 characters by the database: shorten rather than reject a real enquiry.
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE - 1)}…` : text;
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);

    const allowed =
      (await allowRequest("leads:ip", ip, PER_IP_MAX, PER_IP_WINDOW_SECONDS)) &&
      (await allowRequest("leads:global", "all", GLOBAL_MAX, GLOBAL_WINDOW_SECONDS));
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parseResult = leadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Honeypot tripped — pretend success so the bot doesn't learn anything,
    // but don't insert or email.
    if (data.website) {
      return NextResponse.json({ success: true, data: { id: "ok" } });
    }

    const address =
      data.city || data.pincode
        ? { city: data.city || undefined, pincode: data.pincode || undefined }
        : null;
    const message = formatContext(data);
    const email = data.email;

    // Deliberately not `.select()`-ing the row back: the anon role that
    // inserts these is insert-only by design (see the migration) — it has
    // no SELECT grant on `leads`, so `.select()` here would fail the same
    // way it would for a real anonymous visitor. Generate our own id
    // up front instead of reading back the DB-assigned one.
    const id = crypto.randomUUID();

    const supabase = await createClient();
    const { error } = await supabase.from("leads").insert({
      id,
      full_name: data.fullName,
      email,
      phone: data.phone,
      message,
      address,
      source: data.source,
    });

    if (error) {
      console.error("API /api/leads insert error:", error);
      return NextResponse.json(
        { success: false, error: "Couldn't save your request. Please try again." },
        { status: 500 }
      );
    }

    // The lead is saved, which matters most. The e-mails (one to the team, one confirming to the person) go out after the response is sent, and are
    // registered with `after` so the host finishes them: started with `void` they could be cut off the moment the answer was returned, and the team's
    // notice would sometimes never arrive. Both handle their own errors and never throw.
    const lead = { id, full_name: data.fullName, email, phone: data.phone, message, address, source: data.source };
    after(() => Promise.all([notifyTeamOfNewLead(lead), acknowledgeLead(lead)]));

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("API /api/leads error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
