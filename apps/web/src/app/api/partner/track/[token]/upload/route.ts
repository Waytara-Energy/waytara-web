import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { DOCUMENT_KIND_IDS, DOCUMENT_MAX_FILES, documentProblem, documentSubjectProblem, newDocumentPath } from "@waytara/supabase/partner-onboarding";
import { fail, openDocuments } from "@/lib/partner-track-api";
import { PARTNER_BUCKET, loadOnboarding } from "@/lib/partner-onboarding-server";

const schema = z.object({ kind: z.enum(DOCUMENT_KIND_IDS), subject: z.string().max(60).default("partner"), name: z.string().trim().min(1).max(200), size: z.number().int() });

/**
 * Step one of sending a file: the browser says what it wants to send (kind, whose it is, name, size); if that is acceptable the server hands back a one-time upload
 * address for a fresh path in the private bucket. The file then goes straight from the browser to storage (a server request here could not carry a large file), and
 * the next step (documents) checks it arrived and records it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openDocuments(req.headers, token, "upload", 240);
    if (opened instanceof NextResponse) return opened;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please choose the file again.", 400);
    const { kind, subject, name, size } = parsed.data;
    const problem = documentProblem(name, size);
    if (problem) return fail(problem, 400);

    const state = await loadOnboarding(opened.app.id);
    const whose = documentSubjectProblem(opened.app.partnerType, state.data, subject, kind);
    if (whose) return fail(whose, 400);
    if (state.documents.length >= DOCUMENT_MAX_FILES) return fail(`You can send up to ${DOCUMENT_MAX_FILES} files. Remove one first, or contact us.`, 400);

    const path = newDocumentPath(opened.app.id, name);
    const { data, error } = await createServiceRoleClient().storage.from(PARTNER_BUCKET).createSignedUploadUrl(path);
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
