import { redirect } from "next/navigation";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { createClient } from "@waytara/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
        <div className="rounded-lg border border-theme-border bg-theme-alert-subtle px-4 py-3 text-sm text-theme-alert">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-theme-border bg-theme-highlight-subtle px-4 py-3 text-sm text-theme-highlight">
          Saved.
        </div>
      )}

      {devicesWithFields.length === 0 ? (
        <p className="text-sm text-theme-muted">No devices with configurable settings yet.</p>
      ) : (
        devicesWithFields.map((device) => (
          <div key={device.id} className="rounded-xl border border-theme-border bg-theme-surface p-5">
            <p className="text-sm font-semibold text-theme-primary">
              {device.device_type?.name ?? "Device"}
              <span className="ml-1.5 font-normal text-theme-muted">— {device.label || device.device_uid}</span>
            </p>

            <div className="mt-4 space-y-4">
              {device.fields.map((field) => {
                const currentValue = currentSettings.get(`${device.id}:${field.key}`) ?? "";
                const fieldId = `${device.id}-${field.key}`;
                return (
                  <form key={field.key} action={updateDeviceSetting} className="flex items-end gap-3">
                    <input type="hidden" name="deviceId" value={device.id} />
                    <input type="hidden" name="deviceTypeCode" value={device.device_type?.code ?? ""} />
                    <input type="hidden" name="settingKey" value={field.key} />
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={fieldId}>
                        {field.label}
                        {field.unit ? ` (${field.unit})` : ""}
                      </Label>
                      {field.type === "select" ? (
                        <select
                          id={fieldId}
                          name="settingValue"
                          defaultValue={currentValue}
                          className="h-10 w-full rounded-lg border border-theme-border bg-theme-bg px-3 text-sm text-theme-primary"
                        >
                          <option value="" disabled>
                            Select…
                          </option>
                          {field.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
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
                      {field.helpText && <p className="text-xs text-theme-muted">{field.helpText}</p>}
                      {currentValue && (
                        <p className="text-xs text-theme-muted">
                          Current: {currentValue}
                          {field.unit ? ` ${field.unit}` : ""}
                        </p>
                      )}
                    </div>
                    <Button type="submit" size="sm" variant="outline">
                      Save
                    </Button>
                  </form>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
