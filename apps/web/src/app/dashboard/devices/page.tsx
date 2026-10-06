import { Cpu, Settings2 } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { getSettingFields, getSettingFieldsByCategory } from "@/lib/instrument-settings-catalog";
import { fetchDeviceSettingFields, categoryLabel } from "@/lib/instrument-catalog-data";
import { fetchDashboardFields, fetchFieldValues } from "@/lib/template-fields";
import { LiveDynamicFieldGroup } from "@/components/dashboard/live-field-group";
import { valuesFor } from "@/lib/field-values";
import { PROPERTY_TYPE_OPTIONS, POWER_SOURCE_OPTIONS, POWER_PACKAGE_OPTIONS } from "@/lib/site-catalog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ActionForm } from "@waytara/ui/action-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceSwitcher } from "@/components/dashboard/device-switcher";
import { DeviceIdentityCard } from "@/components/dashboard/device-identity-card";
import { DeviceOverviewContent } from "@/components/dashboard/device-overview-content";
import { SettingFieldRow } from "@/components/dashboard/setting-field-row";
import { InstrumentSettingRow } from "@/components/dashboard/instrument-setting-row";
import { EnableLocationButton } from "@/components/dashboard/enable-location-button";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { updateSiteSetting } from "./actions";

// The Devices module — same `?device=` + DeviceSwitcher pattern as
// Monitoring/Performance/Reports/Maintenance (a card grid you clicked
// through to a separate per-device route used to live here; that extra
// step was the odd one out against every other device-scoped page, so it's
// gone — picking a device now updates this same page in place).
//
//  1. Device Details — identity strip (label, model, serial, warranty).
//  2. Site Details — the site this device belongs to, shown unconditionally
//     (not gated) so every customer can see it even without the settings
//     feature.
//  3. Overview — category-aware telemetry/status (DeviceOverviewContent):
//     solar_inverter gets the fault/today-so-far view (no energy-flow
//     diagram here — Overview already owns that visualization),
//     ev_charger gets its own OCPP live-charging view, anything else a
//     generic parameter-card fallback.
//  4. Site & Settings — editable, gated behind `features.instrument_settings`
//     same as the old Instrument Settings page was: a Site Setting tab
//     (edits `sites`/`devices`) plus one tab per category. solar_inverter
//     and ev_charger both get their tabs from instrument_catalog directly;
//     anything else (currently just battery_storage) falls back to
//     instrument-settings-catalog.ts's hardcoded fields.
export default async function DevicesPage({
  searchParams,
}: {
  // error/success still arrive on the URL (updateSiteSetting's own
  // redirect sets them) but aren't read here — <ToastFromSearchParams>
  // below reads them client-side and turns them into a toast instead.
  searchParams: Promise<{ device?: string }>;
}) {
  const supabase = await createClient();
  const [site, { device: deviceIdParam }, customerPlan] = await Promise.all([
    getSelectedSite(),
    searchParams,
    getCustomerPlan(),
  ]);
  const device = await resolveDeviceInSite(site, deviceIdParam);

  if (!site || !device) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Devices</h1>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Cpu />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const category = device.deviceType?.category ?? "";

  // "Device Info" (both categories) and solar's "Installer Settings (view
  // only)" — the two read-direction categories under dashboard_section
  // "Device & Settings" that nothing renders yet (the write-direction
  // categories below are already fully DB-driven from earlier session
  // work). Unconditional, like Device/Site Details above — this is plain
  // informational display, not gated behind the instrument_settings
  // feature flag the editable Site & Settings section below is.
  const deviceInfoSections = await fetchDashboardFields(supabase, device, "Device & Settings");
  const deviceInfoFields = deviceInfoSections.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const deviceInfoValues = await fetchFieldValues(
    supabase,
    device.id,
    deviceInfoFields.map((f) => f.key)
  );
  const getDeviceInfoValue = (key: string) => deviceInfoValues.get(key) ?? null;
  // Both categories instrument_catalog actually covers (Section 1's Deye
  // seed for solar_inverter, 20260926000000's OCPP seed for ev_charger)
  // get the real DB-driven Settings pipeline; anything else (currently
  // just battery_storage, which has no register source of its own) falls
  // back to instrument-settings-catalog.ts's hardcoded fields.
  const isCatalogDriven = category === "solar_inverter" || category === "ev_charger";
  const canEditSettings = customerPlan?.features?.instrument_settings ?? false;
  // Fallback path's own tab list, derived from whichever categories its
  // hardcoded fields actually use (currently just "battery" for
  // battery_storage) rather than a separate hand-maintained list.
  const fallbackCategories = Array.from(new Set(getSettingFields(category).map((f) => f.category))).map((key) => ({
    key,
    label: categoryLabel(key),
  }));
  const address = site.address ?? {};

  let settingsMap = new Map<string, string>();
  let deviceSettingsCatalog: Awaited<ReturnType<typeof fetchDeviceSettingFields>> | null = null;
  if (canEditSettings) {
    const { data: settingsRows } = await supabase
      .from("equipment_configs")
      .select("setting_category, key_name, setting_value, ts")
      .eq("equipment_id", device.id)
      .order("ts", { ascending: true }); // ts-ascending, so the last write per (category, key) wins.
    settingsMap = new Map(settingsRows?.map((row) => [`${row.setting_category}:${row.key_name}`, row.setting_value]));

    if (isCatalogDriven) {
      deviceSettingsCatalog = await fetchDeviceSettingFields(supabase, device);
    }
  }

  // Tab keys come straight from whichever categories this device's own
  // write-direction equipment_metrics rows actually cover (My Settings,
  // System Checks, ...) — equipment_templates.category is the real,
  // Title-Case value categoryLabel()/CATEGORY_LABELS already key off of
  // everywhere else in this app; there's no separate lowercase
  // "solar"/"battery"/"charging" naming scheme, so hardcoding one here
  // only ever produced zero tabs. A category with zero enabled write
  // fields for this specific device (none of this device's own
  // equipment_metrics rows for it have show_for_user = true) just doesn't
  // get a tab. Sorted alphabetically since equipment_templates has no
  // ordering column of its own — purely presentation, not stored anywhere.
  const catalogCategoryKeys = deviceSettingsCatalog ? Array.from(deviceSettingsCatalog.fieldsByCategory.keys()).sort() : [];

  return (
    <div className="space-y-6">
      {category === "ev_charger" && (
        // Same reasoning as the site-wide Overview page's own pair of these
        // — ev_sessions is derived, not raw equipment_telemetry, and a
        // session opens via INSERT but closes via UPDATE on that same row.
        <>
          <RealtimeRefresh table="ev_sessions" event="INSERT" filter={`equipment_id=eq.${device.id}`} />
          <RealtimeRefresh table="ev_sessions" event="UPDATE" filter={`equipment_id=eq.${device.id}`} />
        </>
      )}
      {canEditSettings && (
        // equipment_configs is append-only (a new row per change, ts-ascending
        // "last write wins" — see the settingsMap comment above), never
        // updated in place: an UPDATE subscription here never fires.
        // INSERT is the real write event.
        <RealtimeRefresh table="equipment_configs" event="INSERT" filter={`equipment_id=eq.${device.id}`} />
      )}

      <div>
        <DeviceSwitcher devices={site.devices} selectedId={device.id} />
        <p className="mt-1 text-sm text-theme-muted">Device identity, live status, and settings.</p>
      </div>

      <DeviceIdentityCard device={device} site={site} />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Overview</h2>
        <DeviceOverviewContent supabase={supabase} site={site} device={device} showEnergyFlowDiagram={false} />
      </div>

      {deviceInfoSections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Device Info</h2>
          {/* Columns, not a grid — these cards vary a lot in height (a
              2-field group next to a 12-field one), and grid's row-major
              placement would leave a tall gap under the short one instead
              of letting the next card flow up to fill it. */}
          <div className="columns-1 gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {deviceInfoSections.map((section) =>
              section.groups.map((group) => (
                <LiveDynamicFieldGroup deviceId={device.id}
                  key={`${section.category}-${group.groupName ?? ""}`}
                  title={group.groupName ? `${section.category} — ${group.groupName}` : section.category}
                  fields={group.fields}
                  initial={valuesFor(group.fields, getDeviceInfoValue)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {canEditSettings && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Site &amp; Settings</h2>
          {/* Keyed on the device: every field below is an uncontrolled input
              seeded once from server data — <Input defaultValue>, <Select
              defaultValue>, and SettingFieldRow's own
              useState(propValue). Switching devices re-renders this same
              page instance with new props (not a full route change), so
              this key is what forces React to remount the subtree instead
              of reusing stale uncontrolled state from the previous
              device — same reasoning as MonitoringTabs' own device key. */}
          <Tabs key={device.id} defaultValue="site" className="w-full">
            <TabsList variant="line">
              <TabsTrigger value="site" variant="line">
                Site Setting
              </TabsTrigger>
              {isCatalogDriven
                ? catalogCategoryKeys.map((key) => (
                    <TabsTrigger key={key} value={key} variant="line">
                      {categoryLabel(key)}
                    </TabsTrigger>
                  ))
                : fallbackCategories.map((cat) => (
                    <TabsTrigger key={cat.key} value={cat.key} variant="line">
                      {cat.label}
                    </TabsTrigger>
                  ))}
            </TabsList>

            <TabsContent value="site">
              <Card>
                <CardHeader>
                  <CardTitle>Site &amp; device</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActionForm
                    action={updateSiteSetting.bind(null, device.id)}
                    loading="Saving site…"
                    success="Site saved."
                    className="space-y-6"
                  >
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="deviceLabel">Device label</FieldLabel>
                        <FieldContent>
                          <Input
                            id="deviceLabel"
                            name="deviceLabel"
                            defaultValue={device.label ?? ""}
                            placeholder={device.deviceType?.serialNumber ?? device.deviceType?.modelNumber ?? "Device"}
                          />
                          <FieldDescription>A friendly name for this device — shown in the header switcher.</FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="siteName">Site name</FieldLabel>
                        <FieldContent>
                          <Input id="siteName" name="siteName" required defaultValue={site.name ?? ""} />
                        </FieldContent>
                      </Field>

                      <Field orientation="responsive">
                        <FieldLabel htmlFor="propertyType">Property type</FieldLabel>
                        <FieldContent>
                          <Select name="propertyType" defaultValue={site.propertyType ?? undefined} required>
                            <SelectTrigger id="propertyType" className="w-full">
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROPERTY_TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldContent>
                      </Field>

                      <Field orientation="responsive">
                        <FieldLabel htmlFor="powerPackage">Power package</FieldLabel>
                        <FieldContent>
                          <Select name="powerPackage" defaultValue={site.powerPackage ?? undefined}>
                            <SelectTrigger id="powerPackage" className="w-full">
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                              {POWER_PACKAGE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldDescription>What equipment this site has — decides which wires the energy flow diagram can show.</FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field orientation="responsive">
                        <FieldLabel htmlFor="powerSourceCategory">Power source</FieldLabel>
                        <FieldContent>
                          <Select name="powerSourceCategory" defaultValue={site.powerSourceCategory ?? undefined} required>
                            <SelectTrigger id="powerSourceCategory" className="w-full">
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                              {POWER_SOURCE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel>Address</FieldLabel>
                        <FieldContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Input name="addressLine1" placeholder="Address line" defaultValue={address.line1 ?? ""} />
                          <Input name="addressCity" placeholder="City" defaultValue={address.city ?? ""} />
                          <Input name="addressState" placeholder="State" defaultValue={address.state ?? ""} />
                          <Input name="addressPincode" placeholder="PIN code" defaultValue={address.pincode ?? ""} />
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel>Location</FieldLabel>
                        <FieldContent>
                          <EnableLocationButton initialLatitude={site.latitude ?? null} initialLongitude={site.longitude ?? null} />
                          <FieldDescription>Used to place this site accurately — grants your browser&apos;s location just once.</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldGroup>

                    <SubmitButton pendingText="Saving…">Save site</SubmitButton>
                  </ActionForm>
                </CardContent>
              </Card>
            </TabsContent>

            {isCatalogDriven
              ? catalogCategoryKeys.map((key) => {
                  const fields = deviceSettingsCatalog!.fieldsByCategory.get(key) ?? [];
                  return (
                    <TabsContent key={key} value={key}>
                      <Card>
                        <CardHeader>
                          <CardTitle>{categoryLabel(key)}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {/* FieldGroup (not a bare list of Fields) so each
                              row's own `orientation="responsive"` actually
                              has the `@container/field-group` ancestor it
                              needs to lay out label-left/control-right on a
                              wide screen — gap-0 since divide-y + each
                              row's own py-4 already spaces them. */}
                          <FieldGroup className="gap-0 divide-y divide-theme-border">
                            {fields.map((field) => (
                              <InstrumentSettingRow
                                key={field.key}
                                deviceId={device.id}
                                field={field}
                                enumOptions={field.enumRef ? (deviceSettingsCatalog!.enumOptionsByRef.get(field.enumRef) ?? []) : []}
                                className="py-4 first:pt-0 last:pb-0"
                              />
                            ))}
                          </FieldGroup>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  );
                })
              : fallbackCategories.map((cat) => {
                  const fields = getSettingFieldsByCategory(category, cat.key);
                  return (
                    <TabsContent key={cat.key} value={cat.key}>
                      <Card>
                        <CardHeader>
                          <CardTitle>{cat.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {fields.length === 0 ? (
                            <Empty>
                              <EmptyHeader>
                                <EmptyMedia variant="icon">
                                  <Settings2 />
                                </EmptyMedia>
                                <EmptyTitle>Not applicable for this device</EmptyTitle>
                                <EmptyDescription>
                                  {device.deviceType?.name ?? "This device type"} doesn&apos;t have {cat.label.toLowerCase()} yet.
                                </EmptyDescription>
                              </EmptyHeader>
                            </Empty>
                          ) : (
                            <FieldGroup className="gap-0 divide-y divide-theme-border">
                              {fields.map((field) => (
                                <SettingFieldRow
                                  key={field.key}
                                  deviceId={device.id}
                                  field={field}
                                  currentValue={settingsMap.get(`${cat.key}:${field.key}`) ?? ""}
                                  className="py-4 first:pt-0 last:pb-0"
                                />
                              ))}
                            </FieldGroup>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  );
                })}
          </Tabs>
        </div>
      )}
    </div>
  );
}
