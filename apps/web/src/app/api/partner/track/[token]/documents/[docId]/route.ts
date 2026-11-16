import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { fail, openDocuments, openOwn } from "@/lib/partner-track-api";
import { PARTNER_BUCKET } from "@/lib/partner-onboarding-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A partner opening one of their own files again (to look at it, or with ?download=1 to save it). Only the signed-in partner, and only a file of their own
 * application: the bucket is private, so this makes an address that works for one minute and sends the browser there. The address is never stored or shown.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  try {
    const { token, docId } = await params;
    const opened = await openOwn(req.headers, token, "open", 300);
    if (opened instanceof NextResponse) return opened;
    if (!UUID.test(docId)) return fail("Not found.", 404);

    const db = createServiceRoleClient();
    const { data: row } = await db.from("partner_documents").select("file_name, storage_path").eq("id", docId).eq("application_id", opened.app.id).maybeSingle();
    if (!row) return fail("Not found.", 404);
    const download = req.nextUrl.searchParams.get("download") === "1";
    const { data, error } = await db.storage.from(PARTNER_BUCKET).createSignedUrl(row.storage_path, 60, download ? { download: row.file_name } : undefined);
    if (error || !data) return fail("The file couldn't be opened. Please try again.", 502);
    const res = NextResponse.redirect(data.signedUrl);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  } catch (error) {
    console.error("API /api/partner/track/documents open error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}

/** Takes back a file the partner sent: the row, then the file in the bucket. Only their own application's files can be reached, and not while we are verifying them. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  try {
    const { token, docId } = await params;
    const opened = await openDocuments(req.headers, token, "documents", 240);
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
