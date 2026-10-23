import { describe, expect, it } from "vitest";
import { addressLines, hasInvoice, invoiceDescription, invoiceNumber, paymentTypeText, paymentsCsv, purchaseProgress, splitGst } from "./invoice";

describe("splitGst", () => {
  it("splits a GST-inclusive amount into the value before tax and the tax in it", () => {
    expect(splitGst(118_000, 18)).toEqual({ taxable: 100_000, gst: 18_000 });
    expect(splitGst(50_000, 18)).toEqual({ taxable: 42_372.88, gst: 7_627.12 });
  });
  it("always adds back up to what was paid", () => {
    for (const total of [1, 99.99, 12_345.67, 170_000]) {
      const { taxable, gst } = splitGst(total, 18);
      expect(Math.round((taxable + gst) * 100)).toBe(Math.round(total * 100));
    }
  });
  it("shows no tax without a rate", () => {
    expect(splitGst(1000, 0)).toEqual({ taxable: 1000, gst: 0 });
    expect(splitGst(1000, null)).toEqual({ taxable: 1000, gst: 0 });
    expect(splitGst(1000, Number.NaN)).toEqual({ taxable: 1000, gst: 0 });
  });
});

describe("invoice number and wording", () => {
  it("is the month paid (India time) and the start of the payment id", () => {
    expect(invoiceNumber("3f9a1c22-0000-4000-8000-000000000000", "2026-10-15T08:00:00Z")).toBe("WT-202610-3F9A1C");
    // 20:00 UTC on 31 Oct is already 1 Nov in India
    expect(invoiceNumber("3f9a1c22-0000-4000-8000-000000000000", "2026-10-31T20:00:00Z")).toBe("WT-202611-3F9A1C");
  });
  it("names the payment and what it was for", () => {
    expect(paymentTypeText("advance")).toBe("Advance payment");
    expect(paymentTypeText("part_two")).toBe("part two");
    expect(invoiceDescription("balance", "Home Plus")).toBe("Balance payment for your Home Plus system");
    expect(invoiceDescription("full", null)).toBe("Full payment for your WayTara system");
  });
  it("is only for a payment that went through", () => {
    expect(hasInvoice("paid")).toBe(true);
    for (const s of ["pending", "failed", "refunded"]) expect(hasInvoice(s)).toBe(false);
  });
});

describe("purchaseProgress", () => {
  it("adds up what was paid against the total", () => {
    expect(purchaseProgress(170_000, [50_000, 70_000])).toEqual({ quotationTotal: 170_000, paidToDate: 120_000, remaining: 50_000 });
  });
  it("never shows a negative remainder", () => {
    expect(purchaseProgress(100, [150])?.remaining).toBe(0);
  });
  it("is null without a usable total", () => {
    expect(purchaseProgress(null, [10])).toBeNull();
    expect(purchaseProgress(0, [10])).toBeNull();
  });
});

describe("addressLines", () => {
  it("prints the lines of a bill, skipping empty ones", () => {
    expect(addressLines({ line1: "12 Main Street", line2: "", city: "Chennai", state: "Tamil Nadu", pincode: "600040" })).toEqual(["12 Main Street", "Chennai, Tamil Nadu 600040"]);
    expect(addressLines({ line1: "", line2: "", city: "", state: "", pincode: "" })).toEqual([]);
  });
});

describe("paymentsCsv", () => {
  it("has a row per payment, an invoice number only for paid ones, and quotes what needs it", () => {
    const csv = paymentsCsv([
      { id: "3f9a1c22-0000-4000-8000-000000000000", payment_type: "advance", amount: "50000.00", status: "paid", method: "upi", paid_at: "2026-10-15T08:00:00Z", created_at: "2026-10-15T07:00:00Z" },
      { id: "aaaaaa22-0000-4000-8000-000000000000", payment_type: "balance", amount: 120000, status: "pending", method: "bank,transfer", paid_at: null, created_at: "2026-10-20T07:00:00Z" },
    ]).split("\r\n");
    expect(csv[0]).toBe("Invoice,Date,Payment,Method,Amount (INR),Status");
    expect(csv[1]).toBe("WT-202610-3F9A1C,2026-10-15,Advance payment,upi,50000,paid");
    expect(csv[2]).toBe(",2026-10-20,Balance payment,\"bank,transfer\",120000,pending");
  });
});
