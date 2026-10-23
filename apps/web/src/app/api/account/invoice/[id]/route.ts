import { NextRequest, NextResponse } from "next/server";
import { loadInvoice } from "@/lib/invoice-data";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

// One invoice as a PDF: opened in the browser, or saved with ?download=1. The payment is read through the signed-in customer's own session (see
// loadInvoice), so only their own paid payments have one; anything else is a plain 404.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const invoice = await loadInvoice(id);
  if (!invoice) return NextResponse.json({ error: "There is no invoice for this payment." }, { status: 404 });

  const pdf = await generateInvoicePdf(invoice);
  const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename="waytara-invoice-${invoice.number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
