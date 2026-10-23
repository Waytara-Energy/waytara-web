import { describe, expect, it } from "vitest";
import { generateInvoicePdf } from "./invoice-pdf";
import type { InvoiceData } from "./invoice";

const invoice: InvoiceData = {
  number: "WT-202610-3F9A1C",
  issuedAt: "2026-10-15T08:00:00Z",
  seller: { name: "WayTara Energy LLP", email: "hello@waytaraenergy.com", address: ["1 Example Road", "Chennai 600001"], gstin: "33ABCDE1234F1Z5" },
  buyer: { name: "Asha Rao", email: "asha@example.com", billingEmail: "accounts@example.com", address: ["12 Main Street", "Chennai, Tamil Nadu 600040"], gstin: null },
  description: "Advance payment for your Home Plus system",
  quotationRef: "ab12cd34",
  planName: "Home Plus",
  amounts: { taxable: 42_372.88, gstRate: 18, gst: 7_627.12, total: 50_000 },
  payment: { type: "advance", typeLabel: "Advance payment", method: "upi", reference: "pay_123", paidAt: "2026-10-15T08:00:00Z" },
  progress: { quotationTotal: 170_000, paidToDate: 50_000, remaining: 120_000 },
};

describe("generateInvoicePdf", () => {
  it("makes a PDF for a full invoice", async () => {
    const pdf = await generateInvoicePdf(invoice);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  });
  it("still makes one when everything optional is missing", async () => {
    const pdf = await generateInvoicePdf({ ...invoice, seller: { ...invoice.seller, address: [], gstin: null }, buyer: { ...invoice.buyer, address: [], billingEmail: null }, quotationRef: null, amounts: { taxable: 50_000, gstRate: null, gst: 0, total: 50_000 }, payment: { ...invoice.payment, method: null, reference: null, paidAt: null }, progress: null });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
