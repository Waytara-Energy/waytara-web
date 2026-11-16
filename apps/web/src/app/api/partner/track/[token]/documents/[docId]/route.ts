import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { fail, openEditable } from "@/lib/partner-track-api";
import { PARTNER_BUCKET } from "@/lib/partner-onboarding-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Takes back a file the applicant sent (before they send the whole onboarding): the row, then the file in the bucket. Only their own application's files can be reached. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  try {
    const { token, docId } = await params;
    const opened = await openEditable(req.headers, token, "documents", 120);
    if (opened instanceof NextResponse) return opened;
    if (!UUID.test(docId)) return fail("Not found.", 404);

    const db = createServiceRoleClient();
    const { data: row } = await db.from("partner_documents").delete().eq("id", docId).eq("application_id", opened.app.id).select("storage_path").maybeSingle();
    if (!row) return fail("Not found.", 404);
    // the row is the record; if the file cannot be removed it is only left unused in the bucket
    await db.storage.from(PARTNER_BUCKET).remove([row.storage_path]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API /api/partner/track/documents delete error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
