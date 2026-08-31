"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";

export async function createDeviceType(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!code || !name) {
    redirect(`/devices?error=${encodeURIComponent("Code and name are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("device_types").insert({ code, name, manufacturer, description });

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}

export async function updateDeviceType(deviceTypeId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name) {
    redirect(`/devices?error=${encodeURIComponent("Name is required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("device_types")
    .update({ name, manufacturer, description })
    .eq("id", deviceTypeId);

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}

export async function addInstrument(deviceTypeId: string, formData: FormData) {
  const instrumentKey = String(formData.get("instrumentKey") ?? "").trim();
  const instrumentName = String(formData.get("instrumentName") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const isRequired = formData.get("isRequired") === "on";

  if (!instrumentKey || !instrumentName) {
    redirect(`/devices?error=${encodeURIComponent("Instrument key and name are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("device_type_instruments").insert({
    device_type_id: deviceTypeId,
    instrument_key: instrumentKey,
    instrument_name: instrumentName,
    unit,
    category,
    is_required: isRequired,
  });

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}

export async function removeInstrument(instrumentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("device_type_instruments").delete().eq("id", instrumentId);

  if (error) {
    redirect(`/devices?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/devices");
  redirect("/devices?success=1");
}
