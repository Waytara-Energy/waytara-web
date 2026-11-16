import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A document an applicant sent, for an admin: `/partners/<application>/files/<document>` opens it (a PDF or a picture shows in the browser) and `?download=1` saves
 * it under its own name. The bucket is private, so this makes a link that works for one minute and sends the browser there; the link is never stored.
 *
 * Every opening is written to the access log FIRST (who, which file, view or download, when), and if that cannot be written the file is not served, so there is no
 * way to read an applicant's document without leaving a record. The applicant's own page can never reach this: it needs an admin sign-in.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const admin = await requireAdmin();
  const { id, docId } = await params;
  if (!UUID.test(id) || !UUID.test(docId)) return new NextResponse("Not found.", { status: 404 });
  const download = request.nextUrl.searchParams.get("download") === "1";

  const supabase = await createClient();
  const { data: doc } = await supabase.from("partner_documents").select("id, kind, file_name, storage_path").eq("id", docId).eq("application_id", id).maybeSingle();
  if (!doc) return new NextResponse("There is no such document.", { status: 404 });

  const { error: logError } = await supabase
    .from("partner_document_access")
    .insert({ application_id: id, document_id: doc.id, kind: doc.kind, file_name: doc.file_name, action: download ? "download" : "view", accessed_by: admin.id });
  if (logError) {
    console.error("partner document access log failed:", logError);
    return new NextResponse("The file was not opened because the access could not be recorded. Try again in a moment.", { status: 502 });
  }

  const { data, error } = await supabase.storage.from("partner-documents").createSignedUrl(doc.storage_path, 60, download ? { download: doc.file_name } : undefined);
  if (error || !data) return new NextResponse("The file couldn't be opened. Try again in a moment.", { status: 502 });

  return NextResponse.redirect(data.signedUrl);
}
