// Solar generation is the DC power of the PV inputs (MPPT strings) that this device really has - pv1_power_w +
// pv2_power_w + ... - and NOT inverter_output_power_w, which is the AC output: on a hybrid inverter that also carries
// battery discharge (and loses some to conversion), so it overstates what the panels produce.

const PV_POWER_KEY = /^pv(\d+)_power_w$/;

/** The PV power keys among `keys` (a device's enabled metrics), in input order: pv1, pv2, pv3 ... */
export function pvPowerKeys(keys: Iterable<string>): string[] {
  const found: { key: string; n: number }[] = [];
  for (const key of keys) {
    const m = PV_POWER_KEY.exec(key);
    if (m) found.push({ key, n: Number(m[1]) });
  }
  return found.sort((a, b) => a.n - b.n).map((f) => f.key);
}

/** Sum of the PV inputs that have a reading; null when none has one (nothing to show). */
export function sumPvPower(values: Record<string, number | null | undefined>, pvKeys: string[]): number | null {
  let total = 0;
  let any = false;
  for (const key of pvKeys) {
    const v = values[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

/** The device's solar generation: the PV sum, or - for a device with no PV power registers enabled - its AC output. */
export function solarGenerationW(values: Record<string, number | null | undefined>, pvKeys: string[]): number | null {
  if (pvKeys.length === 0) return values.inverter_output_power_w ?? null;
  return sumPvPower(values, pvKeys);
}
