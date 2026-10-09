import "server-only";
import type { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { fetchSeriesRows, type SeriesRowOut } from "@/lib/device-readings-fetch";
import { deriveFaultEvents, type FaultEvent } from "@/lib/deye-fault-codes";
import { FAULT_BITMASK_KEYS } from "@/lib/overview-keys";
import { HEALTH_KEYS } from "@/lib/maintenance-health";
import { hasRecord } from "@/lib/field-values";
import { fetchDashboardFields, fetchFieldValues, type FieldValue, type TemplateField } from "@/lib/template-fields";
import { TEMPERATURE_MAX_C } from "@/lib/temperature-thresholds";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const FAULT_HISTORY_DAYS = 30;
const TEMPERATURE_GAUGE_KEYS = ["battery_temperature_c", "inverter_dc_temperature_c", "inverter_ac_temperature_c"];

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600 * 1000);

export interface GaugeField {
  key: string;
  label: string;
  warnAboveC: number;
}

/** Everything the Health tab of a solar inverter needs, read once when the page is rendered; the page then follows the live channel. */
export interface SolarHealthData {
  /** The registers the checks read, as the server last saw them. */
  initial: Record<string, number | null>;
  faultEvents: FaultEvent[];
  /** The fault history could not be read just now (the database was busy): say so rather than claim there were no faults. */
  faultHistoryFailed: boolean;
  gauges: GaugeField[];
  /** About a day ago, for each gauge's trend arrow. */
  previousTemps: Record<string, number | null>;
  /** The device's own Maintenance fields (for the collapsed technical details), with the values read now. */
  technical: { category: string; groupName: string | null; fields: TemplateField[]; values: Record<string, FieldValue> }[];
}

/** A read that may fail (the database can time out on a heavy window) without taking the whole page down. */
async function tryRows(read: Promise<SeriesRowOut[]>): Promise<{ rows: SeriesRowOut[]; failed: boolean }> {
  try {
    return { rows: await read, failed: false };
  } catch {
    return { rows: [], failed: true };
  }
}

const DAY_MS = 86_400_000;

/** The fault episodes between two instants (any window up to 90 days), read lightly: a short window at 2-hour precision, a long one as
 *  the last week at 2 hours plus the days before it by day (a day's highest fault word). Each read is a single page of rows.
 *  A read that fails (the database was busy) comes back as `failed`, never as "no faults". */
export async function fetchFaultEvents(supabase: SupabaseServerClient, deviceId: string, fromMs: number, toMs: number): Promise<{ events: FaultEvent[]; failed: boolean }> {
  const split = Date.now() - 7 * DAY_MS;
  const span = (toMs - fromMs) / DAY_MS;
  const reads: Promise<{ rows: SeriesRowOut[]; failed: boolean }>[] = [];
  const read = (a: number, b: number, minutes: number) => tryRows(fetchSeriesRows(supabase, deviceId, FAULT_BITMASK_KEYS, new Date(a).toISOString(), new Date(b).toISOString(), minutes));
  if (span <= 8) reads.push(read(fromMs, toMs, 120));
  else {
    if (fromMs < split) reads.push(read(fromMs, Math.min(toMs, split), 1440));
    if (toMs > split) reads.push(read(Math.max(fromMs, split), toMs, 120));
  }
  const done = await Promise.all(reads);
  const rows = done
    .flatMap((d) => d.rows)
    .filter((r) => r.max_value !== null)
    .map((r) => ({ value: r.max_value as number, ts: r.bucket }))
    .sort((a, b) => a.ts.localeCompare(b.ts));
  return { events: deriveFaultEvents(rows), failed: done.some((d) => d.failed) };
}

export async function fetchSolarHealthData(supabase: SupabaseServerClient, device: CustomerDevice): Promise<SolarHealthData> {
  const [sections, monitoringSections] = await Promise.all([fetchDashboardFields(supabase, device, "Maintenance"), fetchDashboardFields(supabase, device, "Monitoring")]);
  const technicalFields = sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  // The gauge labels come from the device's own Monitoring fields, never a copy here that could drift from what the sensor is called there.
  const byKey = new Map(monitoringSections.flatMap((s) => s.groups.flatMap((g) => g.fields)).map((f) => [f.key, f]));
  const gauges: GaugeField[] = TEMPERATURE_GAUGE_KEYS.map((key) => byKey.get(key))
    .filter((f): f is TemplateField => f !== undefined && f.key in TEMPERATURE_MAX_C)
    .map((f) => ({ key: f.key, label: f.label, warnAboveC: TEMPERATURE_MAX_C[f.key] }));
  const tempKeys = gauges.map((g) => g.key);

  const dayAgo = hoursAgo(24);
  const windowStart = new Date(dayAgo.getTime() - 2 * 3600 * 1000).toISOString();
  const windowEnd = new Date(dayAgo.getTime() + 2 * 3600 * 1000).toISOString();

  const wanted = Array.from(new Set([...technicalFields.map((f) => f.key), ...HEALTH_KEYS, ...FAULT_BITMASK_KEYS, ...tempKeys]));
  const [rawValues, faults, past] = await Promise.all([
    fetchFieldValues(supabase, device.id, wanted),
    fetchFaultEvents(supabase, device.id, Date.now() - FAULT_HISTORY_DAYS * DAY_MS, Date.now()),
    tempKeys.length > 0 ? tryRows(fetchSeriesRows(supabase, device.id, tempKeys, windowStart, windowEnd, 15)) : Promise.resolve({ rows: [] as SeriesRowOut[], failed: false }),
  ]);
  const pastBuckets = past.rows;

  const previousTemps: Record<string, number | null> = {};
  for (const r of pastBuckets) if (r.avg_value !== null && !(r.key_name in previousTemps)) previousTemps[r.key_name] = r.avg_value;

  const num = (key: string): number | null => {
    const v = rawValues.get(key);
    return typeof v === "number" ? v : null;
  };
  const initial: Record<string, number | null> = {};
  for (const key of [...HEALTH_KEYS, ...FAULT_BITMASK_KEYS, ...tempKeys]) initial[key] = num(key);

  return {
    initial,
    faultEvents: faults.events,
    faultHistoryFailed: faults.failed,
    gauges,
    previousTemps,
    // Only the readings that hold a record: a group whose rows are all empty or zero is left out, and so is the panel when none remain.
    technical: sections
      .flatMap((s) =>
        s.groups.map((g) => {
          const fields = g.fields.filter((f) => hasRecord(rawValues.get(f.key)));
          return { category: s.category, groupName: g.groupName, fields, values: Object.fromEntries(fields.map((f) => [f.key, (rawValues.get(f.key) ?? null) as FieldValue])) };
        })
      )
      .filter((g) => g.fields.length > 0),
  };
}
