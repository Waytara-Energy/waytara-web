// How an electricity bill is worked out from a state's tariff: slabs (each band of units has its own rate), free units, a per-unit
// surcharge (fuel adjustment / wheeling) and electricity duty. Pure functions, so the rules are tested. The admin app keeps a copy
// of typicalRate (apps/admin/src/lib/tariff-math.ts) to fill the headline rate when a tariff is entered - keep the two in step.
//
// Not included, because they do not change with solar and so cannot change what is saved: fixed (demand) charges and meter rent.

export interface Slab {
  /** Top of the band, in units per billing period; null = no limit (the last band). */
  upTo: number | null;
  /** Rs per unit within the band. */
  rate: number;
}

export interface Schedule {
  /** Telescopic bands, lowest first: the first units are charged at the first band's rate, the next at the second's, and so on. */
  slabs: Slab[];
  /** Months in one bill: 1, or 2 where the utility bills every two months (Tamil Nadu). Bands and free units are per bill. */
  billingMonths: number;
  /** Electricity duty, % of the energy charge. */
  dutyPct: number;
  /** Rs per unit added on top of the bands (fuel adjustment, wheeling), where the order lists one. */
  surchargePerKwh: number;
  /** Units free in each bill (a state scheme such as Tamil Nadu's 200 units, Karnataka's Gruha Jyothi). */
  freeUnits: number;
  /** Use above this many units in a bill and the scheme changes: null = it never does. */
  freeUnitsCap: number | null;
  /** The free units that still apply once the cap is passed (Tamil Nadu: 100; Punjab and Telangana: 0, the whole bill is charged). */
  freeUnitsOverCap: number;
}

/** A single rate for every unit - what a tariff without bands is, and what an account rate is. */
export function flatSchedule(rate: number): Schedule {
  return { slabs: [{ upTo: null, rate }], billingMonths: 1, dutyPct: 0, surchargePerKwh: 0, freeUnits: 0, freeUnitsCap: null, freeUnitsOverCap: 0 };
}

/** The columns of an electricity_tariffs row (all optional, an old row has only a rate) -> the schedule. */
export function scheduleFromRow(row: {
  rate_per_kwh: number | string;
  slabs?: unknown;
  billing_months?: number | null;
  duty_pct?: number | string | null;
  surcharge_per_kwh?: number | string | null;
  free_units?: number | string | null;
  free_units_cap?: number | string | null;
  free_units_over_cap?: number | string | null;
}): Schedule {
  const slabs = parseSlabs(row.slabs);
  const num = (v: unknown, d = 0) => (v === null || v === undefined || v === "" ? d : Number(v));
  return {
    slabs: slabs.length > 0 ? slabs : [{ upTo: null, rate: Number(row.rate_per_kwh) }],
    billingMonths: row.billing_months === 2 ? 2 : 1,
    dutyPct: num(row.duty_pct),
    surchargePerKwh: num(row.surcharge_per_kwh),
    freeUnits: num(row.free_units),
    freeUnitsCap: row.free_units_cap === null || row.free_units_cap === undefined ? null : Number(row.free_units_cap),
    freeUnitsOverCap: num(row.free_units_over_cap),
  };
}

/** [{ upTo, rate }] from the jsonb column; anything malformed is dropped, bands are sorted and the last is made open-ended. */
export function parseSlabs(raw: unknown): Slab[] {
  if (!Array.isArray(raw)) return [];
  const list = raw
    .map((s) => ({ upTo: s?.upTo === null || s?.upTo === undefined ? null : Number(s.upTo), rate: Number(s?.rate) }))
    .filter((s) => Number.isFinite(s.rate) && s.rate >= 0 && (s.upTo === null || (Number.isFinite(s.upTo) && s.upTo > 0)))
    .sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  if (list.length > 0) list[list.length - 1] = { ...list[list.length - 1], upTo: null };
  return list;
}

/** Rs for `units` in one bill, bands applied telescopically. */
export function slabCharge(slabs: Slab[], units: number): number {
  let remaining = Math.max(0, units);
  let from = 0;
  let total = 0;
  for (const s of slabs) {
    if (remaining <= 0) break;
    const width = s.upTo === null ? remaining : Math.min(remaining, s.upTo - from);
    if (width > 0) total += width * s.rate;
    remaining -= Math.max(width, 0);
    from = s.upTo ?? from;
  }
  return total;
}

/** The units of one bill that are free, given how many were used. */
export function freeUnitsFor(s: Schedule, billUnits: number): number {
  return s.freeUnitsCap !== null && billUnits > s.freeUnitsCap ? s.freeUnitsOverCap : s.freeUnits;
}

/** The energy bill (Rs) for `monthlyUnits` of use in a month: the bands, the per-unit surcharge and the duty, after any free units.
 *  A two-monthly tariff is worked out on two months of use and halved, so the bands mean what the order says. */
export function monthlyEnergyBill(s: Schedule, monthlyUnits: number): number {
  const months = s.billingMonths;
  const units = Math.max(0, monthlyUnits) * months;
  const chargeable = Math.max(0, units - freeUnitsFor(s, units));
  const energy = slabCharge(s.slabs, chargeable) + chargeable * s.surchargePerKwh;
  return (energy * (1 + s.dutyPct / 100)) / months;
}

/** A single "typical" Rs per unit for the tariff: the average cost of a unit at 250 units a month, free units left out. It is the
 *  headline rate (and the one used for an EV charger's cost); the savings themselves use the bands. */
export function typicalRate(s: Schedule, monthlyUnits = 250): number {
  const noFree = { ...s, freeUnits: 0, freeUnitsCap: null, freeUnitsOverCap: 0 };
  return monthlyEnergyBill(noFree, monthlyUnits) / monthlyUnits;
}
