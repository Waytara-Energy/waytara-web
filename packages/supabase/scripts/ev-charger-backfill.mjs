#!/usr/bin/env node
// One-shot sample-data generator for the Plugzmart EV charger — the
// counterpart to deye-modbus-agent.mjs's --backfill-days for the solar
// inverter. Unlike the inverter, this device had zero device_readings at
// all: the dashboard's Start/Stop Charging button only ever writes
// charging_sessions rows (see the external simulator's README), so
// nothing generates the session's actual telemetry unless a listener is
// running. This backfills both — realistic charging_sessions rows *and*
// their device_readings ticks — for the trailing week, using the exact
// key vocabulary and connector_status/error_code semantics already
// verified against production this session.
//
// Idempotent-ish, not fully resumable like the Python tool: it checks for
// an existing device_readings row before inserting (per key), and reuses
// (rather than duplicates) any charging_sessions row already covering a
// given day. Meant to be run once; safe to re-run without doubling data.
//
// Usage: node scripts/ev-charger-backfill.mjs [--device-id=<uuid>] [--days=7]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/web/.env.local");
  const text = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return env;
}

function parseArgs(argv) {
  const args = { deviceId: "12b39f5d-49a5-4bf0-9d35-a188978567bd", days: 7 };
  for (const arg of argv) {
    if (arg.startsWith("--device-id=")) args.deviceId = arg.slice("--device-id=".length);
    else if (arg.startsWith("--days=")) args.days = Number(arg.slice("--days=".length));
  }
  return args;
}

const env = loadEnv();
const args = parseArgs(process.argv.slice(2));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: "waytara" } });

function round(v, d = 0) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
function jitter(v, pct) {
  return v * (1 + (Math.random() * 2 - 1) * pct);
}

const TICK_MS = 3 * 60 * 1000; // 3 min — dense enough for the trend charts, not excessive row volume
const RAMP_MS = 2 * 60 * 1000; // time to reach full power from plug-in

/** One session's own ticks: a brief Preparing handshake, ramp-to-rated
 *  Charging with jitter, an optional HighTemperature fault right before
 *  an early stop, then one final tick reverting to Available — same
 *  lifecycle the real live listener implements (see the Python
 *  simulator's README), just computed for a past window instead of live. */
function buildSessionTicks(session, ratedPowerW) {
  const rows = [];
  const durationMs = session.endedAt.getTime() - session.startedAt.getTime();
  const totalEnergyKwh = session.endEnergyKwh - session.startEnergyKwh;
  const numTicks = Math.max(2, Math.round(durationMs / TICK_MS));

  rows.push({
    ts: session.startedAt,
    connector_status: 1, // Preparing
    power_active_import_w: 0,
    power_offered_w: ratedPowerW,
    current_import_a: 0,
    voltage_v: round(jitter(230, 0.01), 1),
    temperature_c: round(jitter(24, 0.05), 1),
    energy_active_import_register_kwh: round(session.startEnergyKwh, 3),
    error_code: 0,
  });

  for (let i = 1; i <= numTicks; i++) {
    const elapsedMs = (durationMs * i) / numTicks;
    const ts = new Date(session.startedAt.getTime() + elapsedMs);
    const isFaultTick = session.faultCode && i === numTicks;
    const rampFrac = Math.min(1, elapsedMs / RAMP_MS);
    const energyFrac = i / numTicks;
    const energy = session.startEnergyKwh + totalEnergyKwh * energyFrac;

    if (isFaultTick) {
      rows.push({
        ts,
        connector_status: 4, // Faulted
        power_active_import_w: 0,
        power_offered_w: ratedPowerW,
        current_import_a: 0,
        voltage_v: round(jitter(230, 0.01), 1),
        temperature_c: round(jitter(58, 0.05), 1), // elevated reading that triggered the trip
        energy_active_import_register_kwh: round(energy, 3),
        error_code: session.faultCode,
      });
      continue;
    }

    const powerW = ratedPowerW * rampFrac * jitter(1, 0.03);
    rows.push({
      ts,
      connector_status: 2, // Charging
      power_active_import_w: round(powerW),
      power_offered_w: ratedPowerW,
      current_import_a: round(powerW / 230, 2),
      voltage_v: round(jitter(230, 0.01), 1),
      temperature_c: round(24 + 10 * rampFrac + Math.random() * 2, 1),
      energy_active_import_register_kwh: round(energy, 3),
      error_code: 0,
    });
  }

  rows.push({
    ts: new Date(session.endedAt.getTime() + 1000),
    connector_status: 0, // Available
    power_active_import_w: 0,
    power_offered_w: ratedPowerW,
    current_import_a: 0,
    voltage_v: round(jitter(230, 0.01), 1),
    temperature_c: round(jitter(24, 0.05), 1),
    energy_active_import_register_kwh: round(session.endEnergyKwh, 3),
    error_code: 0,
  });

  return rows;
}

function idleTick(ts, energyKwh, ratedPowerW) {
  return {
    ts,
    connector_status: 0,
    power_active_import_w: 0,
    power_offered_w: ratedPowerW,
    current_import_a: 0,
    voltage_v: round(jitter(230, 0.01), 1),
    temperature_c: round(jitter(24, 0.05), 1),
    energy_active_import_register_kwh: round(energyKwh, 3),
    error_code: 0,
  };
}

function toReadingRows(deviceId, tick) {
  const { ts, ...values } = tick;
  return Object.entries(values).map(([instrument_key, value]) => ({
    device_id: deviceId,
    instrument_key,
    value,
    ts: ts.toISOString(),
    is_test: false,
  }));
}

async function insertChunked(rows, chunkSize = 1000) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("device_readings").insert(chunk);
    if (error) throw new Error(`device_readings insert (rows ${i}-${i + chunk.length}) failed: ${error.message}`);
  }
}

async function main() {
  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id, label, device_type:stock(power_capacity_value, power_capacity_unit)")
    .eq("id", args.deviceId)
    .maybeSingle();
  if (deviceError || !device) throw new Error(`Device ${args.deviceId} not found: ${deviceError?.message ?? "no row"}`);

  const ratedPowerW =
    device.device_type?.power_capacity_unit?.toLowerCase().includes("kw")
      ? device.device_type.power_capacity_value * 1000
      : (device.device_type?.power_capacity_value ?? 7400);
  console.log(`Device: ${device.label} — rated ${ratedPowerW}W`);

  const { data: existingSessions } = await supabase
    .from("charging_sessions")
    .select("id, started_at, ended_at, start_energy_kwh, end_energy_kwh, stop_reason")
    .eq("device_id", args.deviceId)
    .order("started_at", { ascending: true });
  console.log(`Existing charging_sessions: ${existingSessions?.length ?? 0}`);

  const { count: existingReadingCount } = await supabase
    .from("device_readings")
    .select("*", { count: "exact", head: true })
    .eq("device_id", args.deviceId);
  if (existingReadingCount > 0) {
    console.log(`device_readings already has ${existingReadingCount} rows for this device — skipping tick generation for pre-existing sessions, only backfilling new days.`);
  }

  const allTicks = [];

  // Backfill ticks for pre-existing sessions too (only if device_readings
  // is currently empty — if it already has data, assume this has been
  // done and don't duplicate).
  if (!existingReadingCount) {
    for (const s of existingSessions ?? []) {
      if (!s.ended_at || s.start_energy_kwh === null || s.end_energy_kwh === null) continue;
      allTicks.push(
        buildSessionTicks(
          { startedAt: new Date(s.started_at), endedAt: new Date(s.ended_at), startEnergyKwh: s.start_energy_kwh, endEnergyKwh: s.end_energy_kwh, faultCode: null },
          ratedPowerW
        )
      );
    }
  }

  // Generate new sessions for each of the trailing `days` days, skipping
  // any day that already has a session (so re-running this script is
  // reasonably safe). Built as timing-only "slots" first, energy assigned
  // afterward — real sessions can fall anywhere in the range, and the
  // lifetime energy register must still end up strictly increasing
  // through time regardless of which days are already taken.
  const existingDays = new Set((existingSessions ?? []).map((s) => s.started_at.slice(0, 10)));
  const now = new Date();
  const slots = []; // chronological, oldest first

  for (let d = args.days - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - d);
    const dayKey = day.toISOString().slice(0, 10);
    if (existingDays.has(dayKey)) continue;

    const isToday = d === 0;
    const sessionsToday = isToday ? 1 : Math.random() < 0.15 ? 1 : 2; // most days get 2, today just 1 so far
    const startHours = [8.5, 18.5]; // morning departure charge, evening return charge — plausible commute pattern

    for (let s = 0; s < sessionsToday; s++) {
      const startHour = startHours[s] + (Math.random() * 0.6 - 0.3);
      const startedAt = new Date(day.getTime() + startHour * 3600 * 1000);
      if (isToday && startedAt >= now) continue; // never schedule a "future" session today

      const durationHours = 0.6 + Math.random() * 1.8; // 35min-2h40, plausible top-up range
      let endedAt = new Date(startedAt.getTime() + durationHours * 3600 * 1000);
      if (endedAt >= now) endedAt = new Date(now.getTime() - 5 * 60 * 1000); // never end in the future

      const hadFault = Math.random() < 0.07; // ~7%, matching the real simulator's own rate
      const targetEnergyKwh = 4 + Math.random() * 14; // one commute top-up, not a full pack
      const deltaKwh = round(hadFault ? targetEnergyKwh * (0.3 + Math.random() * 0.3) : targetEnergyKwh, 3); // fault cuts it short
      const faultCode = hadFault ? (Math.random() < 0.5 ? 4 : 8) : null; // 4=HighTemperature, 8=OverCurrentFailure
      const stopReason = hadFault ? "Other" : ["EVDisconnected", "EVDisconnected", "EVDisconnected", "Local"][Math.floor(Math.random() * 4)];

      slots.push({ startedAt, endedAt, deltaKwh, faultCode, stopReason });
    }
  }

  // Anchor points from the real sessions already in the DB (if any): the
  // earliest known value and the latest known value. Slots chronologically
  // before the earliest real session must end at or below it (energy
  // assigned working backward from that boundary); slots after the latest
  // must start at or above it (assigned working forward) — a slot can
  // never straddle a day that's already accounted for since existingDays
  // already excluded those.
  const realStarts = (existingSessions ?? []).filter((s) => s.start_energy_kwh !== null).map((s) => new Date(s.started_at).getTime());
  const realEnds = (existingSessions ?? []).filter((s) => s.end_energy_kwh !== null).map((s) => new Date(s.ended_at).getTime());
  const earliestRealTime = realStarts.length ? Math.min(...realStarts) : null;
  const latestRealTime = realEnds.length ? Math.max(...realEnds) : null;
  const anchorBefore = (existingSessions ?? []).find((s) => new Date(s.started_at).getTime() === earliestRealTime)?.start_energy_kwh ?? 20;
  const anchorAfter = (existingSessions ?? []).reduce((max, s) => (s.end_energy_kwh !== null ? Math.max(max, s.end_energy_kwh) : max), 0) || 20;

  const beforeSlots = existingSessions?.length ? slots.filter((s) => s.startedAt.getTime() < earliestRealTime) : [];
  const afterSlots = existingSessions?.length ? slots.filter((s) => s.startedAt.getTime() > latestRealTime) : slots;

  const newSessions = [];

  // "After" (and the no-existing-sessions case): forward in time, energy
  // increasing from the anchor.
  let forwardCounter = existingSessions?.length ? anchorAfter : 20;
  for (const slot of afterSlots) {
    const startEnergyKwh = forwardCounter;
    const endEnergyKwh = round(forwardCounter + slot.deltaKwh, 3);
    forwardCounter = endEnergyKwh;
    newSessions.push({ device_id: args.deviceId, started_at: slot.startedAt.toISOString(), ended_at: slot.endedAt.toISOString(), start_energy_kwh: startEnergyKwh, end_energy_kwh: endEnergyKwh, stop_reason: slot.stopReason, is_test: false });
    allTicks.push(buildSessionTicks({ startedAt: slot.startedAt, endedAt: slot.endedAt, startEnergyKwh, endEnergyKwh, faultCode: slot.faultCode }, ratedPowerW));
    if (slot.faultCode) {
      allTicks.push([{ ts: slot.endedAt, _alert: { device_id: args.deviceId, severity: "critical", message: `Charging session stopped early: ${slot.faultCode === 4 ? "connector over-temperature" : "over-current"} fault detected.`, ts: slot.endedAt.toISOString() } }]);
    }
  }

  // "Before": walk backward in time (latest-to-earliest, closest to the
  // real boundary first), energy decreasing from the anchor, so the
  // earliest slot ends up with the lowest value — then insert in
  // chronological order like everything else. The anchor (a real, already
  //-recorded session's own start value) is a fixed, small budget — scale
  // every "before" session's requested delta down proportionally if their
  // sum would exceed it, rather than letting the register go negative.
  const FLOOR_MARGIN_KWH = 2; // leaves a small nonzero value for whatever came "before" recorded history
  const requestedBeforeTotal = beforeSlots.reduce((sum, s) => sum + s.deltaKwh, 0);
  const availableBeforeBudget = Math.max(0, anchorBefore - FLOOR_MARGIN_KWH);
  const beforeScale = requestedBeforeTotal > availableBeforeBudget && requestedBeforeTotal > 0 ? availableBeforeBudget / requestedBeforeTotal : 1;
  if (beforeScale < 1) {
    console.log(`Scaling "before" session energy by ${(beforeScale * 100).toFixed(0)}% to fit the real anchor's ${anchorBefore} kWh budget (requested ${requestedBeforeTotal.toFixed(1)} kWh across ${beforeSlots.length} sessions).`);
  }

  let backwardCounter = anchorBefore;
  for (const slot of [...beforeSlots].reverse()) {
    const scaledDeltaKwh = round(slot.deltaKwh * beforeScale, 3);
    const endEnergyKwh = backwardCounter;
    const startEnergyKwh = round(backwardCounter - scaledDeltaKwh, 3);
    backwardCounter = startEnergyKwh;
    // A fault cuts a session short physically (less energy actually
    // delivered) — scaling down the overall budget isn't the same thing,
    // so only apply the fault's own truncation on top once, not double it.
    const faultCode = scaledDeltaKwh > 0.05 ? slot.faultCode : null;
    newSessions.push({ device_id: args.deviceId, started_at: slot.startedAt.toISOString(), ended_at: slot.endedAt.toISOString(), start_energy_kwh: startEnergyKwh, end_energy_kwh: endEnergyKwh, stop_reason: slot.stopReason, is_test: false });
    allTicks.push(buildSessionTicks({ startedAt: slot.startedAt, endedAt: slot.endedAt, startEnergyKwh, endEnergyKwh, faultCode }, ratedPowerW));
    if (faultCode) {
      allTicks.push([{ ts: slot.endedAt, _alert: { device_id: args.deviceId, severity: "critical", message: `Charging session stopped early: ${faultCode === 4 ? "connector over-temperature" : "over-current"} fault detected.`, ts: slot.endedAt.toISOString() } }]);
    }
  }

  // Idle ticks filling the gaps between sessions (and before/after all of
  // them), every 2h, so the trend charts and "latest reading" don't have
  // multi-day blank stretches or a stale energy value.
  const allSessionWindows = [...(existingSessions ?? []).map((s) => ({ start: new Date(s.started_at), end: s.ended_at ? new Date(s.ended_at) : now })), ...newSessions.map((s) => ({ start: new Date(s.started_at), end: new Date(s.ended_at) }))].sort(
    (a, b) => a.start - b.start
  );

  const rangeStart = new Date(now);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - args.days);
  let cursor = new Date(rangeStart);
  const IDLE_STEP_MS = 2 * 60 * 60 * 1000;

  // Baseline for any idle tick before the very first session in the whole
  // range — the earliest session's own start value (not a disconnected
  // hardcoded number), so a gap before backfilled history began still
  // holds a value consistent with what comes right after it.
  const allSessionsChrono = [...(existingSessions ?? []), ...newSessions].filter((s) => s.start_energy_kwh !== null).sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  const earliestKnownEnergy = allSessionsChrono[0]?.start_energy_kwh ?? 20;

  // Simple approach: walk time in 2h steps; whenever the step isn't inside
  // any session window, emit an idle tick holding whatever the energy
  // counter's value was as of the most recently completed session at that
  // point in time.
  function energyAsOf(ts) {
    let value = earliestKnownEnergy;
    for (const s of [...(existingSessions ?? []), ...newSessions]) {
      const sEnd = s.ended_at ? new Date(s.ended_at) : null;
      if (sEnd && sEnd <= ts && s.end_energy_kwh !== null) value = Math.max(value, s.end_energy_kwh);
    }
    return value;
  }

  while (cursor < now) {
    const inSession = allSessionWindows.some((w) => cursor >= w.start && cursor <= w.end);
    if (!inSession) allTicks.push([idleTick(new Date(cursor), energyAsOf(cursor), ratedPowerW)]);
    cursor = new Date(cursor.getTime() + IDLE_STEP_MS);
  }
  // One final "right now" idle tick so the live status pill is current.
  allTicks.push([idleTick(now, energyAsOf(now), ratedPowerW)]);

  const readingRows = [];
  const alertRows = [];
  for (const entry of allTicks) {
    for (const item of entry) {
      if (item._alert) alertRows.push(item._alert);
      else readingRows.push(...toReadingRows(args.deviceId, item));
    }
  }

  console.log(`Generated ${newSessions.length} new charging_sessions, ${readingRows.length} device_readings rows, ${alertRows.length} alerts.`);

  if (newSessions.length > 0) {
    const { error } = await supabase.from("charging_sessions").insert(newSessions);
    if (error) throw new Error(`charging_sessions insert failed: ${error.message}`);
  }
  if (readingRows.length > 0) await insertChunked(readingRows);
  if (alertRows.length > 0) {
    const { error } = await supabase.from("alerts").insert(alertRows);
    if (error) throw new Error(`alerts insert failed: ${error.message}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
