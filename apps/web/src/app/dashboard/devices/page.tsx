import { Cpu, Settings2 } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getLastSyncInfo } from "@/lib/device-sync";
import { getRequestProfile } from "@/lib/request-profile";
import { isStaffRole } from "@/lib/ev-settings";
import { fetchEvConnection } from "@/lib/ev-settings-data";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { POWER_PACKAGE_LABELS, powerPackageIncludes } from "@/lib/site-catalog";
import { getSettingFields, getSettingFieldsByCategory } from "@/lib/instrument-settings-catalog";
import { fetchDeviceSettingFields, categoryLabel } from "@/lib/instrument-catalog-data";
import { installedParts, settingsForInstalled } from "@/lib/setting-values";
import { fetchFieldValues } from "@/lib/template-fields";
import { enumToObject } from "@/lib/field-values";
import { ABOUT_READING_KEYS, aboutPages, type ChildView } from "@/lib/device-about";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { DeviceAbout } from "@/components/dashboard/device-about";
import { DeviceActivity } from "@/components/dashboard/device-activity";
import { DeviceCard } from "@/components/dashboard/device-card";
import { DevicesBoard } from "@/components/dashboard/devices-board";
import { EvSettingsSection } from "@/components/dashboard/ev-settings-section";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { SettingFieldRow } from "@/components/dashboard/setting-field-row";

// The Devices page, built like Performance and Maintenance: a headline for the open tab, then the tabs - Details (an About card group for
// the device and each part installed under it) and Settings (the inverter's own menu pages as cards; an EV charger keeps its own
// categories). Settings follow the inverter live and show whether it has confirmed each change. They are gated by the plan; the details
// are not. The site (map, address) has its own page, Site, in the menu.
export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ device?: string }> }) {
  const supabase = await createClient();
  const [site, { device: deviceIdParam }, customerPlan] = await Promise.all([getSelectedSite(), searchParams, getCustomerPlan()]);
  const device = await resolveDeviceInSite(site, deviceIdParam);

  if (!site || !device) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Cpu />
          </EmptyMedia>
          <EmptyTitle>No devices yet</EmptyTitle>
          <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const category = device.deviceType?.category ?? "";
  const canEditSettings = customerPlan?.features?.instrument_settings ?? false;
  // Both categories instrument_catalog covers get the real, database-driven settings; anything else (battery_storage) keeps the small
  // hard-coded list.
  const isCatalogDriven = category === "solar_inverter" || category === "ev_charger";
  const fallbackCategories = Array.from(new Set(getSettingFields(category).map((f) => f.category))).map((key) => ({ key, label: categoryLabel(key) }));

  const [sync, settingsCatalog, fallbackRows, childRows, ownRow, evInfo, profile] = await Promise.all([
    getLastSyncInfo(device.id),
    canEditSettings && isCatalogDriven ? fetchDeviceSettingFields(supabase, device) : Promise.resolve(null),
    canEditSettings && !isCatalogDriven
      ? supabase.from("equipment_configs").select("setting_category, key_name, setting_value, ts").eq("equipment_id", device.id).order("ts", { ascending: true })
      : Promise.resolve(null),
    // The parts installed under this device (solar panels, battery ...) and what each one is.
    supabase
      .from("equipment")
      .select("id, label, quantity, installed_at, warranty_end_date, device_type:equipment_inventory(category, name, manufacturer, brand, model, model_number, serial_number, power_capacity_value, power_capacity_unit, technical_specs)")
      .eq("parent_id", device.id)
      .is("retired_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("equipment").select("device_type:equipment_inventory(technical_specs, power_capacity_value, power_capacity_unit)").eq("id", device.id).maybeSingle(),
    // an EV charger also shows how it is connected (OCPP) and its own settings
    category === "ev_charger" ? fetchEvConnection(supabase, device.id) : Promise.resolve(null),
    category === "ev_charger" ? getRequestProfile() : Promise.resolve(null),
  ]);
  const settingsMap = new Map<string, string>((fallbackRows?.data ?? []).map((row) => [`${row.setting_category}:${row.key_name}`, row.setting_value]));

  const parts: ChildView[] = (childRows.data ?? []).map((e) => ({
    id: e.id,
    label: e.label,
    quantity: e.quantity,
    installedAt: e.installed_at,
    warrantyEndDate: e.warranty_end_date,
    category: e.device_type?.category ?? null,
    name: e.device_type?.name ?? null,
    manufacturer: e.device_type?.manufacturer ?? null,
    brand: e.device_type?.brand ?? null,
    model: e.device_type?.model ?? null,
    modelNumber: e.device_type?.model_number ?? null,
    serialNumber: e.device_type?.serial_number ?? null,
    powerValue: e.device_type?.power_capacity_value ?? null,
    powerUnit: e.device_type?.power_capacity_unit ?? null,
    specs: (e.device_type?.technical_specs as Record<string, unknown> | null) ?? null,
  }));

  // What the device reports about itself (serial number, firmware ...) feeds its About page; the rest of that page is the catalogue record.
  const readings = await fetchFieldValues(supabase, device.id, [...ABOUT_READING_KEYS]);
  const ownType = ownRow.data?.device_type;
  const pages = aboutPages(device, (ownType?.technical_specs as Record<string, unknown> | null) ?? null, { value: ownType?.power_capacity_value ?? null, unit: ownType?.power_capacity_unit ?? null }, readings, parts, new Date(), site.powerPackage ? { label: POWER_PACKAGE_LABELS[site.powerPackage] ?? site.powerPackage, includes: powerPackageIncludes(site.powerPackage) } : null);

  // A solar inverter's settings for equipment that is not installed (a generator, a battery) are not shown.
  const allFields = settingsCatalog ? Array.from(settingsCatalog.fieldsByCategory.values()).flat() : [];
  const settingsFields = category === "solar_inverter" ? settingsForInstalled(allFields, installedParts(parts.map((p) => p.category))) : allFields;

  return (
    <div className="space-y-6">
      {/* The settings screen listens to equipment_configs itself; only the small hard-coded list needs the page re-read. */}
      {canEditSettings && !isCatalogDriven && <RealtimeRefresh table="equipment_configs" event="INSERT" filter={`equipment_id=eq.${device.id}`} />}

      <DevicesBoard
        deviceId={device.id}
        sync={sync}
        fields={settingsFields}
        enumOptions={enumToObject(settingsCatalog?.enumOptionsByRef) ?? {}}
        log={settingsCatalog?.log ?? []}
        mode={category === "solar_inverter" ? "areas" : "categories"}
        hasSettings={canEditSettings}
        devicePages={pages.map((p) => ({ id: p.id, node: <DeviceAbout page={p} /> }))}
        detailsHeadline={{
          label: "Device info",
          value: pages[0].title,
          figures: [
            ...(pages[0].coverShort ? [{ label: "Warranty", value: pages[0].coverShort }] : []),
            { label: "Parts", value: String(pages.length - 1) },
          ],
        }}
        fallbackSettings={
          canEditSettings && !isCatalogDriven ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {fallbackCategories.map((cat) => {
                const fields = getSettingFieldsByCategory(category, cat.key);
                return (
                  <DeviceCard key={cat.key} title={cat.label}>
                    {fields.length === 0 ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Settings2 className="size-4" />
                        {device.deviceType?.name ?? "This device type"} doesn&apos;t have {cat.label.toLowerCase()} yet.
                      </p>
                    ) : (
                      <FieldGroup className="gap-0 divide-y divide-theme-border">
                        {fields.map((field) => (
                          <SettingFieldRow key={field.key} deviceId={device.id} field={field} currentValue={settingsMap.get(`${cat.key}:${field.key}`) ?? ""} className="py-3.5 first:pt-0 last:pb-0" />
                        ))}
                      </FieldGroup>
                    )}
                  </DeviceCard>
                );
              })}
            </div>
          ) : null
        }
      />

      {evInfo ? <EvSettingsSection chargerId={device.id} info={evInfo} sync={sync} isStaff={isStaffRole(profile?.role)} /> : null}

      <DeviceActivity deviceId={device.id} />
    </div>
  );
}
