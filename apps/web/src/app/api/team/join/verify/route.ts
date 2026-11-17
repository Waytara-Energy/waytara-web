import { NextRequest, NextResponse } from "next/server";
import { isPlausibleCode } from "@waytara/supabase/partner-otp";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { fail } from "@/lib/partner-track-api";
import { findInvitation } from "@/lib/team-server";
import { checkTeamCode } from "@/lib/team-otp-server";

/** Checks the typed code. Right: a one-time proof for the next step (choosing a password). Wrong, expired or too many tries: a plain message, nothing else changes. */
export async function POST(req: NextRequest) {
  try {
    if (!(await allowRequest("team-join:verify-ip", clientIp(req.headers), 30, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
    const body = (await req.json().catch(() => null)) as { token?: unknown; code?: unknown } | null;
    const inv = typeof body?.token === "string" ? await findInvitation(body.token) : null;
    if (!inv) return fail("This invitation is not active. Ask the person who invited you to send it again.", 404);
    if (!isPlausibleCode(body?.code)) return fail("Type the 6 digits from the e-mail.", 400);

    const result = await checkTeamCode(inv.id, body.code);
    if (!result.ok) return fail(result.error, result.status);
    return NextResponse.json({ success: true, data: { proof: result.proof } });
  } catch (error) {
    console.error("API /api/team/join/verify error:", error instanceof Error ? error.message : "unknown");
    return fail("Something went wrong. Please try again.", 500);
  }
}
