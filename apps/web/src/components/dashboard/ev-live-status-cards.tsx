import { Zap, Gauge, BatteryCharging, Thermometer } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import type { CustomerSite } from "@/lib/selected-site";
import { fetchDeviceRecentSeries, fetchTodayEvEnergyKwh, fetchTodayEvSessionSparkline, type LiveSeriesPoint } from "@/lib/device-overview";
import { getCustomerPlan } from "@/lib/customer-plan";
import { EV_CONNECTOR_TEMP_WARN_C } from "@/lib/ev-charger-catalog";
import { LiveStatusCard, type SparkPoint, type SparkTone } from "./live-status-card";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SPARK_POINTS = 60;
const TEMP_WARN_C = EV_CONNECTOR_TEMP_WARN_C;
// A second, higher band above TEMP_WARN_C for the sparkline's red vs
// yellow split — "still just a caution" vs "actually running hot".
const TEMP_HOT_C = 55;

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

// Charging power / current draw: 0 is idle (gray), a low fraction of this
// series' own recent peak is yellow (trickling, not really charging), and
// a healthy fraction is green — there's no "bad" reading for a magnitude
// like this, just idle vs weak vs strong.
function drawTone(value: number, max: number): SparkTone {
  if (value <= 0) return "gray";
  return value / max < 0.34 ? "yellow" : "green";
}

// Connector temperature is an absolute scale, not relative to its own
// series peak — green below the warn threshold, yellow up to the hot
// threshold, red past it.
function tempTone(value: number): SparkTone {
  if (value < TEMP_WARN_C) return "green";
  if (value < TEMP_HOT_C) return "yellow";
  return "red";
}

/** The EV charger's own live-status row — same card design as
 *  SolarLiveStatusCards, placed right below it on Overview. Four cards,
 *  each pairing a live headline with a secondary reading in its subtitle
 *  (the same "state · value" pattern Solar's own Battery card uses for
 *  "Charging · 1.22 kW") rather than giving every individual reading its
 *  own tile — Power Offered rides along with Charging Power, Voltage
 *  rides along with Current, and Cost Today rides along with Energy
 *  Delivered Today (derived from it via the tariff rate, so it's the same
 *  underlying number either way, not two things that need separate
 *  tiles). Energy Delivered Today's sparkline is bucketed into the same
 *  SPARK_POINTS time-slices as every other card (see
 *  fetchTodayEvSessionSparkline) rather than a variable-length staircase,
 *  so the whole row reads as one consistent bar style.
 *
 *  Scoped to the site's first ev_charger device — same "one representative
 *  reading" simplification SolarLiveStatusCards already uses for its
 *  inverter. */
export async function EvLiveStatusCards({ supabase, site }: { supabase: SupabaseServerClient; site: CustomerSite }) {
  const charger = site.devices.find((d) => d.deviceType?.category === "ev_charger");
  if (!charger) return null;

  const [powerSeries, offeredSeries, currentSeries, voltageSeries, tempSeries, customerPlan, todayEnergyKwh, sessionSparkline] =
    await Promise.all([
      fetchDeviceRecentSeries(supabase, charger.id, "power_active_import_w", SPARK_POINTS),
      fetchDeviceRecentSeries(supabase, charger.id, "power_offered_w", 1),
      fetchDeviceRecentSeries(supabase, charger.id, "current_import_a", SPARK_POINTS),
      fetchDeviceRecentSeries(supabase, charger.id, "voltage_v", 1),
      fetchDeviceRecentSeries(supabase, charger.id, "temperature_c", SPARK_POINTS),
      getCustomerPlan(),
      fetchTodayEvEnergyKwh(supabase, [charger.id]),
      fetchTodayEvSessionSparkline(supabase, charger.id, SPARK_POINTS),
    ]);

  const powerW = latestValue(powerSeries);
  const offeredW = latestValue(offeredSeries);
  const currentA = latestValue(currentSeries);
  const voltageV = latestValue(voltageSeries);
  const tempC = latestValue(tempSeries);
  const tariffRate = customerPlan?.tariffRatePerKwh ?? 8;
  const tempWarm = tempC !== null && tempC >= TEMP_WARN_C;

  const charging = powerW !== null && powerW > 0;
  const drawing = currentA !== null && currentA > 0;
  const hasEnergyToday = todayEnergyKwh !== null && todayEnergyKwh > 0;
  const costToday = todayEnergyKwh !== null ? todayEnergyKwh * tariffRate : null;
  // Each bucket is either "delivered something in this slice" (green) or
  // "nothing landed here" (gray) — a bucket's own kWh amount doesn't carry
  // a good/bad distinction the way a live draw does.
  const energySparkline: SparkPoint[] = sessionSparkline.map((p) => ({
    value: p.value,
    tone: p.value > 0 ? "green" : "gray",
    ts: p.ts,
    display: `${p.value.toFixed(2)} kWh`,
  }));

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <LiveStatusCard
        icon={Zap}
        iconTone={charging ? "good" : "neutral"}
        title="Charging Power"
        subtitle={offeredW !== null ? `Power Offered · ${(offeredW / 1000).toFixed(1)} kW` : "Live Charging"}
        value={powerW !== null ? `${(powerW / 1000).toFixed(2)} kW` : "—"}
        liveValue={powerW}
        statusLabel="Status"
        badgeLabel={charging ? "Charging" : "Idle"}
        badgeTone={charging ? "good" : "neutral"}
        sparkline={toSparkline(powerSeries, drawTone, (v) => `${(v / 1000).toFixed(2)} kW`)}
        href={`/dashboard/monitoring?device=${charger.id}#hub`}
      />

      <LiveStatusCard
        icon={Gauge}
        iconTone={drawing ? "good" : "neutral"}
        title="Current"
        subtitle={voltageV !== null ? `Voltage · ${Math.round(voltageV)} V` : "Live Draw"}
        value={currentA !== null ? `${currentA.toFixed(1)} A` : "—"}
        liveValue={currentA}
        statusLabel="Draw"
        badgeLabel={drawing ? "Drawing" : "Idle"}
        badgeTone={drawing ? "good" : "neutral"}
        sparkline={toSparkline(currentSeries, drawTone, (v) => `${v.toFixed(1)} A`)}
        href={`/dashboard/monitoring?device=${charger.id}#hub`}
      />

      <LiveStatusCard
        icon={Thermometer}
        iconTone={tempC === null ? "neutral" : tempWarm ? "warn" : "good"}
        title="Connector Temperature"
        subtitle="Live Reading"
        value={tempC !== null ? `${tempC.toFixed(1)} °C` : "—"}
        liveValue={tempC}
        statusLabel="Status"
        badgeLabel={tempC === null ? "—" : tempWarm ? "Warm" : "Normal"}
        badgeTone={tempC === null ? "neutral" : tempWarm ? "warn" : "good"}
        sparkline={toSparkline(tempSeries, (v) => tempTone(v), (v) => `${v.toFixed(1)} °C`)}
        href={`/dashboard/monitoring?device=${charger.id}#hub`}
      />

      <LiveStatusCard
        icon={BatteryCharging}
        iconTone={hasEnergyToday ? "good" : "neutral"}
        title="Energy Delivered Today"
        subtitle={costToday !== null ? `Cost · ₹${costToday.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "Since midnight"}
        value={todayEnergyKwh !== null ? `${todayEnergyKwh.toFixed(1)} kWh` : "—"}
        liveValue={todayEnergyKwh}
        statusLabel="Status"
        badgeLabel={hasEnergyToday ? "Charged" : "None yet"}
        badgeTone={hasEnergyToday ? "good" : "neutral"}
        sparkline={energySparkline}
        href={`/dashboard/monitoring?device=${charger.id}#hub`}
      />
    </div>
  );
}
