import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { DOCUMENT_KIND_IDS, DOCUMENT_MAX_FILES, documentProblem, newDocumentPath } from "@waytara/supabase/partner-onboarding";
import { fail, openEditable } from "@/lib/partner-track-api";
import { PARTNER_BUCKET } from "@/lib/partner-onboarding-server";

const schema = z.object({ kind: z.enum(DOCUMENT_KIND_IDS), name: z.string().trim().min(1).max(200), size: z.number().int() });

/**
 * Step one of sending a file: the browser says what it wants to send (kind, name, size); if that is acceptable the server hands back a one-time upload address for a
 * fresh path in the private bucket. The file then goes straight from the browser to storage (a server request here could not carry a large file), and the next step
 * (documents) checks it arrived and records it. The applicant never gets an address to read anything back.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "upload", 120);
    if (opened instanceof NextResponse) return opened;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please choose the file again.", 400);
    const { kind, name, size } = parsed.data;
    const problem = documentProblem(name, size);
    if (problem) return fail(problem, 400);

    const db = createServiceRoleClient();
    const { count } = await db.from("partner_documents").select("id", { count: "exact", head: true }).eq("application_id", opened.app.id);
    if ((count ?? 0) >= DOCUMENT_MAX_FILES) return fail(`You can send up to ${DOCUMENT_MAX_FILES} files. Remove one first, or contact us.`, 400);

    const path = newDocumentPath(opened.app.id, name);
    const { data, error } = await db.storage.from(PARTNER_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("API /api/partner/track/upload error:", error);
      return fail("Couldn't start the upload. Please try again.", 502);
    }
    return NextResponse.json({ success: true, data: { kind, path, uploadUrl: data.signedUrl } });
  } catch (error) {
    console.error("API /api/partner/track/upload error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
