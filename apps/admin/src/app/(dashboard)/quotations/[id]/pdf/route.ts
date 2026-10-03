import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@waytara/supabase/server";

const SIGNED_URL_TTL_SECONDS = 120;

/** Staff-only: redirects to a short-lived signed URL for a quotation's PDF in
 *  the private `quotation-pdfs` bucket. Authorization is enforced by the
 *  caller's own session — RLS on `quotations` decides whether they can see the
 *  row at all, and the bucket's storage policies decide whether they can sign
 *  the object — so there is no service-role shortcut here. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: quotation } = await supabase.from("quotations").select("pdf_url").eq("id", id).maybeSingle();
  if (!quotation?.pdf_url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("quotation-pdfs")
    .createSignedUrl(quotation.pdf_url, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
