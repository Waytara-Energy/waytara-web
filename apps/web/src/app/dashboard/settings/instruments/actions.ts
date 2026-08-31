"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import { getSettingFields } from "@/lib/instrument-settings-catalog";

export async function updateDeviceSetting(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const deviceId = String(formData.get("deviceId") ?? "");
  const deviceTypeCode = String(formData.get("deviceTypeCode") ?? "");
  const settingKey = String(formData.get("settingKey") ?? "");
  const settingValue = String(formData.get("settingValue") ?? "").trim();

  const field = getSettingFields(deviceTypeCode).find((f) => f.key === settingKey);
  if (!deviceId || !field) {
    redirect(`/dashboard/settings/instruments?error=${encodeURIComponent("Unknown setting.")}`);
  }
  if (!settingValue) {
    redirect(`/dashboard/settings/instruments?error=${encodeURIComponent("Value can't be empty.")}`);
  }
  if (field.type === "number") {
    const num = Number(settingValue);
    if (Number.isNaN(num) || (field.min !== undefined && num < field.min) || (field.max !== undefined && num > field.max)) {
      redirect(
        `/dashboard/settings/instruments?error=${encodeURIComponent(`${field.label} must be between ${field.min} and ${field.max}.`)}`
      );
    }
  }
  if (field.type === "select" && !field.options?.some((o) => o.value === settingValue)) {
    redirect(`/dashboard/settings/instruments?error=${encodeURIComponent("Invalid option.")}`);
  }

  const supabase = await createClient();
  // Append-only log, not an update-in-place — RLS (settings_owner_insert)
  // scopes this to a device the signed-in customer actually owns.
  const { error } = await supabase.from("device_settings").insert({
    device_id: deviceId,
    setting_category: field.category,
    setting_key: field.key,
    setting_value: settingValue,
    unit: field.unit ?? null,
    source: "customer_dashboard",
    written_by: profile.id,
  });

  if (error) {
    redirect(`/dashboard/settings/instruments?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/settings/instruments");
  redirect("/dashboard/settings/instruments?success=1");
}
