"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@waytara/supabase/service-role";
import { requireCustomer } from "@waytara/supabase/auth";
import { getCustomerSites } from "@/lib/selected-site";

const ENERGY_KEY = "energy_active_import_register_kwh";

// ev_sessions is read-only via RLS for every role (see its own
// migration's comment) — nothing but a service-role process is meant to
// write it, same invariant as the detection cron and the deye-modbus-agent
// pattern for equipment_configs. A customer clicking "Start/Stop Charging"
// is a new, legitimate writer, but it stays consistent with that
// invariant by writing through the service-role client from here rather
// than loosening RLS — the ownership check below (does this device belong
// to the calling customer?) is what stands in for the RLS policy a normal
// table would have.
async function assertOwnCharger(deviceId: string) {
  await requireCustomer();

  const sites = await getCustomerSites();
  const owns = sites.some((s) => s.devices.some((d) => d.id === deviceId && d.deviceType?.category === "ev_charger"));
  if (!owns) throw new Error("Device not found.");
}

async function latestEnergyReading(deviceId: string): Promise<number | null> {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("equipment_latest")
    .select("value")
    .eq("equipment_id", deviceId)
    .eq("key_name", ENERGY_KEY)
    .maybeSingle();
  return data?.value ?? null;
}

/** Opens a new ev_sessions row for this device — the simulator
 *  listens for this (an `ev_sessions` INSERT with no matching device
 *  reading yet) and starts generating live EV telemetry for it, the same
 *  way real hardware would react to an OCPP RemoteStartTransaction. A
 *  no-op (not an error the UI needs to show) if a session is already open
 *  — the carousel only renders this action when there isn't one, so that
 *  should only happen from a genuine double-click race. */
export async function startChargingSession(deviceId: string) {
  await assertOwnCharger(deviceId);
  const service = createServiceRoleClient();

  const { data: open } = await service
    .from("ev_sessions")
    .select("id")
    .eq("equipment_id", deviceId)
    .is("ended_at", null)
    .maybeSingle();
  if (open) return;

  await service.from("ev_sessions").insert({
    equipment_id: deviceId,
    started_at: new Date().toISOString(),
    start_energy_kwh: await latestEnergyReading(deviceId),
  });

  revalidatePath("/dashboard");
}

/** Closes this device's open session — the simulator listens for the
 *  matching `ended_at` UPDATE and stops generating charging telemetry for
 *  it, reverting the charger to Available. `stop_reason: "Customer"`
 *  distinguishes this from the detection cron's own "Local" close. */
export async function stopChargingSession(deviceId: string) {
  await assertOwnCharger(deviceId);
  const service = createServiceRoleClient();

  const { data: open } = await service
    .from("ev_sessions")
    .select("id")
    .eq("equipment_id", deviceId)
    .is("ended_at", null)
    .maybeSingle();
  if (!open) return;

  await service
    .from("ev_sessions")
    .update({
      ended_at: new Date().toISOString(),
      end_energy_kwh: await latestEnergyReading(deviceId),
      stop_reason: "Customer",
    })
    .eq("id", open.id);

  revalidatePath("/dashboard");
}
