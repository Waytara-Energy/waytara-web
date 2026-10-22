"use client";

import * as React from "react";
import { DEFAULT_UNIT_PREFS, displayValue, formatShown, seriesConverter, shownUnit, type Shown, type UnitPrefs } from "@/lib/unit-prefs";
import { formatFieldValue, type FieldValue, type TemplateField } from "@/lib/template-field-format";

interface UnitsContextValue {
  prefs: UnitPrefs;
  /** replaces the choices at once (the settings screen does this when they are saved, so every open page follows without a reload) */
  setPrefs: (next: UnitPrefs) => void;
}

const UnitsContext = React.createContext<UnitsContextValue>({ prefs: DEFAULT_UNIT_PREFS, setPrefs: () => undefined });

/** Holds the person's unit choices for the dashboard. Mounted once in the dashboard layout; `initial` is what the server read from their
 *  profile. Outside this provider every reading is shown in the unit the device reports it in. */
export function UnitsProvider({ initial, children }: { initial: UnitPrefs; children: React.ReactNode }) {
  const [prefs, setPrefs] = React.useState<UnitPrefs>(initial);
  // a fresh value from the server (after the page refreshes) replaces the local copy
  const [seen, setSeen] = React.useState(() => JSON.stringify(initial));
  const incoming = JSON.stringify(initial);
  if (incoming !== seen) {
    setSeen(incoming);
    setPrefs(initial);
  }
  const value = React.useMemo(() => ({ prefs, setPrefs }), [prefs]);
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

/** The unit choices and the ways to apply them. `nativeUnit` is the unit the number is in as the device or the page has it ("kW", "kWh", "°C");
 *  `key` is the reading's key when it has one (so a choice made for that one reading is honoured). */
export function useUnits() {
  const { prefs, setPrefs } = React.useContext(UnitsContext);
  return React.useMemo(
    () => ({
      prefs,
      setPrefs,
      /** the number and unit to show */
      show: (value: number, nativeUnit: string | null | undefined, key?: string | null): Shown => displayValue(value, nativeUnit, prefs, key),
      /** "6,500 W" (or "6.50 kW" when nothing was chosen); `ownDecimals` is how many decimals the page prints when the unit is unchanged */
      format: (value: number, nativeUnit: string | null | undefined, key?: string | null, ownDecimals = 1, withUnit = true): string => formatShown(displayValue(value, nativeUnit, prefs, key), ownDecimals, withUnit),
      /** the unit text a reading is shown in */
      unit: (nativeUnit: string | null | undefined, key?: string | null): string => shownUnit(nativeUnit, prefs, key),
      /** for chart data: how to convert a value and what to print, or null when nothing is converted */
      series: (nativeUnit: string | null | undefined, key?: string | null) => seriesConverter(nativeUnit, prefs, key),
      /** the dashboard field formatter with the choices applied */
      field: (value: FieldValue, field: TemplateField): string => formatFieldValue(value, field, prefs),
    }),
    [prefs, setPrefs],
  );
}

/** A chart's unit under the person's choices: the label to print, how to convert each value, and how many decimals to print when converted.
 *  When nothing is converted it is the unit as given and an identity mapping (`converted: false`). Stable between renders, so it is safe in
 *  a memo's dependencies. */
export function useSeriesUnit(nativeUnit: string | null | undefined, key?: string | null): { unit: string; map: (v: number) => number; decimals: number; converted: boolean } {
  const { prefs } = React.useContext(UnitsContext);
  return React.useMemo(() => {
    const c = seriesConverter(nativeUnit, prefs, key);
    return c ? { unit: c.unit, map: c.map, decimals: c.decimals, converted: true } : { unit: nativeUnit ?? "", map: (v: number) => v, decimals: 0, converted: false };
  }, [nativeUnit, key, prefs]);
}
