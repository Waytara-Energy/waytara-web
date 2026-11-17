import { NextRequest, NextResponse } from "next/server";
import { CashfreeError, cashfreeConfigured } from "@waytara/supabase/partner-cashfree";
import { fail, openEditable } from "@/lib/partner-track-api";
import { refreshForPartner, startForPartner, viewForPartner } from "@/lib/partner-digilocker-server";

/**
 * The partner's DigiLocker session. GET: where it stands (it asks Cashfree while the partner is still on DigiLocker's page, and completes the session once they have agreed).
 * POST: starts a new session and returns the link to open. The partner never gives us an Aadhaar number, OTP or password: they agree on DigiLocker's own page.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "digilocker", 240);
    if (opened instanceof NextResponse) return opened;
    const configured = cashfreeConfigured();
    if (!configured) return NextResponse.json({ success: true, data: { configured, view: { state: "none", message: "" } } });
    const live = new URL(req.url).searchParams.get("poll") === "1";
    return NextResponse.json({ success: true, data: { configured, view: live ? await refreshForPartner(opened.app.id) : await viewForPartner(opened.app.id) } });
  } catch (error) {
    console.error("API /api/partner/track/digilocker error:", error instanceof Error ? error.message : "unknown");
    return fail("Something went wrong. Please try again.", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "digilocker-start", 12);
    if (opened instanceof NextResponse) return opened;
    return NextResponse.json({ success: true, data: await startForPartner(opened.app.id) });
  } catch (error) {
    if (error instanceof CashfreeError) {
      console.error("API /api/partner/track/digilocker start error:", error.kind, error.code ?? "");
      return fail(error.kind === "config" ? "Verifying with DigiLocker is not available right now. You can fill in your details and send your documents instead." : "We could not open DigiLocker just now. Please try again in a moment.", error.kind === "config" ? 503 : 502);
    }
    console.error("API /api/partner/track/digilocker start error:", error instanceof Error ? error.message : "unknown");
    return fail("Something went wrong. Please try again.", 500);
  }
}
