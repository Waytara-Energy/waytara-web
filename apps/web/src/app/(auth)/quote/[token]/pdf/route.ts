import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { allowRequest, clientIp } from "@/lib/rate-limit";

const SIGNED_URL_TTL_SECONDS = 60;

/** Hands a customer a short-lived signed link to their ACCEPTED quotation's
 *  PDF. The private bucket is never exposed directly: access is proven by
 *  the unguessable per-quotation `access_token` in the URL (the same proof
 *  the quote page itself uses), the link expires in a minute, and requests
 *  are rate-limited per IP so the token can't be brute-forced. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!(await allowRequest("quote-pdf:ip", clientIp(req.headers), 30, 10 * 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Cheap shape check before touching the database.
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const service = createServiceRoleClient();
  const { data: quotation } = await service
    .from("quotations")
    .select("pdf_url, status")
    .eq("access_token", token)
    .maybeSingle();

  if (!quotation || quotation.status !== "accepted" || !quotation.pdf_url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await service.storage
    .from("quotation-pdfs")
    .createSignedUrl(quotation.pdf_url, SIGNED_URL_TTL_SECONDS, { download: "WayTara-Quotation.pdf" });

  if (error || !data?.signedUrl) {
    console.error("[quote/pdf] could not sign URL:", error?.message);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
