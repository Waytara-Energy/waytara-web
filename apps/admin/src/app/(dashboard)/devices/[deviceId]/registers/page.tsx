import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { RegistersTable, type MetricRow, type OtherDeviceOption } from "./registers-table";

// The per-device register editor the plan called for — reachable from a
// device's onboarding row ("Edit Registers") and, later, from anywhere
// else a device's own admin detail lives. Every row shown here already
// exists (cloned in from equipment_templates when the device was
// registered, per the variant picked then — see equipment-templates.ts);
// this page only ever edits address/decode/limits/enum/flags on rows that
// are already there, never creates or deletes one, since equipment_metrics
// rows are only ever spawned from a template clone.
export default async function DeviceRegistersPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const supabase = await createClient();

  const { data: device } = await supabase
    .from("equipment")
    .select("id, label, device_type:equipment_inventory(name, category, serial_number, model_number)")
    .eq("id", deviceId)
    .maybeSingle();

  if (!device) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Device not found.
      </div>
    );
  }

  const { data: metricRows } = await supabase
    .from("equipment_metrics")
    .select(
      "id, key_name, category, device_category, direction, address, decode, enum_ref, valid_min, valid_max, cadence_seconds, show_for_user, is_verified, notes, equipment_templates!inner(display_name, unit, value_kind)"
    )
    .eq("equipment_id", deviceId)
    .order("category")
    .order("key_name");

  const deviceCategory = metricRows?.[0]?.device_category ?? null;

  // Candidates for "clone register addresses from…" — other devices of
  // the same solar/ev family that already have at least one mapped
  // register, so cloning has something worth copying.
  const { data: otherMetricRows } = deviceCategory
    ? await supabase
        .from("equipment_metrics")
        .select("equipment_id, equipment:equipment_id(label, device_type:equipment_inventory(name))")
        .eq("device_category", deviceCategory)
        .neq("equipment_id", deviceId)
        .not("address", "is", null)
    : { data: [] };

  const otherDevicesMap = new Map<string, OtherDeviceOption>();
  for (const r of otherMetricRows ?? []) {
    if (!otherDevicesMap.has(r.equipment_id)) {
      otherDevicesMap.set(r.equipment_id, {
        id: r.equipment_id,
        label: r.equipment?.label ?? r.equipment?.device_type?.name ?? "Device",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/devices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Stock Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit Registers — {device.label || device.device_type?.name || "Device"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {device.device_type?.name}
          {device.device_type?.serial_number ? ` · Serial ${device.device_type.serial_number}` : ""}
          {device.device_type?.model_number ? ` · ${device.device_type.model_number}` : ""} — this device&apos;s own
          register map, independent of every other unit of the same model.
        </p>
      </div>

      <RegistersTable
        equipmentId={deviceId}
        metrics={(metricRows ?? []) as MetricRow[]}
        otherDevices={Array.from(otherDevicesMap.values())}
      />
    </div>
  );
}
