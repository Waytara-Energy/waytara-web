import { redirect } from "next/navigation";
import { CheckCircle2, Settings2, TriangleAlert } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingFieldRow } from "@/components/dashboard/setting-field-row";
import { TimeOfUseEditor } from "@/components/dashboard/time-of-use-editor";
import { getSelectedDevice } from "@/lib/selected-device";
import { getSettingFieldsByCategory, SETTING_CATEGORIES } from "@/lib/instrument-settings-catalog";
import { defaultTouSlots, type TouSlot } from "@/lib/time-of-use";
import { PROPERTY_TYPE_OPTIONS, POWER_SOURCE_OPTIONS, type SiteAddress } from "@/lib/site-catalog";
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
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = profile
    ? await supabase.from("customers").select("plan:plans(features)").eq("id", profile.id).maybeSingle()
    : { data: null };

  const features = (customer?.plan?.features as Record<string, boolean>) ?? {};
  if (!features.instrument_settings) {
    redirect("/dashboard");
  }

  const device = await getSelectedDevice();

  const { data: site } = device?.site
    ? await supabase
        .from("sites")
        .select("id, name, property_type, power_source_category, address")
        .eq("id", device.site.id)
        .maybeSingle()
    : { data: null };

  const settingsMap = new Map<string, string>(); // `${category}:${key}` -> latest value
  if (device) {
    const { data: settingsRows } = await supabase
      .from("device_settings")
      .select("setting_category, setting_key, setting_value, ts")
      .eq("device_id", device.id)
      .order("ts", { ascending: true });

    // ts-ascending, so the last write per (category, key) wins.
    for (const row of settingsRows ?? []) {
      settingsMap.set(`${row.setting_category}:${row.setting_key}`, row.setting_value);
    }
  }

  const isSolarInverter = device?.deviceType?.code === "solar_inverter";
  const touSlots = parseTouSlots(settingsMap);
  const address = (site?.address as SiteAddress | null) ?? {};

  return (
    <div className="max-w-3xl space-y-6">
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
        <Tabs defaultValue="site" className="w-full">
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
                <form action={updateSiteSetting} className="space-y-6">
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
                        <Select name="propertyType" defaultValue={site?.property_type ?? undefined} required>
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
                        <Select name="powerSourceCategory" defaultValue={site?.power_source_category ?? undefined} required>
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

                  <Button type="submit">Save site</Button>
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
                            <TimeOfUseEditor initialSlots={touSlots} />
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
      )}
    </div>
  );
}
