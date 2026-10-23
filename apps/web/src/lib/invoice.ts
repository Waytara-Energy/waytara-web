// A customer's invoice for one payment: what is on it, and the small calculations behind it. Pure, so the wording and the sums are tested; the page
// and the PDF both draw from InvoiceData (lib/invoice-data.ts builds it, lib/invoice-pdf.tsx draws the PDF).
//
// WayTara's prices include GST (Terms 5.4), so an invoice splits the amount paid into the value before tax and the tax in it, at the rate on the
// customer's quotation. Only a payment that went through has an invoice.

export interface InvoiceParty {
  name: string;
  email: string | null;
  /** address lines, top to bottom */
  address: string[];
  gstin: string | null;
}

export interface InvoiceData {
  /** "WT-202610-3F9A1C": the month it was paid and the start of the payment's id */
  number: string;
  /** when it was paid (ISO) */
  issuedAt: string;
  seller: InvoiceParty;
  buyer: InvoiceParty & { billingEmail: string | null };
  /** what the money was for: "Advance for your Home Plus system" */
  description: string;
  /** the quotation the payment belongs to, and the plan on it */
  quotationRef: string | null;
  planName: string | null;
  amounts: { taxable: number; gstRate: number | null; gst: number; total: number };
  payment: { type: string; typeLabel: string; method: string | null; reference: string | null; paidAt: string | null };
  /** where the whole purchase stands after this payment; null without a quotation */
  progress: { quotationTotal: number; paidToDate: number; remaining: number } | null;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** A GST-inclusive amount split into the value before tax and the tax in it. A missing or zero rate means no tax is shown. */
export function splitGst(total: number, ratePercent: number | null): { taxable: number; gst: number } {
  if (!ratePercent || ratePercent <= 0 || !Number.isFinite(ratePercent)) return { taxable: round2(total), gst: 0 };
  const taxable = round2(total / (1 + ratePercent / 100));
  return { taxable, gst: round2(total - taxable) };
}

const TYPE_LABEL: Record<string, string> = { full: "Full payment", advance: "Advance payment", balance: "Balance payment" };
export const paymentTypeText = (type: string): string => TYPE_LABEL[type] ?? type.replace(/_/g, " ");

/** Only a payment that went through has an invoice (a waiting, failed or refunded one has nothing to invoice). */
export const hasInvoice = (status: string): boolean => status === "paid";

/** "WT-202610-3F9A1C". The month is in India time. */
export function invoiceNumber(paymentId: string, paidAtIso: string): string {
  const ist = new Date(Date.parse(paidAtIso) + 19_800_000);
  const month = `${ist.getUTCFullYear()}${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
  return `WT-${month}-${paymentId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** What the purchase is for, in a line: "Advance payment for your Home Plus system". */
export function invoiceDescription(type: string, planName: string | null): string {
  const what = planName ? `your ${planName} system` : "your WayTara system";
  return `${paymentTypeText(type)} for ${what}`;
}

/** The payments of a quotation that have gone through, added up, against its total. Null when the quotation total is not known. */
export function purchaseProgress(quotationTotal: number | null, paidAmounts: readonly number[]): InvoiceData["progress"] {
  if (quotationTotal === null || !Number.isFinite(quotationTotal) || quotationTotal <= 0) return null;
  const paidToDate = round2(paidAmounts.reduce((a, b) => a + b, 0));
  return { quotationTotal: round2(quotationTotal), paidToDate, remaining: Math.max(0, round2(quotationTotal - paidToDate)) };
}

/** An address as lines for a bill: "12 Main Street", "Anna Nagar", "Chennai, Tamil Nadu 600040". */
export function addressLines(a: { line1: string; line2: string; city: string; state: string; pincode: string }): string[] {
  const last = [[a.city, a.state].filter(Boolean).join(", "), a.pincode].filter(Boolean).join(" ");
  return [a.line1, a.line2, last].filter(Boolean);
}

/** The payment history as a CSV a person can open in a spreadsheet (one row per payment, rupees without symbols). */
export function paymentsCsv(rows: readonly { id: string; payment_type: string; amount: number | string; status: string; method: string | null; paid_at: string | null; created_at: string }[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["Invoice", "Date", "Payment", "Method", "Amount (INR)", "Status"];
  const lines = rows.map((r) => {
    const when = r.paid_at ?? r.created_at;
    return [hasInvoice(r.status) ? invoiceNumber(r.id, when) : "", when.slice(0, 10), paymentTypeText(r.payment_type), r.method ? r.method.replace(/_/g, " ") : "", String(Number(r.amount)), r.status].map(cell).join(",");
  });
  return [head.join(","), ...lines].join("\r\n");
}
