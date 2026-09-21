import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { fetchDeviceParameterReadings } from "@/lib/device-catalog-data";
import { PerformanceChart, DivergingBarChart } from "./lazy-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aggregateDailyYield, zipDailySeries, type RawReading } from "@/lib/energy-aggregation";
import { MONTH_TOTAL_FIELDS, YEAR_TOTAL_FIELDS, LIFETIME_TOTAL_FIELDS, formatValue } from "@/lib/telemetry-catalog";
import { formatDuration } from "@/lib/format-duration";
import { DeviceParameterCards } from "./device-parameter-cards";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const HISTORY_DAYS = 180;
const TOTALS_KEYS = [...MONTH_TOTAL_FIELDS, ...YEAR_TOTAL_FIELDS, ...LIFETIME_TOTAL_FIELDS].map((f) => f.key);
const YIELD_KEY = "solar_energy_today_kwh";
const SOLAR_KEYS = [
  YIELD_KEY,
  "day_battery_charge_kwh",
  "day_battery_discharge_kwh",
  "grid_buy_energy_today_kwh",
  "grid_sell_energy_today_kwh",
];

/** Picks the right category-specific Performance body — mirrors
 *  DeviceOverviewContent/MonitoringContent's dispatch pattern (Phases 1-2).
 *  A category without one yet falls back to the same generic parameter
 *  cards every other unhandled category gets elsewhere. */
export async function PerformanceContent({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterPerformance supabase={supabase} device={device} />;
  }
  if (category === "ev_charger") {
    return <EvChargerPerformance supabase={supabase} device={device} />;
  }

  const parameters = await fetchDeviceParameterReadings(supabase, device);
  return <DeviceParameterCards parameters={parameters} />;
}

function TotalTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-theme-border bg-theme-surface p-3">
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-theme-primary">{value}</p>
    </div>
  );
}

async function SolarInverterPerformance({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // Three independent device-scoped reads, one round trip instead of
  // three — the totals snapshot is the same "latest value per instrument"
  // pattern Overview/Monitoring already use, just scoped to the
  // month/year/lifetime counter keys instead of live telemetry.
  const [{ data }, { data: lifetimeRow }, { data: totalsRows }] = await Promise.all([
    supabase
      .from("device_readings")
      .select("device_id, instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", SOLAR_KEYS)
      .eq("is_test", false)
      .gte("ts", since.toISOString())
      .order("ts", { ascending: true }),
    supabase
      .from("device_readings")
      .select("value")
      .eq("device_id", device.id)
      .eq("instrument_key", "total_pv_energy_kwh")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", TOTALS_KEYS)
      .order("ts", { ascending: false })
      .limit(TOTALS_KEYS.length * 5),
  ]);

  const rows = data ?? [];
  const lifetimePvKwh = lifetimeRow?.value ?? null;
  const totals = new Map<string, number | null>();
  for (const r of totalsRows ?? []) {
    if (!totals.has(r.instrument_key)) totals.set(r.instrument_key, r.value);
  }
  const getTotal = (key: string) => totals.get(key) ?? null;

  const byKey = (key: string): RawReading[] =>
    rows.filter((r) => r.instrument_key === key).map((r) => ({ device_id: r.device_id, value: r.value, ts: r.ts }));

  const daily = aggregateDailyYield(byKey(YIELD_KEY));
  const batteryCharge = aggregateDailyYield(byKey("day_battery_charge_kwh"));
  const batteryDischarge = aggregateDailyYield(byKey("day_battery_discharge_kwh"));
  const gridImport = aggregateDailyYield(byKey("grid_buy_energy_today_kwh"));
  const gridExport = aggregateDailyYield(byKey("grid_sell_energy_today_kwh"));

  const batteryDiverging = zipDailySeries(batteryCharge, batteryDischarge);
  const gridDiverging = zipDailySeries(gridExport, gridImport);

  const totalYield = daily.reduce((sum, p) => sum + p.value, 0);
  const totalExported = gridExport.reduce((sum, p) => sum + p.value, 0);
  const selfConsumptionPct = totalYield > 0 ? Math.max(0, Math.min(100, ((totalYield - totalExported) / totalYield) * 100)) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Self-consumption (last {HISTORY_DAYS}d)
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {selfConsumptionPct !== null ? `${selfConsumptionPct.toFixed(0)}%` : "No data yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total PV energy (lifetime)</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {lifetimePvKwh !== null ? `${lifetimePvKwh.toLocaleString("en-IN")} kWh` : "No data yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
        <PerformanceChart daily={daily} unit="kWh" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Battery: Charge vs. Discharge</CardTitle>
        </CardHeader>
        <CardContent>
          <DivergingBarChart data={batteryDiverging} positiveLabel="Charged" negativeLabel="Discharged" unit="kWh" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Grid: Export vs. Import</CardTitle>
        </CardHeader>
        <CardContent>
          <DivergingBarChart data={gridDiverging} positiveLabel="Exported" negativeLabel="Imported" unit="kWh" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Period &amp; Lifetime Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">This month</p>
            <div className="grid grid-cols-3 gap-4">
              {MONTH_TOTAL_FIELDS.map((field) => (
                <TotalTile key={field.key} label={field.label} value={formatValue(getTotal(field.key), field)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">This year</p>
            <div className="grid grid-cols-3 gap-4">
              {YEAR_TOTAL_FIELDS.map((field) => (
                <TotalTile key={field.key} label={field.label} value={formatValue(getTotal(field.key), field)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifetime</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {LIFETIME_TOTAL_FIELDS.map((field) => (
                <TotalTile key={field.key} label={field.label} value={formatValue(getTotal(field.key), field)} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

async function EvChargerPerformance({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HISTORY_DAYS);

  // energy_active_import_register_kwh is OCPP's lifetime meter register —
  // monotonically non-decreasing, so the "max seen per day" aggregateDailyYield
  // already computes is exactly the day's ending cumulative value (never
  // resets, so max == last within a day). aggregationMode="last" below
  // then makes weekly/monthly rollups take that latest value instead of
  // summing it (summing a cumulative series would double-count).
  const [{ data: energyRows }, { data: sessions }] = await Promise.all([
    supabase
      .from("device_readings")
      .select("device_id, instrument_key, value, ts")
      .eq("device_id", device.id)
      .eq("instrument_key", "energy_active_import_register_kwh")
      .eq("is_test", false)
      .gte("ts", since.toISOString())
      .order("ts", { ascending: true }),
    supabase
      .from("charging_sessions")
      .select("id, started_at, ended_at, start_energy_kwh, end_energy_kwh, stop_reason")
      .eq("device_id", device.id)
      .order("started_at", { ascending: false })
      .limit(30),
  ]);

  const daily = aggregateDailyYield((energyRows ?? []).map((r) => ({ device_id: r.device_id, value: r.value, ts: r.ts })));

  return (
    <>
      <div className="rounded-xl border border-theme-border bg-theme-bg p-4">
        <PerformanceChart daily={daily} unit="kWh" aggregationMode="last" totalLabel="Total energy delivered" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Charging Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {!sessions || sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No charging sessions recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Energy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const energy =
                    s.end_energy_kwh !== null && s.start_energy_kwh !== null ? s.end_energy_kwh - s.start_energy_kwh : null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-foreground">
                        {new Date(s.started_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDuration(s.started_at, s.ended_at)}</TableCell>
                      <TableCell className="text-right text-foreground">{energy !== null ? `${energy.toFixed(1)} kWh` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
