import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@waytara/supabase/server";
import { notifyTeamOfNewLead } from "@/lib/notify-team";

const leadSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(6, "Phone is required"),
  message: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  source: z
    .enum(["contact_page", "solutions_page", "energy_planner", "package_card"])
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
  estimatedSolarKw: z.coerce.number().optional(),
  estimatedBatteryKwh: z.coerce.number().optional(),
  // Honeypot: real visitors never see or fill this field (see the forms'
  // `website` input, positioned off-screen). Bots that blanket-fill every
  // field trip it.
  website: z.string().optional(),
});

// In-memory sliding-window rate limit, per IP. Resets on cold start and
// isn't shared across serverless instances — a real deterrent against
// basic scripted spam, not a guarantee against a determined/distributed
// attacker. Upstash/Vercel KV would fix that gap if it becomes one.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const submissionLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (submissionLog.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  submissionLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

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
    ["Estimated solar", data.estimatedSolarKw ? `${data.estimatedSolarKw} kW` : undefined],
    ["Estimated battery", data.estimatedBatteryKwh ? `${data.estimatedBatteryKwh} kWh` : undefined],
  ];
  const extraLines = extras
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `${label}: ${value}`);

  if (extraLines.length) {
    if (lines.length) lines.push("");
    lines.push(...extraLines);
  }

  return lines.length ? lines.join("\n") : null;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (isRateLimited(ip)) {
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
    const email = data.email || `${data.phone}@no-email.waytaraenergy-lead.invalid`;

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

    // Doesn't block the response — the lead is already saved, which matters
    // more than the notification. notifyTeamOfNewLead handles its own
    // errors internally and never throws.
    void notifyTeamOfNewLead({
      id,
      full_name: data.fullName,
      email,
      phone: data.phone,
      message,
      address,
      source: data.source,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("API /api/leads error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
