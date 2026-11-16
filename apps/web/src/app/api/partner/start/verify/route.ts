import { NextRequest, NextResponse } from "next/server";
import { isPlausibleCode } from "@waytara/supabase/partner-otp";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { fail } from "@/lib/partner-track-api";
import { findTrackedRecord } from "@/lib/partner-track-server";
import { checkCode } from "@/lib/partner-otp-server";

/** Checks the typed code. Right: a one-time proof for the next step (choosing a password). Wrong, expired or too many tries: a plain message, nothing else changes. */
export async function POST(req: NextRequest) {
  try {
    if (!(await allowRequest("partner-start:verify-ip", clientIp(req.headers), 30, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
    const body = (await req.json().catch(() => null)) as { token?: unknown; code?: unknown } | null;
    const app = typeof body?.token === "string" ? await findTrackedRecord(body.token) : null;
    if (!app) return fail("This link is not active.", 404);
    if (app.profileId) return fail("You already have an account. Sign in with your e-mail address and password.", 409);
    if (!isPlausibleCode(body?.code)) return fail("Type the 6 digits from the e-mail.", 400);

    const result = await checkCode(app.id, body.code);
    if (!result.ok) return fail(result.error, result.status);
    return NextResponse.json({ success: true, data: { proof: result.proof } });
  } catch (error) {
    console.error("API /api/partner/start/verify error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
