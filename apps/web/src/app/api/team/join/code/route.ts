import { NextRequest, NextResponse, after } from "next/server";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { fail } from "@/lib/partner-track-api";
import { findInvitation } from "@/lib/team-server";
import { issueTeamCode } from "@/lib/team-otp-server";
import { sendMail } from "@/lib/send-mail";
import { buildTeamCodeMail } from "@/lib/team-mail";

/**
 * Sends the invited person a 6-digit code at the e-mail address the invitation was made for. The link only says WHICH invitation it is; it proves nothing, and the code goes
 * only to the address on file, so a leaked link lets nobody in. Limited per address and per invitation.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await allowRequest("team-join:code-ip", clientIp(req.headers), 12, 60 * 60))) return fail("Too many requests. Please try again later.", 429);
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const inv = typeof body?.token === "string" ? await findInvitation(body.token) : null;
    if (!inv) return fail("This invitation is not active. Ask the person who invited you to send it again.", 404);
    if (!(await allowRequest("team-join:code-member", inv.id, 6, 60 * 60))) return fail("Too many codes were asked for. Please try again in an hour.", 429);

    const issued = await issueTeamCode(inv.id);
    if (!issued.ok) return fail(issued.error, issued.status);
    after(() => sendMail(inv.email, buildTeamCodeMail(inv.fullName, issued.code)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API /api/team/join/code error:", error instanceof Error ? error.message : "unknown");
    return fail("Something went wrong. Please try again.", 500);
  }
}
