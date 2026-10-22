// Putting the person's unit choices into a trend chart (the Monitoring and Overview bar/line charts). Those charts take raw readings, multiply
// them by a scale into the unit they print (default: watts to kW) and add up energy as "that unit x hours". So a chosen unit is a different
// scale and a different label; totals follow the power unit (kW -> kWh, W -> Wh) unless the person chose an energy unit of their own.
// Only straight conversions (power, energy, voltage, current) are applied here; temperature charts keep their unit.

import { convert, quantityOfUnit } from "./unit-convert";
import { displayValue, type UnitPrefs } from "./unit-prefs";

interface ChartSeriesLike {
  key: string;
  unit?: string;
  scale?: number;
  footerUnit?: string;
  /** set here: multiplies this series' totals / running totals into the unit chosen for energy */
  footerScale?: number;
  cumulativeOf?: string;
}

interface ChartPropsLike<S extends ChartSeriesLike> {
  series: S[];
  valueScale?: number;
  unit?: string;
  footerUnit?: string;
  referenceLines?: { value: number; unit: string; label: string; color?: string }[];
}

const ENERGY_OF_POWER: Record<string, string> = { W: "Wh", kW: "kWh", MW: "MWh" };

/** The factor and the unit label for a reading printed in `unit`, by the person's choice (1 and the same label when nothing is chosen). */
export function linearUnit(unit: string, prefs: UnitPrefs, key?: string | null): { factor: number; unit: string } {
  const q = quantityOfUnit(unit);
  if (!q || q.quantity === "temperature") return { factor: 1, unit };
  const shown = displayValue(1, unit, prefs, key);
  return shown.converted ? { factor: shown.value, unit: shown.unit } : { factor: 1, unit };
}

/** What a total of `powerUnit x hours` is called and how to scale it: the power unit's own energy unit (kW -> kWh), or the energy unit the person chose. */
function energyTotal(powerUnit: string, prefs: UnitPrefs, key: string | null): { unit: string; factor: number } {
  const own = ENERGY_OF_POWER[quantityOfUnit(powerUnit)?.unit ?? ""] ?? null;
  if (!own) return { unit: "kWh", factor: 1 };
  const wanted = (key ? prefs.overrides[key] : undefined) ?? prefs.defaults.energy;
  const target = wanted && quantityOfUnit(wanted)?.quantity === "energy" ? quantityOfUnit(wanted)!.unit : null;
  if (!target || target === own) return { unit: own, factor: 1 };
  const factor = convert(1, "energy", own, target);
  const label = displayValue(1, "kWh", { defaults: { energy: target }, overrides: {} }).unit;
  return factor === null ? { unit: own, factor: 1 } : { unit: label, factor };
}

/** The chart's props with the person's units applied. Returns the same props untouched when nothing is chosen. */
export function applyChartUnits<S extends ChartSeriesLike, P extends ChartPropsLike<S>>(props: P, prefs: UnitPrefs): P {
  if (Object.keys(prefs.defaults).length === 0 && Object.keys(prefs.overrides).length === 0) return props;

  const baseUnit = props.unit ?? "kW";
  const baseScale = props.valueScale ?? 0.001;
  const baseFooter = props.footerUnit ?? "kWh";
  const first = linearUnit(baseUnit, prefs, props.series[0]?.key);
  const baseTotals = energyTotal(first.unit, prefs, props.series[0]?.key ?? null);
  const footerIsEnergyOfPower = quantityOfUnit(baseFooter)?.quantity === "energy" && !!ENERGY_OF_POWER[quantityOfUnit(baseUnit)?.unit ?? ""];

  // each series' unit first, so a running total can follow the unit of the series it adds up
  const units = new Map(props.series.map((s) => [s.key, linearUnit(s.unit ?? baseUnit, prefs, s.key)]));
  const series = props.series.map((s) => {
    const ownUnit = s.unit ?? baseUnit;
    const lu = units.get(s.key)!;
    const out: S = { ...s, unit: lu.unit, scale: (s.scale ?? baseScale) * lu.factor };
    if (s.cumulativeOf) {
      // a running total of another series: in that series' energy unit, or the one chosen for energy
      const baseSeries = props.series.find((b) => b.key === s.cumulativeOf);
      const t = energyTotal(units.get(s.cumulativeOf)?.unit ?? first.unit, prefs, baseSeries?.key ?? s.key);
      out.unit = t.unit;
      out.footerUnit = t.unit;
      out.footerScale = t.factor;
    } else if (quantityOfUnit(s.footerUnit ?? baseFooter)?.quantity === "energy" && !!ENERGY_OF_POWER[quantityOfUnit(ownUnit)?.unit ?? ""]) {
      const t = energyTotal(lu.unit, prefs, s.key);
      out.footerUnit = t.unit;
      out.footerScale = t.factor;
    }
    return out;
  });

  const converted = {
    ...props,
    series,
    valueScale: baseScale * first.factor,
    unit: first.unit,
    ...(footerIsEnergyOfPower ? { footerUnit: baseTotals.unit } : {}),
    referenceLines: props.referenceLines?.map((r) => {
      const lu = linearUnit(r.unit, prefs);
      return { ...r, value: r.value * lu.factor, unit: lu.unit };
    }),
  };
  return converted as P;
}
