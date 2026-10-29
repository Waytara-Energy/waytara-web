/**
 * What a plan costs once its offer and GST are applied. Pure, so the Plans page can show it live while an admin types and a test can check it.
 *
 * The price an admin enters is the plan's LIST price. An offer (a percent or a flat amount) takes money off it; then GST is worked out on what is left:
 *  - "included": the price already contains GST, so the customer pays that price and GST is the part of it that is tax;
 *  - "excluded": GST is added on top of the price;
 *  - "none": no GST on this plan.
 */

export type TaxMode = "included" | "excluded" | "none";
export type OfferType = "percent" | "flat";
export type OfferAppliesTo = "both" | "monthly" | "yearly";

export interface PricingInput {
  /** the list price, before any offer; null or negative = no price entered */
  price: number | null;
  offerEnabled: boolean;
  offerType: OfferType;
  offerValue: number;
  /** does the offer apply to this price? (the caller decides from offer_applies_to and the price's period) */
  offerApplies: boolean;
  taxMode: TaxMode;
  gstRate: number;
}

export interface PricingResult {
  list: number;
  /** what the offer takes off (0 when there is none) */
  discount: number;
  /** the price after the offer, before GST is split or added (what the admin's number becomes) */
  afterOffer: number;
  /** the price without GST */
  net: number;
  gst: number;
  /** what the customer pays */
  total: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function priceWithOfferAndTax(input: PricingInput): PricingResult | null {
  if (input.price === null || !Number.isFinite(input.price) || input.price < 0) return null;
  const list = input.price;
  let discount = 0;
  if (input.offerEnabled && input.offerApplies && Number.isFinite(input.offerValue) && input.offerValue > 0) {
    discount = input.offerType === "percent" ? list * (Math.min(100, input.offerValue) / 100) : Math.min(list, input.offerValue);
  }
  const afterOffer = Math.max(0, list - discount);
  const rate = input.taxMode === "none" || !Number.isFinite(input.gstRate) ? 0 : Math.max(0, input.gstRate);
  let net: number;
  let gst: number;
  let total: number;
  if (input.taxMode === "included" && rate > 0) {
    total = afterOffer;
    net = afterOffer / (1 + rate / 100);
    gst = total - net;
  } else if (input.taxMode === "excluded" && rate > 0) {
    net = afterOffer;
    gst = afterOffer * (rate / 100);
    total = net + gst;
  } else {
    net = afterOffer;
    gst = 0;
    total = afterOffer;
  }
  return { list: round2(list), discount: round2(discount), afterOffer: round2(afterOffer), net: round2(net), gst: round2(gst), total: round2(total) };
}

/** "₹1,499" or "₹1,499.50": whole rupees without decimals. */
export function rupees(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** How much of the 12 monthly payments the yearly price saves, as a percent (null when it saves nothing or a price is missing). */
export function yearlySavingPct(monthly: number | null, yearly: number | null): number | null {
  if (monthly === null || yearly === null || monthly <= 0 || yearly <= 0) return null;
  const pct = (1 - yearly / (monthly * 12)) * 100;
  return pct > 0.5 ? Math.round(pct) : null;
}
