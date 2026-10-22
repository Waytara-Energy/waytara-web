// A customer's address and billing address: read tolerantly (older rows came from the quote form with whatever keys it had), checked when
// saved, and written in a fixed key order (other screens print the values in order: line, line, city, state, pincode).

export interface Address {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export const EMPTY_ADDRESS: Address = { line1: "", line2: "", city: "", state: "", pincode: "" };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

export function parseAddress(raw: unknown): Address {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    line1: str(o.line1 ?? o.street ?? o.address),
    line2: str(o.line2 ?? o.landmark ?? o.area),
    city: str(o.city ?? o.town),
    state: str(o.state),
    pincode: str(o.pincode ?? o.postal_code ?? o.zip),
  };
}

export const isEmptyAddress = (a: Address): boolean => !a.line1 && !a.line2 && !a.city && !a.state && !a.pincode;

export const addressLine = (a: Address): string => [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ");

export const sameAddress = (a: Address, b: Address): boolean => addressLine(a).toLowerCase() === addressLine(b).toLowerCase();

/** What is wrong with an address a person is saving (empty when it is fine). A completely empty address is allowed: it clears it. */
export function addressProblems(a: Address, label: string): string[] {
  if (isEmptyAddress(a)) return [];
  const out: string[] = [];
  if (!a.line1) out.push(`${label}: add the house or street.`);
  if (!a.city) out.push(`${label}: add the city.`);
  if (!a.state) out.push(`${label}: choose the state.`);
  if (!/^\d{6}$/.test(a.pincode)) out.push(`${label}: the pincode is 6 digits.`);
  if (a.line1.length > 160 || a.line2.length > 160 || a.city.length > 80) out.push(`${label}: one of the lines is too long.`);
  return out;
}

/** The stored form, in the fixed key order and without empty parts. Null for an empty address. */
export function addressToJson(a: Address): Record<string, string> | null {
  if (isEmptyAddress(a)) return null;
  const out: Record<string, string> = {};
  for (const k of ["line1", "line2", "city", "state", "pincode"] as const) if (a[k]) out[k] = a[k];
  return out;
}

export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const normaliseGstin = (v: string): string => v.replace(/\s+/g, "").toUpperCase();
