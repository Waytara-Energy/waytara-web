import { redirect } from "next/navigation";
import { CheckCircle2, Settings2, TriangleAlert } from "lucide-react";
import { createClient } from "@waytara/supabase/server";
import { getCustomerPlan } from "@/lib/customer-plan";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingFieldRow } from "@/components/dashboard/setting-field-row";
import { TimeOfUseEditor } from "@/components/dashboard/time-of-use-editor";
import { DevicePicker } from "@/components/dashboard/device-picker";
import { DeviceDetailsCard } from "@/components/dashboard/device-details-card";
import { getSelectedSite, resolveDeviceInSite } from "@/lib/selected-site";
import { getSettingFieldsByCategory, SETTING_CATEGORIES } from "@/lib/instrument-settings-catalog";
import { defaultTouSlots, type TouSlot } from "@/lib/time-of-use";
import { PROPERTY_TYPE_OPTIONS, POWER_SOURCE_OPTIONS } from "@/lib/site-catalog";
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

// Device-centric redesign, Phase 6: Instrument Settings is now a 7-tab
// console for the *selected* device — Site Setting (edits the device's
// site + its own label, not device-type-gated) plus the 6 Deye-backed
// tabs from deye_sunsynk_write_registers.md §8, which only populate real
// fields when the selected device is a solar_inverter (any other device
// type sees an honest "not applicable" state rather than stale/irrelevant
// fields — Advanced Function shows its informational state regardless,
// since nothing on this model is a confirmed-safe register yet).
export default async function InstrumentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; device?: string }>;
}) {
  const supabase = await createClient();
  // Three independent reads up front — none depends on another's result —
  // instead of a waterfall of sequential awaits. getCustomerPlan() is
  // cache()-deduped against the layout's own call, so this costs nothing
  // extra beyond what the layout already paid for. Which device at the
  // site is picked via this page's own `?device=` (DevicePicker below) —
  // a site can have more than one device now.
  const [{ error, success, device: deviceIdParam }, customerPlan, site] = await Promise.all([
    searchParams,
    getCustomerPlan(),
    getSelectedSite(),
  ]);
  const device = resolveDeviceInSite(site, deviceIdParam);

  const features = customerPlan?.features ?? {};
  if (!features.instrument_settings) {
    redirect("/dashboard");
  }

  // getSelectedSite() already carries the site's own name/property
  // type/power source/address — no separate `sites` query needed here
  // anymore, just the device's own settings log.
  const { data: settingsRows } = device
    ? await supabase
        .from("device_settings")
        .select("setting_category, setting_key, setting_value, ts")
        .eq("device_id", device.id)
        .order("ts", { ascending: true })
    : { data: null };

  // ts-ascending, so the last write per (category, key) wins.
  const settingsMap = new Map<string, string>(); // `${category}:${key}` -> latest value
  for (const row of settingsRows ?? []) {
    settingsMap.set(`${row.setting_category}:${row.setting_key}`, row.setting_value);
  }

  const isSolarInverter = device?.deviceType?.category === "solar_inverter";
  const touSlots = parseTouSlots(settingsMap);
  const address = site?.address ?? {};

  return (
    <div className="max-w-3xl space-y-6">
      {device && (
        // device_settings is append-only (a new row per change, ts-ascending
        // "last write wins" — see the settingsMap comment below), never
        // updated in place, confirmed live: an UPDATE subscription here
        // never fires. INSERT is the real write event.
        <RealtimeRefresh table="device_settings" event="INSERT" filter={`device_id=eq.${device.id}`} />
      )}
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Instrument Settings</h1>
        <p className="mt-1 text-sm text-theme-muted">
          {device
            ? `Configure ${device.label || device.deviceUid}.`
            : "Configure operating parameters for your devices."}
        </p>
      </div>

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

      {!device ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Settings2 />
            </EmptyMedia>
            <EmptyTitle>No devices yet</EmptyTitle>
            <EmptyDescription>Your WayTara advisor sets this up during installation.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
        {site && <DevicePicker devices={site.devices} selectedId={device.id} />}
        <DeviceDetailsCard device={device} />
        {/* Keyed on the selected device: every field below is an uncontrolled
            input seeded once from server data — <Input defaultValue>,
            <Select defaultValue>, and SettingFieldRow/TimeOfUseEditor's own
            useState(propValue). Switching devices (via the DevicePicker
            above, or the site switcher) re-renders this page with fresh
            props, but without a remount none of those re-read their new
            initial value — the form just keeps showing whatever the
            previously-selected device had. Changing `key` forces React to
            tear down and remount the whole subtree on every device switch,
            so it re-seeds from the new device's data instead of preserving
            the stale one. */}
        <Tabs key={device.id} defaultValue="site" className="w-full">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="site">Site Setting</TabsTrigger>
            {SETTING_CATEGORIES.map((cat) => (
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
                          placeholder={device.deviceUid}
                        />
                        <FieldDescription>A friendly name for this device — shown in the header switcher.</FieldDescription>
                      </FieldContent>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="siteName">Site name</FieldLabel>
                      <FieldContent>
                        <Input id="siteName" name="siteName" required defaultValue={site?.name ?? ""} />
                      </FieldContent>
                    </Field>

                    <Field orientation="responsive">
                      <FieldLabel htmlFor="propertyType">Property type</FieldLabel>
                      <FieldContent>
                        <Select name="propertyType" defaultValue={site?.propertyType ?? undefined} required>
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
                      <FieldLabel htmlFor="powerSourceCategory">Power source</FieldLabel>
                      <FieldContent>
                        <Select name="powerSourceCategory" defaultValue={site?.powerSourceCategory ?? undefined} required>
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
                  </FieldGroup>

                  <SubmitButton pendingText="Saving…">Save site</SubmitButton>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {SETTING_CATEGORIES.map((cat) => {
            const fields = isSolarInverter ? getSettingFieldsByCategory("solar_inverter", cat.key) : [];
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
                    ) : !isSolarInverter ? (
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
                        {cat.key === "system_work_mode" && (
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
        </>
      )}
    </div>
  );
}
