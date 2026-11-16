import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { DOCUMENT_KIND_IDS, documentMime, documentProblem, isDocumentPathOf } from "@waytara/supabase/partner-onboarding";
import { fail, openEditable } from "@/lib/partner-track-api";
import { PARTNER_BUCKET } from "@/lib/partner-onboarding-server";

const schema = z.object({ kind: z.enum(DOCUMENT_KIND_IDS), name: z.string().trim().min(1).max(200), path: z.string().min(1).max(300) });

/**
 * Step two of sending a file: the browser says the file is uploaded. The server does not take its word: it finds the file in the bucket, takes the size and kind from
 * the bucket (not from the request), refuses and deletes anything that is not acceptable, and only then records it against the application.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const opened = await openEditable(req.headers, token, "documents", 120);
    if (opened instanceof NextResponse) return opened;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please choose the file again.", 400);
    const { kind, name, path } = parsed.data;
    // Only a path this application was given: a path under another application's folder, or one we never made, is refused.
    if (!isDocumentPathOf(opened.app.id, path)) return fail("That file didn't upload properly. Please choose it again.", 400);

    const bucket = createServiceRoleClient().storage.from(PARTNER_BUCKET);
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

    const { data: row, error } = await createServiceRoleClient()
      .from("partner_documents")
      .insert({ application_id: opened.app.id, kind, file_name: name, storage_path: path, content_type: documentMime(name) ?? "application/octet-stream", size_bytes: size })
      .select("id, kind, file_name, size_bytes, uploaded_at")
      .single();
    if (error || !row) {
      // a second confirmation of the same upload is not a problem (the unique path): the file is already recorded
      if (error?.code !== "23505") {
        console.error("API /api/partner/track/documents error:", error);
        await bucket.remove([path]);
      }
      return fail("Couldn't record that file. Please try again.", 500);
    }
    return NextResponse.json({ success: true, data: { id: row.id, kind: row.kind, name: row.file_name, size: row.size_bytes, uploadedAt: row.uploaded_at } });
  } catch (error) {
    console.error("API /api/partner/track/documents error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}
