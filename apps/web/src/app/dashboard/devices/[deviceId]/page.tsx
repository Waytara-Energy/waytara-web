import { notFound } from "next/navigation";
import { CheckCircle2, Settings2, TriangleAlert } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getCustomerPlan } from "@/lib/customer-plan";
import { getSelectedSite } from "@/lib/selected-site";
import { getSettingFieldsByCategory, getSettingCategories } from "@/lib/instrument-settings-catalog";
import { defaultTouSlots, type TouSlot } from "@/lib/time-of-use";
import { PROPERTY_TYPE_OPTIONS, POWER_SOURCE_OPTIONS, POWER_PACKAGE_OPTIONS } from "@/lib/site-catalog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceDetailsCard } from "@/components/dashboard/device-details-card";
import { SiteDetailsCard } from "@/components/dashboard/site-details-card";
import { DeviceOverviewContent } from "@/components/dashboard/device-overview-content";
import { SettingFieldRow } from "@/components/dashboard/setting-field-row";
import { TimeOfUseEditor } from "@/components/dashboard/time-of-use-editor";
import { EnableLocationButton } from "@/components/dashboard/enable-location-button";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { updateSiteSetting } from "./actions";

function parseTouSlots(settingsMap: Map<string, string>): TouSlot[] {
  return defaultTouSlots().map((def) => {
    const raw = settingsMap.get(`system_work_mode:tou_prog${def.index}`);
    if (!raw) return def;
    try {
      const parsed = JSON.parse(raw) as Partial<TouSlot>;
      return {
        index: def.index,
        startTime: typeof parsed.startTime === "string" ? parsed.startTime : def.startTime,
        powerW: typeof parsed.powerW === "number" ? parsed.powerW : def.powerW,
        capacityPct: typeof parsed.capacityPct === "number" ? parsed.capacityPct : def.capacityPct,
        chargeSource: parsed.chargeSource ?? def.chargeSource,
        gridSellEnabled: typeof parsed.gridSellEnabled === "boolean" ? parsed.gridSellEnabled : def.gridSellEnabled,
      };
    } catch {
      return def;
    }
  });
}

// A single device's own page — the consolidated hub that used to be three
// separate destinations (Devices, Sites & Devices, Instrument Settings):
//
//  1. Device Details — identity strip (label, model, serial, warranty).
//  2. Site Details — the site this device belongs to, shown unconditionally
//     (not gated) so every customer can see it even without the settings
//     feature.
//  3. Overview — category-aware telemetry/status (DeviceOverviewContent):
//     solar_inverter gets the energy-flow/fault/today-so-far view,
//     ev_charger gets its own OCPP live-charging view, anything else a
//     generic parameter-card fallback.
//  4. Site & Settings — editable, gated behind `features.instrument_settings`
//     same as the old Instrument Settings page was: a Site Setting tab
//     (edits `sites`/`devices`) plus one tab per category from
//     `getSettingCategories(category)` — 6 Deye-backed tabs for a solar
//     inverter, one OCPP Configuration tab for an EV charger, none for an
//     unrecognized category (nothing to show instead of a broken tab).
//
// A device id foreign to the selected site 404s rather than silently
// falling back to some other device — this is its own dedicated URL, not
// a `?device=` filter with a sane "pick something" default.
export default async function DeviceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const supabase = await createClient();
  const [site, { deviceId }, { error, success }, customerPlan] = await Promise.all([
    getSelectedSite(),
    params,
    searchParams,
    getCustomerPlan(),
  ]);
  const device = site?.devices.find((d) => d.id === deviceId) ?? null;

  if (!site || !device) notFound();

  const category = device.deviceType?.category ?? "";
  const isSolarInverter = category === "solar_inverter";
  const canEditSettings = customerPlan?.features?.instrument_settings ?? false;
  const settingCategories = getSettingCategories(category);
  const address = site.address ?? {};

  let settingsMap = new Map<string, string>();
  if (canEditSettings) {
    const { data: settingsRows } = await supabase
      .from("device_settings")
      .select("setting_category, setting_key, setting_value, ts")
      .eq("device_id", device.id)
      .order("ts", { ascending: true }); // ts-ascending, so the last write per (category, key) wins.
    settingsMap = new Map(settingsRows?.map((row) => [`${row.setting_category}:${row.setting_key}`, row.setting_value]));
  }
  const touSlots = parseTouSlots(settingsMap);

  return (
    <div className="max-w-3xl space-y-6">
      <RealtimeRefresh table="device_readings" event="INSERT" filter={`device_id=eq.${device.id}`} />
      {category === "ev_charger" && (
        // Same reasoning as the site-wide Overview page's own pair of these
        // — charging_sessions is derived, not raw device_readings, and a
        // session opens via INSERT but closes via UPDATE on that same row.
        <>
          <RealtimeRefresh table="charging_sessions" event="INSERT" filter={`device_id=eq.${device.id}`} />
          <RealtimeRefresh table="charging_sessions" event="UPDATE" filter={`device_id=eq.${device.id}`} />
        </>
      )}
      {canEditSettings && (
        // device_settings is append-only (a new row per change, ts-ascending
        // "last write wins" — see the settingsMap comment above), never
        // updated in place: an UPDATE subscription here never fires.
        // INSERT is the real write event.
        <RealtimeRefresh table="device_settings" event="INSERT" filter={`device_id=eq.${device.id}`} />
      )}

      <h1 className="text-2xl font-semibold text-foreground">Device</h1>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Saved</AlertTitle>
        </Alert>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Device Details</h2>
        <DeviceDetailsCard device={device} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Site Details</h2>
        <SiteDetailsCard site={site} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Overview</h2>
        <DeviceOverviewContent supabase={supabase} site={site} device={device} />
      </div>

      {canEditSettings && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Site &amp; Settings</h2>
          {/* Keyed on the device: every field below is an uncontrolled input
              seeded once from server data — <Input defaultValue>, <Select
              defaultValue>, and SettingFieldRow/TimeOfUseEditor's own
              useState(propValue). Since this page is itself scoped to one
              device by route param, switching devices is a full navigation
              (new page instance) rather than a re-render with new props, so
              this key mostly guards against React reusing the subtree
              across a fast client-side nav between two device pages. */}
          <Tabs key={device.id} defaultValue="site" className="w-full">
            <TabsList className="h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="site">Site Setting</TabsTrigger>
              {settingCategories.map((cat) => (
                <TabsTrigger key={cat.key} value={cat.key}>
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
                  <form action={updateSiteSetting.bind(null, device.id)} className="space-y-6">
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
                          <FieldDescription>Used to place this site accurately — grants your browser's location just once.</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldGroup>

                    <SubmitButton pendingText="Saving…">Save site</SubmitButton>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {settingCategories.map((cat) => {
              const fields = getSettingFieldsByCategory(category, cat.key);
              return (
                <TabsContent key={cat.key} value={cat.key}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{cat.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {cat.helpText && <p className="text-sm text-theme-muted">{cat.helpText}</p>}

                      {cat.key === "advanced" ? (
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Settings2 />
                            </EmptyMedia>
                            <EmptyTitle>Nothing available yet</EmptyTitle>
                            <EmptyDescription>
                              No Advanced Function settings on this device model are confirmed safe to write yet.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      ) : fields.length === 0 ? (
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
                        <>
                          {fields.map((field) => (
                            <SettingFieldRow
                              key={field.key}
                              deviceId={device.id}
                              field={field}
                              currentValue={settingsMap.get(`${cat.key}:${field.key}`) ?? ""}
                            />
                          ))}
                          {cat.key === "system_work_mode" && isSolarInverter && (
                            <div className="space-y-2 pt-2">
                              <h3 className="text-sm font-semibold text-theme-primary">Time-of-Use schedule</h3>
                              <p className="text-sm text-theme-muted">
                                Prog1-6 run in order, each until the next one starts (wrapping from Prog6 back to Prog1).
                              </p>
                              <TimeOfUseEditor deviceId={device.id} initialSlots={touSlots} />
                            </div>
                          )}
                        </>
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
