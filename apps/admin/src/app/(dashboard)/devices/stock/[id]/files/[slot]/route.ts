import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { DOC_SLOTS, documentOf, isDocSlot } from "@/lib/stock-documents";
import { STOCK_COLUMNS } from "../../../../stock-types";

/**
 * A file of a stock model (its user manual or data sheet) or of one of its deliveries (the purchase order, with ?receipt=), for an admin: `/devices/stock/<id>/files/<po|manual|datasheet>` opens it (a PDF
 * or an image shows in the browser), and `?download=1` saves it under its own name. The buckets are private, so this makes a link that works for one
 * minute and sends the browser there; the link is never stored and nobody without an admin session can ask for one.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; slot: string }> }) {
  await requireAdmin();
  const { id, slot } = await params;
  if (!isDocSlot(slot)) return new NextResponse("Not found.", { status: 404 });
  const download = request.nextUrl.searchParams.get("download") === "1";

  const supabase = await createClient();
  let doc: { path: string; name: string } | null = null;
  if (slot === "po") {
    // a purchase order belongs to a delivery: /files/po?receipt=<delivery id>
    const receipt = request.nextUrl.searchParams.get("receipt") ?? "";
    const { data: row } = await supabase.from("stock_receipts").select("po_document_path, po_document_name").eq("id", receipt).eq("model_id", id).maybeSingle();
    doc = row?.po_document_path ? { path: row.po_document_path, name: row.po_document_name ?? "purchase-order" } : null;
  } else {
    const { data: item } = await supabase.from("equipment_inventory").select(STOCK_COLUMNS).eq("id", id).maybeSingle();
    doc = item ? documentOf(item, slot) : null;
  }
  if (!doc) return new NextResponse(`There is no ${DOC_SLOTS[slot].label.toLowerCase()} file here.`, { status: 404 });

  const { data, error } = await supabase.storage.from(DOC_SLOTS[slot].bucket).createSignedUrl(doc.path, 60, download ? { download: doc.name } : undefined);
  if (error || !data) return new NextResponse("The file couldn't be opened. Try again in a moment.", { status: 502 });

  return NextResponse.redirect(data.signedUrl);
}
