"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@waytara/supabase/server";
import { getCurrentProfile } from "@waytara/supabase/auth";
import type { Json } from "@waytara/supabase";
import type { PricingLineItem } from "@waytara/ui/quotation-pdf";
import { sendQuoteLinkEmail } from "@/lib/send-quote-link-email";
import { sendCustomerInviteEmail } from "@/lib/send-customer-invite-email";
import { sendInstallCompleteEmail } from "@/lib/send-install-complete-email";
import { sendInstallScheduledEmail } from "@/lib/send-install-scheduled-email";

// Onboarding pipeline redesign, Phase 3: generating a quotation no longer
// creates a PDF or emails one — it creates a public, token-addressable
// quote the customer can view and respond to themselves (Phase 4). The
// PDF only gets generated once they actually accept it.
export async function createAndSendQuotation(onboardingId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const planId = String(formData.get("planId") ?? "");
  const gstRate = Number(formData.get("gstRate") ?? "18");
  let pricingBreakdown: PricingLineItem[] = [];
  try {
    pricingBreakdown = JSON.parse(String(formData.get("pricingBreakdown") ?? "[]"));
  } catch {
    // leave empty — caught by the validation below
  }

  if (!planId || pricingBreakdown.length === 0 || !Number.isFinite(gstRate) || gstRate < 0) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Pick a plan, add at least one pricing line, and set a valid GST rate.")}`
    );
  }

  const supabase = await createClient();

  const { data: onboarding, error: onboardingError } = await supabase
    .from("customer_onboarding")
    .select("lead_id")
    .eq("id", onboardingId)
    .single();

  if (onboardingError || !onboarding) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Couldn't load this onboarding record.")}`
    );
  }

  const [{ data: lead }, { data: plan }] = await Promise.all([
    supabase.from("leads").select("full_name, email, phone").eq("id", onboarding.lead_id).single(),
    // price_monthly is the plan's one-time price (see Billing & Plan) —
    // never trust the client's displayed number, re-read it here.
    supabase.from("plans").select("name, price_monthly").eq("id", planId).single(),
  ]);

  const hardwareTotal = pricingBreakdown.reduce((sum, item) => sum + item.amount, 0);
  const planPrice = plan?.price_monthly ?? 0;
  const subtotalAmount = hardwareTotal + planPrice;
  const gstAmount = Math.round(subtotalAmount * (gstRate / 100) * 100) / 100;
  const totalAmount = subtotalAmount + gstAmount;

  const { data: quotation, error: insertError } = await supabase
    .from("quotations")
    .insert({
      lead_id: onboarding.lead_id,
      employee_id: profile.id,
      plan_id: planId,
      pricing_breakdown: pricingBreakdown as unknown as Json,
      subtotal_amount: subtotalAmount,
      gst_rate: gstRate,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id, access_token")
    .single();

  if (insertError || !quotation) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent(insertError?.message ?? "Couldn't create the quotation.")}`
    );
  }

  if (lead?.email) {
    await sendQuoteLinkEmail({
      to: lead.email,
      leadName: lead.full_name ?? "Customer",
      totalAmount,
      accessToken: quotation.access_token,
    });
  }

  await supabase.from("leads").update({ status: "quoted" }).eq("id", onboarding.lead_id);

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Onboarding pipeline redesign, Phase 4 retired recordQuotationAccepted —
// the customer accepts (and picks a payment option) themselves on the
// public /quote/[token] page now, not the employee on their behalf.

export async function resendQuoteLinkEmail(onboardingId: string, quotationId: string) {
  const supabase = await createClient();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("lead_id, total_amount, access_token, status")
    .eq("id", quotationId)
    .single();

  if (!quotation || quotation.status !== "sent") {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Nothing to resend — this quote is no longer awaiting a response.")}`
    );
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("full_name, email")
    .eq("id", quotation.lead_id)
    .single();

  if (lead?.email) {
    await sendQuoteLinkEmail({
      to: lead.email,
      leadName: lead.full_name ?? "Customer",
      totalAmount: Number(quotation.total_amount),
      accessToken: quotation.access_token,
    });
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function recordQuotationRejected(
  quotationId: string,
  onboardingId: string,
  formData: FormData
) {
  const action = String(formData.get("action") ?? "");
  const supabase = await createClient();

  await supabase
    .from("quotations")
    .update({ status: "rejected", rejected_at: new Date().toISOString() })
    .eq("id", quotationId);

  if (action === "close") {
    const { data: onboarding } = await supabase
      .from("customer_onboarding")
      .select("lead_id")
      .eq("id", onboardingId)
      .single();

    if (onboarding?.lead_id) {
      await supabase.from("leads").update({ status: "lost" }).eq("id", onboarding.lead_id);
    }
  }
  // action === "re-quote": nothing further — the pipeline page shows the
  // create-quotation form again once no active (draft/sent) quotation remains.

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Onboarding pipeline redesign, Phase 5: payment now happens after the
// customer already has an account (they self-serve it from their own
// dashboard's onboarding-status page — apps/web's payFullAmount /
// payAdvanceAmount). These two stay only as an employee-side fallback for
// when payment arrives some other way (bank transfer, cash, a customer
// who calls in instead of using their dashboard) — same simulated
// gateway, but recording it here no longer creates an account/invite
// (that already happened; this stage's UI only ever shows once it has).
//
// Payment collection is SIMULATED — no Razorpay integration yet. Swap the
// guts of these for real Razorpay order creation + webhook-verified
// capture when that's wired up; the RLS policies and stage advancement
// are already the real thing.

export async function recordFullPayment(onboardingId: string, quotationId: string) {
  const supabase = await createClient();

  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("customer_id")
    .eq("id", onboardingId)
    .single();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("total_amount")
    .eq("id", quotationId)
    .single();

  if (!quotation || !onboarding?.customer_id) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent("Couldn't load this quotation.")}`);
  }

  await supabase.from("payments").insert({
    quotation_id: quotationId,
    customer_id: onboarding.customer_id,
    payment_type: "full",
    amount: quotation.total_amount,
    status: "paid",
    gateway: "simulated",
    paid_at: new Date().toISOString(),
  });

  await supabase.from("customer_onboarding").update({ current_stage: "site_setup" }).eq("id", onboardingId);

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function recordSplitPayment(
  onboardingId: string,
  quotationId: string,
  formData: FormData
) {
  const advanceAmount = Number(formData.get("advanceAmount") ?? 0);
  const supabase = await createClient();

  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("customer_id")
    .eq("id", onboardingId)
    .single();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("total_amount")
    .eq("id", quotationId)
    .single();

  const totalAmount = quotation ? Number(quotation.total_amount) : 0;

  if (!quotation || !onboarding?.customer_id || advanceAmount <= 0 || advanceAmount >= totalAmount) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Enter an advance amount greater than 0 and less than the total.")}`
    );
  }

  const balanceAmount = totalAmount - advanceAmount;

  await supabase.from("payments").insert([
    {
      quotation_id: quotationId,
      customer_id: onboarding.customer_id,
      payment_type: "advance",
      amount: advanceAmount,
      status: "paid",
      gateway: "simulated",
      paid_at: new Date().toISOString(),
    },
    {
      quotation_id: quotationId,
      customer_id: onboarding.customer_id,
      payment_type: "balance",
      amount: balanceAmount,
      status: "pending",
      gateway: "simulated",
    },
  ]);

  await supabase
    .from("quotations")
    .update({
      payment_option: "split",
      advance_amount: advanceAmount,
      balance_amount: balanceAmount,
    })
    .eq("id", quotationId);

  await supabase
    .from("customer_onboarding")
    .update({ balance_payment_status: "pending", current_stage: "site_setup" })
    .eq("id", onboardingId);

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Task 8.4: site & device setup.

export async function createSite(onboardingId: string, formData: FormData) {
  const propertyType = String(formData.get("propertyType") ?? "");
  const powerSourceCategory = String(formData.get("powerSourceCategory") ?? "");
  const siteName = String(formData.get("siteName") ?? "").trim();

  if (!propertyType || !powerSourceCategory || !siteName) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Fill in a site name, property type, and power source.")}`
    );
  }

  const supabase = await createClient();
  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("customer_id")
    .eq("id", onboardingId)
    .single();

  if (!onboarding?.customer_id) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("No customer linked to this onboarding yet.")}`
    );
  }

  const { error } = await supabase.from("sites").insert({
    customer_id: onboarding.customer_id,
    name: siteName,
    // Both are checked non-empty above and only ever come from this page's
    // own <select> options, so these casts are safe.
    property_type: propertyType as never,
    power_source_category: powerSourceCategory as never,
  });

  if (error) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function addDevice(onboardingId: string, siteId: string, formData: FormData) {
  const deviceTypeId = String(formData.get("deviceTypeId") ?? "");
  const deviceUid = String(formData.get("deviceUid") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;

  if (!deviceTypeId || !deviceUid) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Pick a device type and enter a device ID.")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("devices").insert({
    site_id: siteId,
    device_type_id: deviceTypeId,
    device_uid: deviceUid,
    label,
    status: "test",
  });

  if (error) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function completeSiteSetup(onboardingId: string) {
  const supabase = await createClient();
  await supabase
    .from("customer_onboarding")
    .update({ current_stage: "connection_test" })
    .eq("id", onboardingId);

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Task 8.3: the pipeline view distinguishes "waiting on customer" (no
// customer_id yet) from "profile submitted" — this is the resend option for
// the waiting case. Reuses the existing invite_token rather than minting a
// new one, so a link the customer may already have open keeps working.
export async function resendCustomerInviteEmail(onboardingId: string) {
  const supabase = await createClient();

  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("lead_id, invite_token, customer_id")
    .eq("id", onboardingId)
    .single();

  if (!onboarding || onboarding.customer_id || !onboarding.invite_token) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Nothing to resend — the account may already be set up.")}`
    );
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("full_name, email")
    .eq("id", onboarding.lead_id)
    .single();

  if (lead?.email) {
    await sendCustomerInviteEmail({
      to: lead.email,
      name: lead.full_name,
      inviteToken: onboarding.invite_token,
    });
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Task 8.5: connection test. test_sessions already existed in the schema
// (employee_id, site_id, status, data_purged) with a matching device_readings
// SELECT policy scoping is_test reads to a running session the employee
// owns — it just had no write path until this task's migration added one.

export async function startTestSession(onboardingId: string, siteId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.from("test_sessions").insert({
    site_id: siteId,
    employee_id: profile.id,
    status: "running",
  });

  if (error) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// No real hardware/gateway integration exists yet — same "simulate the
// hardware-dependent step" approach the customer's payment stage already
// uses (Task 8.2). Plausible-looking values by unit, not real telemetry;
// the point is to prove the wiring (RLS-scoped insert -> MonitoringPanel
// poll -> "mark verified"), not to model real inverter physics.
function simulatedValueFor(unit: string | null): number {
  switch (unit) {
    case "V":
      return Math.round((225 + Math.random() * 15) * 10) / 10;
    case "A":
      return Math.round(Math.random() * 20 * 10) / 10;
    case "W":
      return Math.round(Math.random() * 3000);
    case "kWh":
      return Math.round(Math.random() * 8 * 10) / 10;
    case "%":
      return Math.round(40 + Math.random() * 60);
    case "Hz":
      return Math.round((49.8 + Math.random() * 0.4) * 10) / 10;
    case "°C":
      return Math.round(25 + Math.random() * 10);
    default:
      return 1;
  }
}

export async function sendTestSignal(onboardingId: string, deviceId: string, formData: FormData) {
  const instrumentKeysRaw = String(formData.get("instrumentKeys") ?? "[]");
  let instruments: { key: string; unit: string | null }[] = [];
  try {
    instruments = JSON.parse(instrumentKeysRaw);
  } catch {
    instruments = [];
  }

  if (instruments.length === 0) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent("No instruments to send a signal for.")}`);
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("device_readings").insert(
    instruments.map((i) => ({
      device_id: deviceId,
      instrument_key: i.key,
      value: simulatedValueFor(i.unit),
      unit: i.unit,
      ts: now,
      is_test: true,
    }))
  );

  if (error) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function markDeviceVerified(onboardingId: string, deviceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("devices").update({ status: "active" }).eq("id", deviceId);

  if (error) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Onboarding pipeline redesign, Phase 7: per-device physical readiness —
// Availability, Quality, Power Connect — recorded separately from the
// existing Data Testing flow (sendTestSignal/markDeviceVerified, which
// already proves the device reports real values; no new mechanism
// needed there). One row per device, upserted on every save so the
// employee can revisit and adjust before scheduling install.
export async function updateEquipmentCheck(onboardingId: string, deviceId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.from("equipment_checks").upsert(
    {
      device_id: deviceId,
      availability: formData.get("availability") === "on",
      quality: formData.get("quality") === "on",
      power_connect: formData.get("power_connect") === "on",
      checked_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id" }
  );

  if (error) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function completeConnectionTest(onboardingId: string, sessionId: string, siteId: string) {
  const supabase = await createClient();

  const { data: devices } = await supabase.from("devices").select("id, status").eq("site_id", siteId);
  if (!devices || devices.length === 0 || devices.some((d) => d.status !== "active")) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Every device needs to be verified before completing the test.")}`
    );
  }

  // Server-side guard, not just a disabled button — Phase 7's readiness
  // checklist has to actually be complete for every device, same
  // discipline as the status check just above.
  const { data: checks } = await supabase
    .from("equipment_checks")
    .select("device_id, availability, quality, power_connect")
    .in(
      "device_id",
      devices.map((d) => d.id)
    );
  const checkByDevice = new Map((checks ?? []).map((c) => [c.device_id, c]));
  const allChecksComplete = devices.every((d) => {
    const c = checkByDevice.get(d.id);
    return c?.availability && c?.quality && c?.power_connect;
  });
  if (!allChecksComplete) {
    redirect(
      `/onboarding/${onboardingId}?error=${encodeURIComponent("Every device needs Availability, Quality, and Power Connect checked before completing the test.")}`
    );
  }

  // Purge the simulated test readings — test_sessions.data_purged is the
  // schema's own signal that this data is meant to be temporary, not kept
  // around once the session's done its job. RLS (readings_employee_delete_
  // own_test) only allows this while the session is still 'running', so
  // purge before flipping status.
  const deviceIds = devices.map((d) => d.id);
  await supabase.from("device_readings").delete().in("device_id", deviceIds).eq("is_test", true);

  const { error: sessionError } = await supabase
    .from("test_sessions")
    .update({ status: "verified", ended_at: new Date().toISOString(), data_purged: true })
    .eq("id", sessionId);

  if (sessionError) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(sessionError.message)}`);
  }

  await supabase.from("customer_onboarding").update({ current_stage: "install_scheduled" }).eq("id", onboardingId);

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function failTestSession(onboardingId: string, sessionId: string, formData: FormData) {
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const supabase = await createClient();

  const { error } = await supabase
    .from("test_sessions")
    .update({ status: "failed", ended_at: new Date().toISOString(), notes })
    .eq("id", sessionId);

  if (error) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

// Task 8.6: install completion — the pipeline's last two stages.
// install_scheduled_at has no dedicated write policy: onboarding_employee_
// update_own already covers any column on a row the employee owns.

// Onboarding pipeline redesign, Phase 8: a fixed Morning/Afternoon/Evening
// slot list, not free-form times — matches the confirmed decision to keep
// scheduling low-friction rather than a full calendar picker. Scheduling
// used to silently update a timestamp with no customer notification at
// all; it now emails them the date and slot every time (including a
// reschedule — the message reads correctly either way).
const VALID_TIME_SLOTS = ["morning", "afternoon", "evening"] as const;

export async function scheduleInstall(onboardingId: string, formData: FormData) {
  const scheduledDate = String(formData.get("scheduledDate") ?? "").trim();
  const timeSlot = String(formData.get("timeSlot") ?? "");

  if (!scheduledDate || !VALID_TIME_SLOTS.includes(timeSlot as (typeof VALID_TIME_SLOTS)[number])) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent("Pick a date and a time slot first.")}`);
  }

  const supabase = await createClient();
  const { data: onboarding, error } = await supabase
    .from("customer_onboarding")
    .update({
      install_scheduled_at: new Date(scheduledDate).toISOString(),
      install_time_slot: timeSlot,
    })
    .eq("id", onboardingId)
    .select("lead_id")
    .single();

  if (error) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(error.message)}`);
  }

  // Same profiles-RLS workaround as resendCustomerInviteEmail/
  // completeInstallation: the lead record carries the same name/email and
  // is RLS-visible to the employee regardless of whether an account exists.
  if (onboarding?.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("full_name, email")
      .eq("id", onboarding.lead_id)
      .single();

    if (lead?.email) {
      await sendInstallScheduledEmail({
        to: lead.email,
        name: lead.full_name,
        scheduledDate,
        timeSlot: timeSlot as "morning" | "afternoon" | "evening",
      });
    }
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}

export async function completeInstallation(onboardingId: string, siteId: string) {
  const supabase = await createClient();

  const { data: onboarding } = await supabase
    .from("customer_onboarding")
    .select("lead_id")
    .eq("id", onboardingId)
    .single();

  const { error: deviceError } = await supabase
    .from("devices")
    .update({ installed_at: new Date().toISOString() })
    .eq("site_id", siteId);

  if (deviceError) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(deviceError.message)}`);
  }

  const { error: stageError } = await supabase
    .from("customer_onboarding")
    .update({ current_stage: "install_completed" })
    .eq("id", onboardingId);

  if (stageError) {
    redirect(`/onboarding/${onboardingId}?error=${encodeURIComponent(stageError.message)}`);
  }

  // Same profiles-RLS workaround as resendCustomerInviteEmail: an employee
  // can't read an arbitrary customer's profile row, but the lead record
  // (already RLS-visible) carries the same name/email.
  if (onboarding?.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("full_name, email")
      .eq("id", onboarding.lead_id)
      .single();

    if (lead?.email) {
      await sendInstallCompleteEmail({ to: lead.email, name: lead.full_name });
    }
  }

  revalidatePath(`/onboarding/${onboardingId}`);
  redirect(`/onboarding/${onboardingId}`);
}
