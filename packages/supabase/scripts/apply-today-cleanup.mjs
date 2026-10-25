import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve("d:/Manoj-Waytara/Projects/apps/web/.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"];

const waytaraClient = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: "waytara" },
  auth: { autoRefreshToken: false, persistSession: false },
});

const INVERTER_ID = "b4c30eb8-fba4-4487-aa7a-3c1b089e36e2";
const WAYTARA_OFFICE_SITE_ID = "9a3947a4-b37e-471c-b97c-141acedaa96d";
const ARUN_ID = "8fb99338-8ed1-4737-aad2-cf96e5e86308";
const DEVAANSH_ID = "9c8ae2bc-9924-4855-ba65-b99e90210595";

const TODAY_UTC_ISO = "2026-10-24T18:30:00.000Z"; // 2026-10-25 00:00:00 IST
const TODAY_IST_ISO = "2026-10-25T00:00:00.000+05:30";
const TODAY_DATE = "2026-10-25";

async function execute() {
  console.log("=== STEP 1: REMOVING OLD TELEMETRY DATA FOR DEYE INVERTER ===");

  // 1. equipment_rollup_15m
  const { count: count15mBefore } = await waytaraClient
    .from("equipment_rollup_15m")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .lt("bucket", TODAY_UTC_ISO);
  console.log(`Deleting ${count15mBefore} rows from equipment_rollup_15m (< ${TODAY_UTC_ISO})...`);
  const { error: err15m } = await waytaraClient
    .from("equipment_rollup_15m")
    .delete()
    .eq("equipment_id", INVERTER_ID)
    .lt("bucket", TODAY_UTC_ISO);
  if (err15m) console.error("Error deleting 15m rollups:", err15m);
  else console.log("Deleted old 15m rollups successfully.");

  // 2. equipment_rollup_1h
  const { count: count1hBefore } = await waytaraClient
    .from("equipment_rollup_1h")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .lt("hour", TODAY_UTC_ISO);
  console.log(`Deleting ${count1hBefore} rows from equipment_rollup_1h (< ${TODAY_UTC_ISO})...`);
  const { error: err1h } = await waytaraClient
    .from("equipment_rollup_1h")
    .delete()
    .eq("equipment_id", INVERTER_ID)
    .lt("hour", TODAY_UTC_ISO);
  if (err1h) console.error("Error deleting 1h rollups:", err1h);
  else console.log("Deleted old 1h rollups successfully.");

  // 3. equipment_rollup_1d
  const { count: count1dBefore } = await waytaraClient
    .from("equipment_rollup_1d")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .lt("day", TODAY_DATE);
  console.log(`Deleting ${count1dBefore} rows from equipment_rollup_1d (< ${TODAY_DATE})...`);
  const { error: err1d } = await waytaraClient
    .from("equipment_rollup_1d")
    .delete()
    .eq("equipment_id", INVERTER_ID)
    .lt("day", TODAY_DATE);
  if (err1d) console.error("Error deleting 1d rollups:", err1d);
  else console.log("Deleted old 1d rollups successfully.");

  // 4. alerts
  const { count: countAlertsBefore } = await waytaraClient
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("device_id", INVERTER_ID)
    .lt("ts", TODAY_UTC_ISO);
  console.log(`Deleting ${countAlertsBefore} rows from alerts (< ${TODAY_UTC_ISO})...`);
  const { error: errAlerts } = await waytaraClient
    .from("alerts")
    .delete()
    .eq("device_id", INVERTER_ID)
    .lt("ts", TODAY_UTC_ISO);
  if (errAlerts) console.error("Error deleting alerts:", errAlerts);
  else console.log("Deleted old alerts successfully.");

  // 5. device_activity_log
  const { count: countActivityBefore } = await waytaraClient
    .from("device_activity_log")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .lt("at", TODAY_UTC_ISO);
  console.log(`Deleting ${countActivityBefore} rows from device_activity_log (< ${TODAY_UTC_ISO})...`);
  const { error: errActivity } = await waytaraClient
    .from("device_activity_log")
    .delete()
    .eq("equipment_id", INVERTER_ID)
    .lt("at", TODAY_UTC_ISO);
  if (errActivity) console.error("Error deleting activity log:", errActivity);
  else console.log("Deleted old device activity log successfully.");

  // 6. maintenance_tickets
  const { error: errTickets } = await waytaraClient
    .from("maintenance_tickets")
    .delete()
    .eq("device_id", INVERTER_ID)
    .lt("created_at", TODAY_UTC_ISO);
  if (errTickets) console.error("Error deleting old maintenance tickets:", errTickets);
  else console.log("Deleted old maintenance tickets successfully.");

  console.log("\n=== STEP 2: UPDATING ONBOARDING & TIMESTAMPS FOR ARUN & DEVAANSH ===");

  // 1. Profiles
  const { error: errProfiles } = await waytaraClient
    .from("profiles")
    .update({ created_at: TODAY_IST_ISO })
    .in("id", [ARUN_ID, DEVAANSH_ID]);
  if (errProfiles) console.error("Error updating profiles:", errProfiles);
  else console.log("Updated profiles created_at to today.");

  // 2. Customers
  const { error: errCustomers } = await waytaraClient
    .from("customers")
    .update({
      created_at: TODAY_IST_ISO,
      plan_started_at: TODAY_IST_ISO,
    })
    .in("id", [ARUN_ID, DEVAANSH_ID]);
  if (errCustomers) console.error("Error updating customers:", errCustomers);
  else console.log("Updated customers created_at and plan_started_at to today.");

  // 3. Site Members
  const { error: errMembers } = await waytaraClient
    .from("site_members")
    .update({ created_at: TODAY_IST_ISO })
    .in("user_id", [ARUN_ID, DEVAANSH_ID]);
  if (errMembers) console.error("Error updating site_members:", errMembers);
  else console.log("Updated site_members created_at to today.");

  // 4. Sites (Waytara Office)
  const { error: errSite } = await waytaraClient
    .from("sites")
    .update({ created_at: TODAY_IST_ISO })
    .eq("id", WAYTARA_OFFICE_SITE_ID);
  if (errSite) console.error("Error updating sites:", errSite);
  else console.log("Updated Waytara Office site created_at to today.");

  // 5. Equipment on Waytara Office
  const { error: errEquip } = await waytaraClient
    .from("equipment")
    .update({
      installed_at: TODAY_IST_ISO,
      warranty_start_date: TODAY_DATE,
      created_at: TODAY_IST_ISO,
      updated_at: TODAY_IST_ISO,
    })
    .eq("site_id", WAYTARA_OFFICE_SITE_ID);
  if (errEquip) console.error("Error updating equipment:", errEquip);
  else console.log("Updated Waytara Office equipment installed_at and warranty_start_date to today.");

  // 6. Leads and Customer Onboarding
  console.log("\nEnsuring leads and customer_onboarding entries exist for Arun and Devaansh...");

  // Check if leads exist
  const users = [
    {
      id: DEVAANSH_ID,
      full_name: "Devaansh Pujara",
      email: "devaansh.pujara@waytaraenergy.com",
      phone: "9360404812",
    },
    {
      id: ARUN_ID,
      full_name: "Arun Viswanathan",
      email: "arun.viswanathan@waytaraenergy.com",
      phone: "9360404812",
    },
  ];

  for (const user of users) {
    let leadId;
    const { data: existingLeads } = await waytaraClient
      .from("leads")
      .select("id")
      .eq("email", user.email);

    if (existingLeads && existingLeads.length > 0) {
      leadId = existingLeads[0].id;
      await waytaraClient
        .from("leads")
        .update({
          status: "converted",
          created_at: TODAY_IST_ISO,
          updated_at: TODAY_IST_ISO,
          accepted_at: TODAY_IST_ISO,
        })
        .eq("id", leadId);
      console.log(`Updated existing lead ${leadId} for ${user.email}`);
    } else {
      const { data: newLead, error: leadErr } = await waytaraClient
        .from("leads")
        .insert({
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          status: "converted",
          created_at: TODAY_IST_ISO,
          updated_at: TODAY_IST_ISO,
          accepted_at: TODAY_IST_ISO,
        })
        .select()
        .single();
      if (leadErr) {
        console.error(`Error inserting lead for ${user.email}:`, leadErr);
        continue;
      }
      leadId = newLead.id;
      console.log(`Created new lead ${leadId} for ${user.email}`);
    }

    // Check onboarding
    const { data: existingOnboarding } = await waytaraClient
      .from("customer_onboarding")
      .select("id")
      .eq("customer_id", user.id);

    if (existingOnboarding && existingOnboarding.length > 0) {
      await waytaraClient
        .from("customer_onboarding")
        .update({
          lead_id: leadId,
          current_stage: "install_completed",
          install_scheduled_at: TODAY_IST_ISO,
          created_at: TODAY_IST_ISO,
          updated_at: TODAY_IST_ISO,
        })
        .eq("id", existingOnboarding[0].id);
      console.log(`Updated customer_onboarding for ${user.full_name}`);
    } else {
      const { data: newOnb, error: onbErr } = await waytaraClient
        .from("customer_onboarding")
        .insert({
          customer_id: user.id,
          lead_id: leadId,
          current_stage: "install_completed",
          install_scheduled_at: TODAY_IST_ISO,
          created_at: TODAY_IST_ISO,
          updated_at: TODAY_IST_ISO,
        })
        .select()
        .single();
      if (onbErr) console.error(`Error inserting onboarding for ${user.full_name}:`, onbErr);
      else console.log(`Created customer_onboarding ${newOnb.id} for ${user.full_name}`);
    }
  }

  console.log("\n=== STEP 3: VERIFICATION ===");
  const { count: remaining15m } = await waytaraClient
    .from("equipment_rollup_15m")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID);

  const { count: remaining1h } = await waytaraClient
    .from("equipment_rollup_1h")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID);

  const { count: remaining1d } = await waytaraClient
    .from("equipment_rollup_1d")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID);

  const { data: remainingDates1d } = await waytaraClient
    .from("equipment_rollup_1d")
    .select("day")
    .eq("equipment_id", INVERTER_ID);

  const days = [...new Set(remainingDates1d?.map((r) => r.day))];

  console.log("Remaining Telemetry Summary for Deye Inverter:");
  console.log({
    equipment_rollup_15m: remaining15m,
    equipment_rollup_1h: remaining1h,
    equipment_rollup_1d: remaining1d,
    distinct_1d_days: days,
  });

  const { data: verifyProfiles } = await waytaraClient
    .from("profiles")
    .select("id, full_name, email, created_at")
    .in("id", [ARUN_ID, DEVAANSH_ID]);
  console.log("\nProfiles:", verifyProfiles);

  const { data: verifyCustomers } = await waytaraClient
    .from("customers")
    .select("id, status, plan_started_at, created_at")
    .in("id", [ARUN_ID, DEVAANSH_ID]);
  console.log("Customers:", verifyCustomers);

  const { data: verifyOnboarding } = await waytaraClient
    .from("customer_onboarding")
    .select("id, customer_id, current_stage, install_scheduled_at, created_at, updated_at")
    .in("customer_id", [ARUN_ID, DEVAANSH_ID]);
  console.log("Onboarding:", verifyOnboarding);

  const { data: verifySite } = await waytaraClient
    .from("sites")
    .select("id, name, created_at")
    .eq("id", WAYTARA_OFFICE_SITE_ID);
  console.log("Waytara Office Site:", verifySite);

  const { data: verifyEquip } = await waytaraClient
    .from("equipment")
    .select("id, label, installed_at, warranty_start_date, created_at")
    .eq("site_id", WAYTARA_OFFICE_SITE_ID);
  console.log("Waytara Office Equipment:", verifyEquip);
}

execute().catch(console.error);
