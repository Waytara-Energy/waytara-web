import { describe, expect, it } from "vitest";
import { paymentTypeLabel, periodProgress, summarisePayments, type PaymentRow } from "./billing-summary";

const pay = (over: Partial<PaymentRow>): PaymentRow => ({ id: "1", payment_type: "full", amount: 1000, status: "paid", method: null, paid_at: null, created_at: "2026-09-01T00:00:00Z", ...over });

describe("summarisePayments", () => {
  it("adds what was paid and what is pending, and ignores failed and refunded", () => {
    const s = summarisePayments([pay({ amount: 50_000 }), pay({ id: "2", amount: "25000.50", status: "pending" }), pay({ id: "3", amount: 999, status: "failed" }), pay({ id: "4", amount: 500, status: "refunded" })]);
    expect(s.paid).toBe(50_000);
    expect(s.pending).toBe(25_000.5);
    expect(s.count).toBe(4);
  });
  it("finds the latest paid date (the paid time, else the created time)", () => {
    const s = summarisePayments([pay({ paid_at: "2026-09-10T00:00:00Z" }), pay({ id: "2", paid_at: null, created_at: "2026-09-20T00:00:00Z" }), pay({ id: "3", status: "pending", created_at: "2026-10-01T00:00:00Z" })]);
    expect(s.lastPaidAt).toBe("2026-09-20T00:00:00Z");
  });
  it("is all zero with no payments", () => {
    expect(summarisePayments([])).toEqual({ paid: 0, pending: 0, count: 0, lastPaidAt: null });
  });
});

describe("paymentTypeLabel", () => {
  it("names the known kinds and tidies an unknown one", () => {
    expect(paymentTypeLabel("advance")).toBe("Advance");
    expect(paymentTypeLabel("full")).toBe("Full payment");
    expect(paymentTypeLabel("emi_part")).toBe("emi part");
  });
});

describe("periodProgress", () => {
  const start = "2026-01-01T00:00:00Z";
  const end = "2026-01-11T00:00:00Z";
  it("says how far into the period it is and the days left", () => {
    expect(periodProgress(start, end, Date.parse("2026-01-03T00:00:00Z"))).toEqual({ percent: 20, daysLeft: 8 });
  });
  it("stays within 0 to 100 outside the period", () => {
    expect(periodProgress(start, end, Date.parse("2025-12-01T00:00:00Z"))?.percent).toBe(0);
    expect(periodProgress(start, end, Date.parse("2026-03-01T00:00:00Z"))).toEqual({ percent: 100, daysLeft: 0 });
  });
  it("is null without both dates or with a backwards period", () => {
    expect(periodProgress(null, end, 0)).toBeNull();
    expect(periodProgress(start, null, 0)).toBeNull();
    expect(periodProgress(end, start, 0)).toBeNull();
  });
});
