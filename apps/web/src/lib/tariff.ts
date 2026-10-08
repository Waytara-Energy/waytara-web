// Which electricity rate applies to a customer's site: the rate of the site's STATE for its kind of PROPERTY (residential,
// commercial, industrial), as kept in electricity_tariffs. Pure functions (no database, no React), so the rules are tested.
// Where no rate is on file for the state, the customer's own rate (set on their account) is used and the page says so.

import { flatSchedule, scheduleFromRow, type Schedule } from "./tariff-schedule";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
] as const;

export type TariffCategory = "residential" | "commercial" | "industrial";
export const TARIFF_CATEGORIES: TariffCategory[] = ["residential", "commercial", "industrial"];

/** The kind of property -> the tariff category it is billed under. */
export function categoryForPropertyType(propertyType: string | null | undefined): TariffCategory {
  switch (propertyType) {
    case "factories_heavy_engineering_processing_plants":
      return "industrial";
    case "corporate_offices_hospitals_hotels_retail":
    case "tech_parks_data_centers_rnd_hubs":
    case "logistics_delivery_hubs_bus_depots":
      return "commercial";
    default:
      return "residential"; // villas, gated communities and anything not known
  }
}

const SQUASH = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
const BY_SQUASHED = new Map<string, string>(INDIAN_STATES.map((s) => [SQUASH(s), s]));
const ALIASES: Record<string, string> = {
  orissa: "Odisha",
  pondicherry: "Puducherry",
  tn: "Tamil Nadu",
  jammuandkashmir: "Jammu and Kashmir",
  nctofdelhi: "Delhi",
  newdelhi: "Delhi",
  andamanandnicobar: "Andaman and Nicobar Islands",
  dadraandnagarhavelidamananddiu: "Dadra and Nagar Haveli and Daman and Diu",
  damananddiu: "Dadra and Nagar Haveli and Daman and Diu",
  dadraandnagarhaveli: "Dadra and Nagar Haveli and Daman and Diu",
};

/** The state as written in a site's address ("tamilnadu", "TAMIL NADU", "Orissa") -> its standard name; null if unknown. */
export function matchState(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = SQUASH(raw);
  return BY_SQUASHED.get(key) ?? ALIASES[key] ?? null;
}

export interface TariffRow {
  state: string;
  category: string;
  rate_per_kwh: number;
  export_rate_per_kwh: number | null;
  fixed_charge_per_month: number | null;
  effective_from: string;
  source_url: string | null;
  source_note: string | null;
  confidence: string;
  slabs?: unknown;
  billing_months?: number | null;
  duty_pct?: number | null;
  surcharge_per_kwh?: number | null;
  free_units?: number | null;
  free_units_cap?: number | null;
  free_units_over_cap?: number | null;
}

/** One rate in force from a date: the headline rate, what a unit sent to the grid earns, and the bands the bill is worked out with. */
export interface RateEntry {
  effectiveFrom: string;
  rate: number;
  exportRate: number;
  schedule: Schedule;
  /** The utility nets what the site sends against what it buys (no separate export rate on file), carrying any surplus forward. */
  netMetering: boolean;
}

function entryFromRow(r: TariffRow): RateEntry {
  const rate = Number(r.rate_per_kwh);
  const schedule = scheduleFromRow(r);
  const banded = schedule.slabs.length > 1 || schedule.freeUnits > 0 || schedule.dutyPct > 0 || schedule.surchargePerKwh > 0 || schedule.billingMonths > 1;
  return {
    effectiveFrom: r.effective_from,
    rate,
    exportRate: r.export_rate_per_kwh === null ? rate : Number(r.export_rate_per_kwh),
    schedule,
    netMetering: banded && r.export_rate_per_kwh === null,
  };
}

export interface ResolvedTariff {
  /** The typical Rs per kWh of a unit at this tariff (what the headline shows, and an EV charger's cost uses). */
  rate: number;
  /** Rs per kWh a unit sent to the grid is worth. */
  exportRate: number;
  /** The bands, free units and duty the bill is worked out with. */
  schedule: Schedule;
  /** The utility nets what is sent against what is bought (see RateEntry). */
  netMetering: boolean;
  /** "state": from the rate table; "account": the customer's own rate (no state rate on file). */
  source: "state" | "account";
  state: string | null;
  category: TariffCategory;
  /** "verified" / "indicative" for a state rate; "account" for the customer's own. */
  confidence: "verified" | "indicative" | "account";
  effectiveFrom: string | null;
  sourceUrl: string | null;
  sourceNote: string | null;
  /** What it changed from, when it has changed. */
  previous: { rate: number; effectiveFrom: string } | null;
  /** Taken effect within the last 30 days. */
  changedRecently: boolean;
  /** A scheduled rate that has not started yet. */
  upcoming: { rate: number; effectiveFrom: string } | null;
  /** Every rate on file for this state and category that has started, oldest first, so a past month can be priced at the rate it had. */
  timeline: RateEntry[];
}

const DAY_MS = 86_400_000;
const NOTICE_DAYS = 30;
const dayMs = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();

/** The rate in force on `today` (YYYY-MM-DD) for the site, given the rows on file for its state and category (any order). */
export function resolveTariff(input: {
  rows: TariffRow[];
  state: string | null;
  propertyType: string | null | undefined;
  accountRate: number;
  today: string;
}): ResolvedTariff {
  const category = categoryForPropertyType(input.propertyType);
  const mine = input.rows.filter((r) => r.state === input.state && r.category === category).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const started = mine.filter((r) => r.effective_from <= input.today);
  const current = started[started.length - 1];
  const previousRow = started[started.length - 2];
  const next = mine.find((r) => r.effective_from > input.today);

  if (!current) {
    return {
      rate: input.accountRate,
      exportRate: input.accountRate,
      schedule: flatSchedule(input.accountRate),
      netMetering: false,
      source: "account",
      state: input.state,
      category,
      confidence: "account",
      effectiveFrom: null,
      sourceUrl: null,
      sourceNote: null,
      previous: null,
      changedRecently: false,
      upcoming: next ? { rate: Number(next.rate_per_kwh), effectiveFrom: next.effective_from } : null,
      timeline: [],
    };
  }
  const rate = Number(current.rate_per_kwh);
  const entry = entryFromRow(current);
  const previous = previousRow && Number(previousRow.rate_per_kwh) !== rate ? { rate: Number(previousRow.rate_per_kwh), effectiveFrom: previousRow.effective_from } : null;
  return {
    rate,
    exportRate: entry.exportRate,
    schedule: entry.schedule,
    netMetering: entry.netMetering,
    source: "state",
    state: input.state,
    category,
    confidence: current.confidence === "verified" ? "verified" : "indicative",
    effectiveFrom: current.effective_from,
    sourceUrl: current.source_url,
    sourceNote: current.source_note,
    previous,
    changedRecently: previous !== null && (dayMs(input.today) - dayMs(current.effective_from)) / DAY_MS <= NOTICE_DAYS,
    upcoming: next && (dayMs(next.effective_from) - dayMs(input.today)) / DAY_MS <= NOTICE_DAYS ? { rate: Number(next.rate_per_kwh), effectiveFrom: next.effective_from } : null,
    timeline: started.map(entryFromRow),
  };
}

export const CATEGORY_LABEL: Record<TariffCategory, string> = { residential: "residential", commercial: "commercial", industrial: "industrial" };
