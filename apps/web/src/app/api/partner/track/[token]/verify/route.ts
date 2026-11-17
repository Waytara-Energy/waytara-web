import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PARTNER_KINDS } from "@waytara/supabase/partner-verify-rules";
import { fail, openEditable } from "@/lib/partner-track-api";
import { partnerCheckViews, runForPartner } from "@/lib/partner-verify-server";

const schema = z.object({ kinds: z.array(z.enum(["pan", "gstin", "udyam", "bank"])).min(1).max(4) });

/** Whether automatic checks are set up, and what the partner has already found out about their PAN, GST number and bank account. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "verify", 120);
    if (opened instanceof NextResponse) return opened;
    return NextResponse.json({ success: true, data: await partnerCheckViews(opened.app.id, opened.app.partnerType) });
  } catch (error) {
    console.error("API /api/partner/track/verify error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}

/**
 * The partner checks their own PAN, GST number or bank account before sending, so a typing slip is found at once and not by the team days later. Each can be asked for a
 * few times only (so this cannot be used to look up other people's numbers), and the answer says whether it matched, never what the source holds about them.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "verify-run", 30);
    if (opened instanceof NextResponse) return opened;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success || !parsed.data.kinds.every((k) => PARTNER_KINDS.includes(k))) return fail("Please choose what to check.", 400);
    // what is on the page is what is checked: the partner's latest typing has been saved before this is asked (the page waits for its save)
    return NextResponse.json({ success: true, data: await runForPartner(opened.app.id, opened.app.partnerType, parsed.data.kinds) });
  } catch (error) {
    console.error("API /api/partner/track/verify run error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
