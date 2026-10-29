import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { PO_BUCKET } from "@/lib/po-document";

/**
 * The purchase-order file of a stock item, for an admin: `/devices/stock/<id>/po` opens it (a PDF or an image shows in the browser), and
 * `?download=1` saves it under its own name. The bucket is private, so this makes a link that works for one minute and sends the browser there; the
 * link is never stored and nobody without an admin session can ask for one.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const download = request.nextUrl.searchParams.get("download") === "1";

  const supabase = await createClient();
  const { data: item } = await supabase.from("equipment_inventory").select("po_document_path, po_document_name").eq("id", id).maybeSingle();
  if (!item?.po_document_path) return new NextResponse("This item has no purchase order file.", { status: 404 });

  const { data, error } = await supabase.storage.from(PO_BUCKET).createSignedUrl(item.po_document_path, 60, download ? { download: item.po_document_name ?? true } : undefined);
  if (error || !data) return new NextResponse("The file couldn't be opened. Try again in a moment.", { status: 502 });

  return NextResponse.redirect(data.signedUrl);
}
