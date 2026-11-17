import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { DOCUMENT_KIND_IDS, MEMBER_DOCUMENT_KINDS, documentMime, documentProblem, isDocumentPathOf, memberSubject } from "@waytara/supabase/partner-onboarding";
import { fail } from "@/lib/partner-track-api";
import { openCrew } from "@/lib/partner-crew-server";
import { PARTNER_BUCKET } from "@/lib/partner-onboarding-server";

const schema = z.object({ kind: z.enum(DOCUMENT_KIND_IDS), name: z.string().trim().min(1).max(200), path: z.string().min(1).max(300) });

/**
 * Step two of a team member sending a file: the server finds the file in the bucket, takes the size from the bucket, refuses and deletes anything unacceptable, and
 * records it under that person (the link decides whose it is, never the request).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const s = await openCrew(req.headers, token, "documents", 120);
    if (s instanceof NextResponse) return s;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please choose the file again.", 400);
    const { kind, name, path } = parsed.data;
    if (!MEMBER_DOCUMENT_KINDS.includes(kind)) return fail("That kind of document does not belong here.", 400);
    if (!isDocumentPathOf(s.app.id, path)) return fail("That file didn't upload properly. Please choose it again.", 400);

    const db = createServiceRoleClient();
    const bucket = db.storage.from(PARTNER_BUCKET);
    const slash = path.indexOf("/");
    const { data: found } = await bucket.list(path.slice(0, slash), { limit: 5, search: path.slice(slash + 1) });
    const file = (found ?? []).find((f) => f.name === path.slice(slash + 1));
    const size = Number((file?.metadata as { size?: number } | null)?.size ?? 0);
    if (!file || !size) return fail("That file didn't upload properly. Please choose it again.", 400);
    const problem = documentProblem(name, size);
    if (problem) {
      await bucket.remove([path]);
      return fail(problem, 400);
    }

    const subject = memberSubject(s.key);
    const { data: row, error } = await db
      .from("partner_documents")
      .insert({ application_id: s.app.id, kind, subject, file_name: name, storage_path: path, content_type: documentMime(name) ?? "application/octet-stream", size_bytes: size })
      .select("id, kind, subject, file_name, size_bytes, uploaded_at")
      .single();
    if (error || !row) {
      if (error?.code !== "23505") {
        console.error("API /api/partner/crew/documents error:", error);
        await bucket.remove([path]);
      }
      return fail("Couldn't record that file. Please try again.", 500);
    }
    // they have started: the partner sees that the link was used
    await db.from("partner_crew_invites").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", s.invite.id).eq("status", "sent");
    return NextResponse.json({ success: true, data: { id: row.id, kind: row.kind, subject: row.subject, name: row.file_name, size: row.size_bytes, uploadedAt: row.uploaded_at } });
  } catch (error) {
    console.error("API /api/partner/crew/documents error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
