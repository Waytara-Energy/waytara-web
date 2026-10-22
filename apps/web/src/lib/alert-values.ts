// The numbers alerts are judged on: for one site, from the latest readings of its inverters (and the customer's rate). A site can have more
// than one inverter: flows and day totals add up, the battery level averages, the hottest battery wins (the same rules as the Overview).

import { pvPowerKeys, solarGenerationW } from "./solar-generation";

/** The readings the alerts need; the evaluation job asks for exactly these. */
export const ALERT_READING_KEYS: string[] = [
  "battery_soc_pct",
  "battery_power_w",
  "battery_temperature_c",
  "inverter_output_power_w",
  ...Array.from({ length: 8 }, (_, i) => `pv${i + 1}_power_w`),
  "grid_total_power_w",
  "load_total_power_w",
  "day_pv_energy_kwh",
  "day_grid_import_energy_kwh",
  "day_grid_export_energy_kwh",
  "day_load_energy_kwh",
];

type Readings = Record<string, number | null | undefined>;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function sum(devices: readonly Readings[], key: string): number | null {
  let total = 0;
  let any = false;
  for (const d of devices) {
    const v = d[key];
    if (finite(v)) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

/** Every metric of alert-rules.ts for one site: kW for powers, kWh for day totals, % for the battery level, rupees for cost. Null where the
 *  site has no reading (a metric nobody reports never fires). */
export function siteMetricValues(devices: readonly Readings[], tariffRate: number | null): Record<string, number | null> {
  const soc = devices.map((d) => d.battery_soc_pct).filter(finite);
  const temps = devices.map((d) => d.battery_temperature_c).filter(finite);
  const batteryW = sum(devices, "battery_power_w");
  const gridW = sum(devices, "grid_total_power_w");
  const loadW = sum(devices, "load_total_power_w");
  let solarW: number | null = null;
  for (const d of devices) {
    const w = solarGenerationW(d, pvPowerKeys(Object.keys(d)));
    if (finite(w)) solarW = (solarW ?? 0) + w;
  }
  const solarToday = sum(devices, "day_pv_energy_kwh");
  const importToday = sum(devices, "day_grid_import_energy_kwh");
  const exportToday = sum(devices, "day_grid_export_energy_kwh");
  const loadToday = sum(devices, "day_load_energy_kwh");
  const rate = tariffRate !== null && Number.isFinite(tariffRate) ? tariffRate : null;
  const times = (kwh: number | null) => (kwh !== null && rate !== null ? kwh * rate : null);

  return {
    battery_soc: soc.length > 0 ? soc.reduce((a, b) => a + b, 0) / soc.length : null,
    battery_charge_kw: batteryW === null ? null : Math.max(0, -batteryW) / 1000,
    battery_discharge_kw: batteryW === null ? null : Math.max(0, batteryW) / 1000,
    battery_temp_c: temps.length > 0 ? Math.max(...temps) : null,
    solar_kw: solarW === null ? null : solarW / 1000,
    solar_today_kwh: solarToday,
    grid_import_kw: gridW === null ? null : Math.max(0, gridW) / 1000,
    grid_export_kw: gridW === null ? null : Math.max(0, -gridW) / 1000,
    import_today_kwh: importToday,
    export_today_kwh: exportToday,
    load_kw: loadW === null ? null : loadW / 1000,
    load_today_kwh: loadToday,
    tariff_rate: rate,
    import_cost_today: times(importToday),
    solar_value_today: times(solarToday),
  };
}
