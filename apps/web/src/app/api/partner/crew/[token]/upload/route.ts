import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { DOCUMENT_KIND_IDS, DOCUMENT_MAX_FILES, MEMBER_DOCUMENT_KINDS, documentProblem, memberSubject, newDocumentPath } from "@waytara/supabase/partner-onboarding";
import { fail } from "@/lib/partner-track-api";
import { openCrew } from "@/lib/partner-crew-server";
import { PARTNER_BUCKET } from "@/lib/partner-onboarding-server";

// The subject is not sent: a team member's link can only ever file under that person.
const schema = z.object({ kind: z.enum(DOCUMENT_KIND_IDS), name: z.string().trim().min(1).max(200), size: z.number().int() });

/** Step one of a team member sending a file from their own link: the same as the partner's, but the file can only be filed under that person. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const s = await openCrew(req.headers, token, "upload", 120);
    if (s instanceof NextResponse) return s;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please choose the file again.", 400);
    const { kind, name, size } = parsed.data;
    if (!MEMBER_DOCUMENT_KINDS.includes(kind)) return fail("That kind of document does not belong here.", 400);
    const problem = documentProblem(name, size);
    if (problem) return fail(problem, 400);

    const db = createServiceRoleClient();
    const { count } = await db.from("partner_documents").select("id", { count: "exact", head: true }).eq("application_id", s.app.id);
    if ((count ?? 0) >= DOCUMENT_MAX_FILES) return fail("Too many files have been sent for this application. Please ask your employer to contact WayTara.", 400);

    const path = newDocumentPath(s.app.id, name);
    const { data, error } = await db.storage.from(PARTNER_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("API /api/partner/crew/upload error:", error);
      return fail("Couldn't start the upload. Please try again.", 502);
    }
    // the subject is fixed by the link; returned only so the page is sure what it is filing under
    return NextResponse.json({ success: true, data: { kind, path, uploadUrl: data.signedUrl, subject: memberSubject(s.key) } });
  } catch (error) {
    console.error("API /api/partner/crew/upload error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
