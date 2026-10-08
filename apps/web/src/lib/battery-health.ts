// Battery cycle count and health, worked out from what the inverter does report. The Deye sends the energy that went into
// and out of the battery (lifetime counters), the charge level (SOC), voltage, current and power - but not the battery's
// state of health or cycle count, so both are calculated here. Pure functions, no React and no database.
//
// What is a "cycle"?  One equivalent full cycle (EFC) is the battery delivering its rated usable energy once - in one deep
// discharge or spread over many shallow ones. Manufacturers rate battery life the same way ("6,000 cycles to 80%").
//
//   EFC = (lifetime energy discharged - discharged when this battery was installed) / rated usable capacity
//
// What is "health"?  State of health (SoH) is the battery's present usable capacity as a share of its capacity when new.
// Without a BMS reading it can only be estimated, in two ways, and the page says which one it is showing:
//
//   measured   capacity = energy delivered during a long discharge / (SOC points used / 100), averaged over several
//              discharges. Needs a discharge of at least MIN_SOC_SWING points because the SOC is a whole number: a 30-point
//              swing keeps its rounding error near 3%.
//   usage      health = 100 - (100 - end_of_life) x (EFC / rated cycles): the straight-line fade to the rated end of life
//              that the manufacturer's cycle rating describes. It only says how worn the battery should be by now.

export interface BatteryProfile {
  ratedCapacityKwh: number;
  ratedCycleLife: number;
  /** Capacity (% of new) at which the cycle rating ends; 80 is the usual. */
  endOfLifePct: number;
  /** The inverter's lifetime discharge counter when this battery was installed. */
  baselineDischargedKwh: number;
  installedOn: string | null;
  chemistry: string | null;
}

/** A battery product allocated to the customer (an equipment row of the "Batteries" category, with its stock record). */
export interface BatteryUnit {
  /** How many batteries this row stands for. */
  quantity?: number;
  /** The inverter's lifetime discharge counter (kWh) when this battery was installed; null = 0. */
  baselineDischargedKwh?: number | null;
  installedAt: string | null;
  /** The stock record's capacity ("power_capacity_value" / "power_capacity_unit"): the nominal energy. */
  capacityValue: number | string | null;
  capacityUnit: string | null;
  /** technical_specs: usable_kwh, dod ("90%"), eol_pct, chemistry. */
  specs: Record<string, unknown> | null;
  /** warranty_info: cycle_life. */
  warranty: Record<string, unknown> | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace("%", "").trim()) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** The battery's profile from the product record(s) allocated to the customer: usable energy (the datasheet's usable_kwh,
 *  or the nominal energy times the depth of discharge), added up over the units; the cycle life from the warranty info
 *  (the lowest of the units); end of life from the specs (80% when not given). Null when the record does not say enough. */
export function batteryProfileFromUnits(units: BatteryUnit[]): BatteryProfile | null {
  if (units.length === 0) return null;
  let usable = 0;
  const lives: number[] = [];
  for (const u of units) {
    const nominal = num(u.capacityValue);
    const unit = (u.capacityUnit ?? "").toLowerCase();
    const nominalKwh = nominal === null ? null : unit === "kwh" ? nominal : unit === "wh" ? nominal / 1000 : null;
    const stated = num(u.specs?.usable_kwh);
    const dod = num(u.specs?.dod);
    const unitUsable = stated ?? (nominalKwh !== null ? nominalKwh * (dod !== null && dod > 0 && dod <= 100 ? dod / 100 : 1) : null);
    const life = num(u.warranty?.cycle_life);
    if (unitUsable === null || unitUsable <= 0 || life === null || life <= 0) return null;
    usable += unitUsable * Math.max(1, u.quantity ?? 1);
    lives.push(life);
  }
  const first = units[0];
  const installed = units.map((u) => u.installedAt).filter((d): d is string => !!d).sort()[0] ?? null;
  const eol = num(first.specs?.eol_pct);
  return {
    ratedCapacityKwh: Number(usable.toFixed(3)),
    ratedCycleLife: Math.min(...lives),
    endOfLifePct: eol !== null && eol >= 50 && eol <= 95 ? eol : 80,
    baselineDischargedKwh: units.reduce((sum, u) => sum + Math.max(0, u.baselineDischargedKwh ?? 0), 0) / units.length,
    installedOn: installed ? installed.slice(0, 10) : null,
    chemistry: typeof first.specs?.chemistry === "string" ? (first.specs.chemistry as string) : null,
  };
}

/** Equivalent full cycles since the battery was installed. Null when the counter is missing or the profile has no size. */
export function equivalentFullCycles(dischargedKwh: number | null | undefined, profile: Pick<BatteryProfile, "ratedCapacityKwh" | "baselineDischargedKwh">): number | null {
  if (typeof dischargedKwh !== "number" || !Number.isFinite(dischargedKwh) || profile.ratedCapacityKwh <= 0) return null;
  return Math.max(0, dischargedKwh - profile.baselineDischargedKwh) / profile.ratedCapacityKwh;
}

/** Share of the rated cycle life already used (0-100+, it can pass 100 for a battery past its rating). */
export function cycleLifeUsedPct(efc: number | null, ratedCycleLife: number): number | null {
  if (efc === null || ratedCycleLife <= 0) return null;
  return (efc / ratedCycleLife) * 100;
}

/** Health from usage alone: a straight line from 100% (new) to `endOfLifePct` at the rated cycle life, then on past it. */
export function healthFromUsage(efc: number | null, profile: Pick<BatteryProfile, "ratedCycleLife" | "endOfLifePct">): number | null {
  if (efc === null || profile.ratedCycleLife <= 0) return null;
  return Math.max(0, Math.min(100, 100 - (100 - profile.endOfLifePct) * (efc / profile.ratedCycleLife)));
}

/** Years left until the rated cycle life is used up, at the recent pace (cycles per day). Null while the pace is unknown
 *  or too low to say anything sensible (under 0.02 cycles a day is more than 130 years). */
export function yearsLeft(efc: number | null, ratedCycleLife: number, cyclesPerDay: number | null): number | null {
  if (efc === null || cyclesPerDay === null || cyclesPerDay < 0.02) return null;
  return Math.max(0, ratedCycleLife - efc) / cyclesPerDay / 365;
}

/** Cycles per day over the days given (each value: that day's energy discharged, kWh). Days without a reading are skipped. */
export function cyclesPerDay(dailyDischargedKwh: (number | null)[], ratedCapacityKwh: number): number | null {
  const days = dailyDischargedKwh.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (days.length < 3 || ratedCapacityKwh <= 0) return null;
  return days.reduce((s, v) => s + v, 0) / days.length / ratedCapacityKwh;
}

// ------------------------------------------------------------------ measuring the capacity

/** A discharge needs at least this many SOC points to be used for a capacity measurement. */
export const MIN_SOC_SWING = 30;
export const MIN_WINDOW_SLOTS = 3;
const DISCHARGING_W = 50;

/** One 15-minute slot of the battery: SOC at its highest and lowest, average power (positive = discharging) and the
 *  seconds the average covers. */
export interface BatterySlot {
  t: number;
  socMax: number | null;
  socMin: number | null;
  powerW: number | null;
  coveredS: number;
}

export interface CapacityEstimate {
  /** Usable capacity, kWh, worked out from one discharge. */
  kwh: number;
  socSwing: number;
  energyKwh: number;
  /** Start of the discharge (epoch ms). */
  startMs: number;
}

const SLOT_MS = 900_000;

/** Every long discharge in the slots (consecutive slots, battery discharging, SOC falling by at least MIN_SOC_SWING
 *  points) and the capacity each one implies: energy delivered / fraction of the SOC range used. */
export function capacityEstimates(slots: BatterySlot[]): CapacityEstimate[] {
  const out: CapacityEstimate[] = [];
  let run: BatterySlot[] = [];
  const flush = () => {
    if (run.length >= MIN_WINDOW_SLOTS) {
      const first = run[0];
      const last = run[run.length - 1];
      if (first.socMax !== null && last.socMin !== null) {
        const swing = first.socMax - last.socMin;
        const energyKwh = run.reduce((s, r) => s + ((r.powerW ?? 0) * r.coveredS) / 3_600_000, 0);
        if (swing >= MIN_SOC_SWING && energyKwh > 0) out.push({ kwh: energyKwh / (swing / 100), socSwing: swing, energyKwh, startMs: first.t });
      }
    }
    run = [];
  };
  for (const slot of slots) {
    const discharging = slot.powerW !== null && slot.powerW > DISCHARGING_W && slot.socMax !== null && slot.socMin !== null && slot.coveredS > 0;
    const adjacent = run.length === 0 || slot.t - run[run.length - 1].t === SLOT_MS;
    if (discharging && adjacent) run.push(slot);
    else {
      flush();
      if (discharging) run.push(slot);
    }
  }
  flush();
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export type HealthSource = "measured" | "usage";

export interface BatteryHealth {
  efc: number | null;
  cycleLifeUsedPct: number | null;
  /** Cycles per day at the recent pace and the years that leaves. */
  cyclesPerDay: number | null;
  yearsLeft: number | null;
  /** State of health, % of new. Measured from the discharges when there are enough, else from usage. */
  sohPct: number | null;
  sohSource: HealthSource | null;
  /** The measured usable capacity (kWh), median of the discharges; null when none was long enough. */
  measuredKwh: number | null;
  /** How many discharges the measurement rests on. */
  samples: number;
}

/** Everything the page shows about the battery's wear. `estimates` are capacity measurements (see capacityEstimates); the
 *  newest ones count, up to the last ten. A measurement above the rating is capped at 100% (the datasheet is conservative). */
export function batteryHealth(input: { profile: BatteryProfile; dischargedKwh: number | null | undefined; dailyDischargedKwh: (number | null)[]; estimates: CapacityEstimate[] }): BatteryHealth {
  const { profile } = input;
  const efc = equivalentFullCycles(input.dischargedKwh, profile);
  const pace = cyclesPerDay(input.dailyDischargedKwh, profile.ratedCapacityKwh);
  const recent = [...input.estimates].sort((a, b) => b.startMs - a.startMs).slice(0, 10);
  const measuredKwh = recent.length >= 1 ? median(recent.map((e) => e.kwh)) : null;
  const measuredPct = measuredKwh !== null ? Math.min(100, (measuredKwh / profile.ratedCapacityKwh) * 100) : null;
  const usagePct = healthFromUsage(efc, profile);
  return {
    efc,
    cycleLifeUsedPct: cycleLifeUsedPct(efc, profile.ratedCycleLife),
    cyclesPerDay: pace,
    yearsLeft: yearsLeft(efc, profile.ratedCycleLife, pace),
    sohPct: measuredPct ?? usagePct,
    sohSource: measuredPct !== null ? "measured" : usagePct !== null ? "usage" : null,
    measuredKwh,
    samples: recent.length,
  };
}
