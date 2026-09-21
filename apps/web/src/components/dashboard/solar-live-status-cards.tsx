import { Sun, Home, BatteryCharging, Zap } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import type { CustomerSite } from "@/lib/selected-site";
import { fetchDeviceRecentSeries, type LiveSeriesPoint } from "@/lib/device-overview";
import { LiveStatusCard, type SparkPoint, type SparkTone, type StatusTone } from "./live-status-card";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SPARK_POINTS = 60;

function toKw(watts: number | null): string {
  return watts === null ? "—" : `${(watts / 1000).toFixed(2)} kW`;
}

function latestValue(series: LiveSeriesPoint[]): number | null {
  return series.length > 0 ? series[series.length - 1].value : null;
}

/** Builds a sparkline whose bars are colored by `tone` and whose hover
 *  display text is pre-formatted by `format`, both computed per point from
 *  that point's own value and the series' own peak — `format` runs here,
 *  server-side, rather than being passed down as a prop, since a function
 *  can't cross into the sparkline's client-side hover component. */
function toSparkline(
  series: LiveSeriesPoint[],
  tone: (value: number, max: number) => SparkTone,
  format: (value: number) => string
): SparkPoint[] {
  const points = series.filter((p): p is { value: number; ts: string } => p.value !== null);
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return points.map((p) => ({ value: p.value, tone: tone(p.value, max), ts: p.ts, display: format(p.value) }));
}

// Power generation/draw: 0 is idle (gray), a low fraction of this series'
// own recent peak is yellow (underperforming relative to itself), and a
// healthy fraction is green — there's no "bad" reading for a magnitude
// like this, just idle vs weak vs strong.
function outputTone(value: number, max: number): SparkTone {
  if (value <= 0) return "gray";
  return value / max < 0.34 ? "yellow" : "green";
}

// Consumption: unlike generation, a *high* draw is the thing worth
// flagging (more grid dependence, more cost) — low usage is green, a
// mid-range draw is yellow, and a peak-range draw is red.
function loadTone(value: number, max: number): SparkTone {
  if (value <= 0) return "gray";
  const frac = value / max;
  if (frac < 0.34) return "green";
  if (frac < 0.67) return "yellow";
  return "red";
}

// Battery SOC is already a 0-100% absolute scale, so its bands are fixed
// thresholds rather than fractions of the series' own peak — the same
// good/moderate/low bands the badge above it already uses.
function socTone(value: number): SparkTone {
  if (value < 20) return "red";
  if (value < 50) return "yellow";
  return "green";
}

/** Overview's live-status row — Solar Generated / Consumption / Battery /
 *  Grid Interaction, each with a headline live value, a derived status
 *  badge, and a recent-trend sparkline. Sits above the energy-flow diagram
 *  as a quick-glance summary, same role the diagram itself plays but
 *  scannable at a glance without reading wire directions.
 *
 *  Scoped to the site's first solar_inverter device (see
 *  fetchDeviceRecentSeries's own doc comment on why) — renders nothing if
 *  the site has none. */
export async function SolarLiveStatusCards({ supabase, site }: { supabase: SupabaseServerClient; site: CustomerSite }) {
  const inverter = site.devices.find((d) => d.deviceType?.category === "solar_inverter");
  if (!inverter) return null;

  const [solarSeries, loadSeries, socSeries, gridSeries, batteryPowerSeries] = await Promise.all([
    fetchDeviceRecentSeries(supabase, inverter.id, "inverter_power_w", SPARK_POINTS),
    fetchDeviceRecentSeries(supabase, inverter.id, "load_power_w", SPARK_POINTS),
    fetchDeviceRecentSeries(supabase, inverter.id, "battery_soc_pct", SPARK_POINTS),
    fetchDeviceRecentSeries(supabase, inverter.id, "grid_power_w", SPARK_POINTS),
    fetchDeviceRecentSeries(supabase, inverter.id, "battery_power_w", SPARK_POINTS),
  ]);

  const solarW = latestValue(solarSeries);
  const loadW = latestValue(loadSeries);
  const socPct = latestValue(socSeries);
  const gridW = latestValue(gridSeries);
  const batteryW = latestValue(batteryPowerSeries);

  // Consumption's badge: which of the site's own sources is actually
  // covering the load right now, not just "grid vs. not-grid" — grid
  // import wins outright (it's the one costing money), otherwise whichever
  // of solar/battery is contributing more at this instant wins. Floors
  // solarW at 0: a negative reading here is a known mock-data sign-flip
  // bug (real PV output can't go negative), not a legitimate state that
  // should count as "solar contributing nothing more than zero".
  const gridAssisted = gridW !== null && gridW > 0;
  const solarContribution = Math.max(0, solarW ?? 0);
  const batteryDischarge = batteryW !== null && batteryW < 0 ? Math.abs(batteryW) : 0;
  type ConsumptionSource = "grid" | "battery" | "solar" | "idle";
  const consumptionSource: ConsumptionSource = gridAssisted
    ? "grid"
    : loadW === null || loadW <= 0
      ? "idle"
      : batteryDischarge > solarContribution
        ? "battery"
        : solarContribution > 0
          ? "solar"
          : "idle";
  const CONSUMPTION_BADGE: Record<ConsumptionSource, string> = {
    grid: "Grid-Assisted",
    battery: "Battery-Powered",
    solar: "Solar-Powered",
    idle: "Idle",
  };
  const CONSUMPTION_TONE: Record<ConsumptionSource, StatusTone> = {
    grid: "warn",
    battery: "good",
    solar: "good",
    idle: "neutral",
  };

  // Battery: charging (positive) vs discharging (negative) vs idle, and a
  // coarse SOC banding for the badge — good/moderate/low.
  const batteryDirection = batteryW === null || batteryW === 0 ? "Idle" : batteryW > 0 ? "Charging" : "Discharging";
  const batteryTone: StatusTone = socPct === null ? "neutral" : socPct >= 60 ? "good" : socPct >= 20 ? "neutral" : "warn";
  const batteryBadge = socPct === null ? "—" : socPct >= 60 ? "Good" : socPct >= 20 ? "Moderate" : "Low";

  // Grid: importing (positive) costs money, exporting (negative) earns
  // credit — each sparkline bar is colored by its own point's sign (and,
  // for imports, how heavy it was relative to this series' own peak import),
  // not just the current reading, so a recent import spike shows up even if
  // the site has since started exporting again.
  const gridDirection = gridW === null || gridW === 0 ? "Idle" : gridW > 0 ? "Importing" : "Exporting";
  const gridTone: StatusTone = gridW === null || gridW === 0 ? "neutral" : gridW > 0 ? "warn" : "good";
  const gridPoints = gridSeries.filter((p): p is { value: number; ts: string } => p.value !== null);
  const gridMaxAbs = Math.max(1, ...gridPoints.map((p) => Math.abs(p.value)));
  const gridSparkline: SparkPoint[] = gridPoints.map((p) => ({
    value: p.value,
    tone: p.value === 0 ? "gray" : p.value > 0 ? (p.value / gridMaxAbs >= 0.5 ? "red" : "yellow") : "green",
    ts: p.ts,
    display: toKw(Math.abs(p.value)),
    directionLabel: p.value > 0 ? "Importing" : p.value < 0 ? "Exporting" : "Idle",
  }));

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <LiveStatusCard
        icon={Sun}
        iconTone={solarW !== null && solarW > 0 ? "good" : "neutral"}
        title="Solar Generated"
        subtitle="Live Production"
        value={toKw(solarW)}
        liveValue={solarW}
        statusLabel="Status"
        badgeLabel={solarW !== null && solarW > 0 ? "Producing" : "Idle"}
        badgeTone={solarW !== null && solarW > 0 ? "good" : "neutral"}
        sparkline={toSparkline(solarSeries, outputTone, (v) => toKw(v))}
        href={`/dashboard/monitoring?device=${inverter.id}#solar`}
      />

      <LiveStatusCard
        icon={Home}
        iconTone={CONSUMPTION_TONE[consumptionSource]}
        title="Consumption"
        subtitle="Live Usage"
        value={toKw(loadW)}
        liveValue={loadW}
        statusLabel="Source"
        badgeLabel={CONSUMPTION_BADGE[consumptionSource]}
        badgeTone={CONSUMPTION_TONE[consumptionSource]}
        sparkline={toSparkline(loadSeries, loadTone, (v) => toKw(v))}
        href={`/dashboard/monitoring?device=${inverter.id}#load`}
      />

      <LiveStatusCard
        icon={BatteryCharging}
        iconTone={batteryTone}
        title="Battery"
        subtitle={batteryW !== null && batteryW !== 0 ? `${batteryDirection} · ${toKw(Math.abs(batteryW))}` : batteryDirection}
        value={socPct !== null ? `${Math.round(socPct)}%` : "—"}
        liveValue={socPct}
        statusLabel="Charge Level"
        badgeLabel={batteryBadge}
        badgeTone={batteryTone}
        sparkline={toSparkline(socSeries, (v) => socTone(v), (v) => `${Math.round(v)}%`)}
        href={`/dashboard/monitoring?device=${inverter.id}#battery`}
      />

      <LiveStatusCard
        icon={Zap}
        iconTone={gridTone}
        title="Grid Interaction"
        subtitle="Live Interaction"
        value={toKw(gridW !== null ? Math.abs(gridW) : null)}
        liveValue={gridW}
        statusLabel="Direction"
        badgeLabel={gridDirection}
        badgeTone={gridTone}
        sparkline={gridSparkline}
        href={`/dashboard/monitoring?device=${inverter.id}#grid`}
      />
    </div>
  );
}
