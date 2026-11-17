import { NextRequest, NextResponse } from "next/server";
import { CashfreeError, cashfreeConfigured } from "@waytara/supabase/partner-cashfree";
import { memberSubject } from "@waytara/supabase/partner-onboarding";
import { fail } from "@/lib/partner-track-api";
import { openCrew } from "@/lib/partner-crew-server";
import { refreshFor, startFor, viewFor } from "@/lib/partner-digilocker-server";

/**
 * A team member's own DigiLocker session, from the link their partner sent them (no account: the long link is the key, and it works only for that person). GET: where it stands
 * (it asks Cashfree while the person is still on DigiLocker's page, and completes the session once they have agreed). POST: starts a new session and returns the link to open.
 * The person never gives us an Aadhaar number, OTP or password: they agree on DigiLocker's own page.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const s = await openCrew(req.headers, token, "digilocker", 240);
    if (s instanceof NextResponse) return s;
    const configured = cashfreeConfigured();
    if (!configured) return NextResponse.json({ success: true, data: { configured, view: { state: "none", message: "" } } });
    const subject = memberSubject(s.key);
    const live = new URL(req.url).searchParams.get("poll") === "1";
    return NextResponse.json({ success: true, data: { configured, view: live ? await refreshFor(s.app.id, subject, s.member.name) : await viewFor(s.app.id, subject) } });
  } catch (error) {
    console.error("API /api/partner/crew/digilocker error:", error instanceof Error ? error.message : "unknown");
    return fail("Something went wrong. Please try again.", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const s = await openCrew(req.headers, token, "digilocker-start", 12);
    if (s instanceof NextResponse) return s;
    return NextResponse.json({ success: true, data: await startFor(s.app.id, memberSubject(s.key)) });
  } catch (error) {
    if (error instanceof CashfreeError) {
      console.error("API /api/partner/crew/digilocker start error:", error.kind, error.code ?? "");
      return fail(error.kind === "config" ? "Verifying with DigiLocker is not available right now. You can add your documents below instead." : "We could not open DigiLocker just now. Please try again in a moment.", error.kind === "config" ? 503 : 502);
    }
    console.error("API /api/partner/crew/digilocker start error:", error instanceof Error ? error.message : "unknown");
    return fail("Something went wrong. Please try again.", 500);
  }
}
