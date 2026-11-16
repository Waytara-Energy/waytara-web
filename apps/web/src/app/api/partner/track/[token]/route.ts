import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { readOnboarding } from "@waytara/supabase/partner-onboarding";
import type { Json } from "@waytara/supabase/types";
import { fail, openEditable } from "@/lib/partner-track-api";

/** Saves the applicant's answers as they type (a draft: nothing has to be complete). The server cleans and cuts whatever is sent, and keeps only the known fields. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "save", 600);
    if (opened instanceof NextResponse) return opened;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("Please try again.", 400);
    }
    const data = readOnboarding((body as { data?: unknown } | null)?.data);

    const { error } = await createServiceRoleClient().from("partner_onboarding").upsert({ application_id: opened.app.id, data: data as unknown as Json },{ onConflict: "application_id" });
    if (error) {
      console.error("API /api/partner/track save error:", error);
      return fail("Couldn't save just now. Your changes are still on this page.", 500);
    }
    return NextResponse.json({ success: true, data: { savedAt: new Date().toISOString() } });
  } catch (error) {
    console.error("API /api/partner/track error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
