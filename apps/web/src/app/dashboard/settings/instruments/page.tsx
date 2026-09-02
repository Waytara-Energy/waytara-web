import { redirect } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSettingFields } from "@/lib/instrument-settings-catalog";
import { updateDeviceSetting } from "./actions";

// Server-side gate, matching Monitoring/Performance/Analytics/Reports —
// only the Advance tier has plans.features.instrument_settings.
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

  const { data: devices } = await supabase
    .from("devices")
    .select("id, device_uid, label, device_type:device_types(code, name)")
    .order("created_at", { ascending: true });

  const deviceIds = (devices ?? []).map((d) => d.id);
  let currentSettings = new Map<string, string>(); // `${deviceId}:${key}` -> latest value

  if (deviceIds.length > 0) {
    const { data: settingsRows } = await supabase
      .from("device_settings")
      .select("device_id, setting_key, setting_value, ts")
      .in("device_id", deviceIds)
      .order("ts", { ascending: true });

    // Rows are ts-ascending, so the last write per (device, key) wins.
    for (const row of settingsRows ?? []) {
      currentSettings.set(`${row.device_id}:${row.setting_key}`, row.setting_value);
    }
  }

  const devicesWithFields = (devices ?? [])
    .map((d) => ({
      ...d,
      fields: getSettingFields(d.device_type?.code ?? ""),
    }))
    .filter((d) => d.fields.length > 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Instrument Settings</h1>
        <p className="mt-1 text-sm text-theme-muted">Configure operating parameters for your devices.</p>
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

      {devicesWithFields.length === 0 ? (
        <p className="text-sm text-theme-muted">No devices with configurable settings yet.</p>
      ) : (
        devicesWithFields.map((device) => (
          <Card key={device.id}>
            <CardHeader>
              <CardTitle>
                {device.device_type?.name ?? "Device"}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  — {device.label || device.device_uid}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {device.fields.map((field) => {
                const currentValue = currentSettings.get(`${device.id}:${field.key}`) ?? "";
                const fieldId = `${device.id}-${field.key}`;
                return (
                  <form key={field.key} action={updateDeviceSetting} className="flex items-end gap-3">
                    <input type="hidden" name="deviceId" value={device.id} />
                    <input type="hidden" name="deviceTypeCode" value={device.device_type?.code ?? ""} />
                    <input type="hidden" name="settingKey" value={field.key} />
                    <FieldGroup className="flex-1">
                      <Field>
                        <FieldLabel htmlFor={fieldId}>
                          {field.label}
                          {field.unit ? ` (${field.unit})` : ""}
                        </FieldLabel>
                        <FieldContent>
                          {field.type === "select" ? (
                            <Select name="settingValue" defaultValue={currentValue || undefined} required>
                              <SelectTrigger id={fieldId} className="w-full">
                                <SelectValue placeholder="Select…" />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options?.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={fieldId}
                              name="settingValue"
                              type="number"
                              min={field.min}
                              max={field.max}
                              step={field.step}
                              defaultValue={currentValue}
                            />
                          )}
                          {field.helpText && <FieldDescription>{field.helpText}</FieldDescription>}
                          {currentValue && (
                            <FieldDescription>
                              Current: {currentValue}
                              {field.unit ? ` ${field.unit}` : ""}
                            </FieldDescription>
                          )}
                        </FieldContent>
                      </Field>
                    </FieldGroup>
                    <Button type="submit" size="sm" variant="outline">
                      Save
                    </Button>
                  </form>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
