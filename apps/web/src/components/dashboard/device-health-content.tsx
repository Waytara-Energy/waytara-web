import { createClient } from "@waytara/supabase/server";
import type { CustomerDevice } from "@/lib/selected-site";
import { getLastSyncInfo } from "@/lib/device-sync";
import { deriveFaultEvents } from "@/lib/deye-fault-codes";
import { getConnectorStatusLabel, getErrorCodeLabel } from "@/lib/ev-charger-catalog";
import { TEMPERATURE_FIELDS } from "@/lib/telemetry-catalog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import { FaultBanner } from "./fault-banner";
import { FaultHistory } from "./fault-history";
import { LastSyncIndicator } from "./last-sync-indicator";
import { SdStatusIndicator } from "./sd-status-indicator";
import { TemperatureGauge } from "./temperature-gauge";
import { StatusPill } from "./status-pill";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const FAULT_HISTORY_DAYS = 90;

/** Maintenance's "Device Health" section, category-aware — mirrors the
 *  other module dispatchers (Phases 1-4). Ticket list and service-contract
 *  status (the rest of Maintenance) are already device-agnostic — this is
 *  the one part of the page that was inverter-specific: fault status,
 *  temperature trends, and the fault-code lookup only mean anything for a
 *  solar_inverter's registers. A category without a curated health view
 *  yet just gets the connection sync indicator, which is genuinely
 *  device-agnostic (last reading received, regardless of category). */
export async function DeviceHealthContent({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const category = device.deviceType?.category;

  if (category === "solar_inverter") {
    return <SolarInverterHealth supabase={supabase} device={device} />;
  }
  if (category === "ev_charger") {
    return <EvChargerHealth supabase={supabase} device={device} />;
  }

  const lastSync = await getLastSyncInfo(device.id);
  return <LastSyncIndicator sync={lastSync} />;
}

async function SolarInverterHealth({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const tempKeys = TEMPERATURE_FIELDS.map((f) => f.key);

  // A day ago (±2h window), for the temperature trend arrows.
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const windowStart = new Date(dayAgo.getTime() - 2 * 3600 * 1000).toISOString();
  const windowEnd = new Date(dayAgo.getTime() + 2 * 3600 * 1000).toISOString();

  const faultSince = new Date();
  faultSince.setUTCDate(faultSince.getUTCDate() - FAULT_HISTORY_DAYS);

  const [{ data: latestRows }, { data: faultRows }, { data: pastRows }, lastSync] = await Promise.all([
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", ["active_fault_code", "sd_status", ...tempKeys])
      .order("ts", { ascending: false })
      .limit((tempKeys.length + 2) * 5),
    // Fault *history*, not just the current state — every active_fault_code
    // reading in the window, collapsed into discrete episodes
    // (deriveFaultEvents) rather than shown as raw per-reading noise.
    // Ascending order: the collapse walk needs to see faults in the order
    // they actually happened.
    supabase
      .from("device_readings")
      .select("value, ts")
      .eq("device_id", device.id)
      .eq("instrument_key", "active_fault_code")
      .gte("ts", faultSince.toISOString())
      .order("ts", { ascending: true })
      .limit(2000),
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", tempKeys)
      .gte("ts", windowStart)
      .lte("ts", windowEnd)
      .order("ts", { ascending: true })
      .limit(50),
    getLastSyncInfo(device.id),
  ]);

  let activeFaultCode: number | null = null;
  let sdStatus: number | null = null;
  const currentTemps = new Map<string, number | null>();
  for (const r of latestRows ?? []) {
    if (r.instrument_key === "active_fault_code" && activeFaultCode === null) activeFaultCode = r.value;
    else if (r.instrument_key === "sd_status" && sdStatus === null) sdStatus = r.value;
    else if (tempKeys.includes(r.instrument_key) && !currentTemps.has(r.instrument_key)) {
      currentTemps.set(r.instrument_key, r.value);
    }
  }
  const previousTemps = new Map<string, number | null>();
  for (const r of pastRows ?? []) {
    if (!previousTemps.has(r.instrument_key)) previousTemps.set(r.instrument_key, r.value);
  }
  const faultEvents = deriveFaultEvents(faultRows ?? []);

  return (
    <>
      <FaultBanner faultCode={activeFaultCode} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fault History (last {FAULT_HISTORY_DAYS}d)</CardTitle>
        </CardHeader>
        <CardContent>
          <FaultHistory events={faultEvents} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LastSyncIndicator sync={lastSync} />
        <SdStatusIndicator value={sdStatus} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Temperature Trends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {TEMPERATURE_FIELDS.map((field) => (
            <TemperatureGauge
              key={field.key}
              label={field.label}
              valueC={currentTemps.get(field.key) ?? null}
              warnAboveC={field.warnAboveC}
              previousValueC={previousTemps.get(field.key) ?? null}
            />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

async function EvChargerHealth({ supabase, device }: { supabase: SupabaseServerClient; device: CustomerDevice }) {
  const [{ data: latestRows }, lastSync] = await Promise.all([
    supabase
      .from("device_readings")
      .select("instrument_key, value, ts")
      .eq("device_id", device.id)
      .in("instrument_key", ["connector_status", "error_code", "temperature_c"])
      .order("ts", { ascending: false })
      .limit(15),
    getLastSyncInfo(device.id),
  ]);

  const latest = new Map<string, number | null>();
  for (const r of latestRows ?? []) {
    if (!latest.has(r.instrument_key)) latest.set(r.instrument_key, r.value);
  }
  const status = getConnectorStatusLabel(latest.get("connector_status") ?? null);
  const errorLabel = getErrorCodeLabel(latest.get("error_code") ?? null);
  const temperature = latest.get("temperature_c") ?? null;

  return (
    <>
      <div className="flex justify-end">
        <StatusPill label={status.label} tone={status.tone} />
      </div>

      {errorLabel ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Charger fault</AlertTitle>
          <AlertDescription>{errorLabel}</AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>No active faults</AlertTitle>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LastSyncIndicator sync={lastSync} />
        <div className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-sm text-theme-muted">
          Connector temperature: <span className="font-medium text-theme-primary">{temperature !== null ? `${temperature.toFixed(1)} °C` : "—"}</span>
        </div>
      </div>
    </>
  );
}
