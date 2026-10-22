// Converting a value between the units a device's settings and readings use (watts and kilowatts, volts, amps, kilowatt-hours, degrees ...).
// Linear units go through a base unit; temperature has its own rules.

export interface UnitDef {
  id: string;
  label: string;
  /** how many base units one of this unit is (not used for temperature) */
  factor: number;
}

export interface Quantity {
  id: string;
  label: string;
  units: UnitDef[];
}

export const QUANTITIES: Quantity[] = [
  { id: "power", label: "Power", units: [{ id: "W", label: "W", factor: 1 }, { id: "kW", label: "kW", factor: 1000 }, { id: "MW", label: "MW", factor: 1_000_000 }, { id: "hp", label: "hp", factor: 745.699872 }] },
  { id: "energy", label: "Energy", units: [{ id: "Wh", label: "Wh", factor: 1 }, { id: "kWh", label: "kWh", factor: 1000 }, { id: "MWh", label: "MWh", factor: 1_000_000 }, { id: "MJ", label: "MJ", factor: 277.777778 }] },
  { id: "voltage", label: "Voltage", units: [{ id: "mV", label: "mV", factor: 0.001 }, { id: "V", label: "V", factor: 1 }, { id: "kV", label: "kV", factor: 1000 }] },
  { id: "current", label: "Current", units: [{ id: "mA", label: "mA", factor: 0.001 }, { id: "A", label: "A", factor: 1 }, { id: "kA", label: "kA", factor: 1000 }] },
  { id: "temperature", label: "Temperature", units: [{ id: "C", label: "°C", factor: 1 }, { id: "F", label: "°F", factor: 1 }, { id: "K", label: "K", factor: 1 }] },
  { id: "time", label: "Time", units: [{ id: "s", label: "seconds", factor: 1 }, { id: "min", label: "minutes", factor: 60 }, { id: "h", label: "hours", factor: 3600 }, { id: "d", label: "days", factor: 86_400 }] },
  { id: "frequency", label: "Frequency", units: [{ id: "Hz", label: "Hz", factor: 1 }, { id: "kHz", label: "kHz", factor: 1000 }] },
];

const toCelsius = (v: number, unit: string): number => (unit === "F" ? ((v - 32) * 5) / 9 : unit === "K" ? v - 273.15 : v);
const fromCelsius = (c: number, unit: string): number => (unit === "F" ? (c * 9) / 5 + 32 : unit === "K" ? c + 273.15 : c);

/** `value` in `from` expressed in `to`, both units of the quantity `quantityId`. Null for an unknown quantity or unit, or a value that is not a number. */
export function convert(value: number, quantityId: string, from: string, to: string): number | null {
  if (!Number.isFinite(value)) return null;
  const q = QUANTITIES.find((x) => x.id === quantityId);
  const a = q?.units.find((u) => u.id === from);
  const b = q?.units.find((u) => u.id === to);
  if (!q || !a || !b) return null;
  if (q.id === "temperature") return fromCelsius(toCelsius(value, from), to);
  return (value * a.factor) / b.factor;
}

/** A result for display: up to 6 significant digits, no trailing zeros, no exponent for ordinary sizes. */
export function formatConverted(n: number | null): string {
  if (n === null) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-6) return n.toExponential(3);
  const s = Number(n.toPrecision(6));
  return s.toLocaleString("en-IN", { maximumFractionDigits: 10 });
}

/** The quantity a setting's unit text belongs to ("kW" → power), so the converter can open ready for it. */
export function quantityOfUnit(unit: string | null | undefined): { quantity: string; unit: string } | null {
  if (!unit) return null;
  const clean = unit.trim().replace("°", "");
  for (const q of QUANTITIES) {
    const hit = q.units.find((u) => u.id === clean || u.label === unit.trim());
    if (hit) return { quantity: q.id, unit: hit.id };
  }
  return null;
}
