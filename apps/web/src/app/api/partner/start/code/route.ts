import { NextRequest, NextResponse, after } from "next/server";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { fail } from "@/lib/partner-track-api";
import { findTrackedRecord } from "@/lib/partner-track-server";
import { issueCode } from "@/lib/partner-otp-server";
import { sendMail } from "@/lib/send-mail";
import { buildPartnerCodeMail } from "@/lib/partner-mail";

/**
 * Sends the applicant a 6-digit code at the e-mail address on their application. The link they came from only says WHICH application; it proves nothing, and the code
 * goes only to the address on file, so a leaked link lets nobody in. Limited per address and per application.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await allowRequest("partner-start:code-ip", clientIp(req.headers), 12, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const app = typeof body?.token === "string" ? await findTrackedRecord(body.token) : null;
    if (!app) return fail("This link is not active.", 404);
    if (app.profileId) return fail("You already have an account. Sign in with your e-mail address and password.", 409);
    if (!(await allowRequest("partner-start:code-app", app.id, 6, 60 * 60))) return fail("Too many codes were asked for. Please try again in an hour.", 429);

    const issued = await issueCode(app.id);
    if (!issued.ok) return fail(issued.error, issued.status);
    after(() => sendMail(app.email, buildPartnerCodeMail(app.contactName, issued.code)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API /api/partner/start/code error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
