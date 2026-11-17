import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { fail } from "@/lib/partner-track-api";
import { openCrew } from "@/lib/partner-crew-server";

/** "I have added everything": marks the link completed, which the partner sees beside the person's name. The files are already saved; this only says the person is done. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const s = await openCrew(req.headers, token, "done", 60);
    if (s instanceof NextResponse) return s;
    const now = new Date().toISOString();
    const { error } = await createServiceRoleClient().from("partner_crew_invites").update({ status: "completed", completed_at: now, opened_at: now }).eq("id", s.invite.id).in("status", ["sent", "opened", "completed"]);
    if (error) return fail("Couldn't save that. Please try again.", 500);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API /api/partner/crew error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
