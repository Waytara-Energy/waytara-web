import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { memberSubject } from "@waytara/supabase/partner-onboarding";
import { fail } from "@/lib/partner-track-api";
import { openCrew } from "@/lib/partner-crew-server";
import { PARTNER_BUCKET } from "@/lib/partner-onboarding-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A team member looking at (or with ?download=1 saving) one of the files THEY sent: only files filed under them, through a one-minute address. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  try {
    const { token, docId } = await params;
    const s = await openCrew(req.headers, token, "open", 200);
    if (s instanceof NextResponse) return s;
    if (!UUID.test(docId)) return fail("Not found.", 404);

    const db = createServiceRoleClient();
    const { data: row } = await db.from("partner_documents").select("file_name, storage_path").eq("id", docId).eq("application_id", s.app.id).eq("subject", memberSubject(s.key)).maybeSingle();
    if (!row) return fail("Not found.", 404);
    const download = req.nextUrl.searchParams.get("download") === "1";
    const { data, error } = await db.storage.from(PARTNER_BUCKET).createSignedUrl(row.storage_path, 60, download ? { download: row.file_name } : undefined);
    if (error || !data) return fail("The file couldn't be opened. Please try again.", 502);
    const res = NextResponse.redirect(data.signedUrl);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  } catch (error) {
    console.error("API /api/partner/crew/documents open error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}

/** Takes back a file the team member sent: only their own. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  try {
    const { token, docId } = await params;
    const s = await openCrew(req.headers, token, "documents", 120);
    if (s instanceof NextResponse) return s;
    if (!UUID.test(docId)) return fail("Not found.", 404);

    const db = createServiceRoleClient();
    const { data: row } = await db.from("partner_documents").delete().eq("id", docId).eq("application_id", s.app.id).eq("subject", memberSubject(s.key)).select("storage_path").maybeSingle();
    if (!row) return fail("Not found.", 404);
    await db.storage.from(PARTNER_BUCKET).remove([row.storage_path]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API /api/partner/crew/documents delete error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
