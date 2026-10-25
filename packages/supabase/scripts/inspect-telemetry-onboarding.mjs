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

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const waytaraClient = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: "waytara" },
  auth: { autoRefreshToken: false, persistSession: false },
});

const INVERTER_ID = "b4c30eb8-fba4-4487-aa7a-3c1b089e36e2";
const WAYTARA_OFFICE_SITE_ID = "9a3947a4-b37e-471c-b97c-141acedaa96d";
const ARUN_ID = "8fb99338-8ed1-4737-aad2-cf96e5e86308";
const DEVAANSH_ID = "9c8ae2bc-9924-4855-ba65-b99e90210595";
const MANOJ_ID = "7b3abc68-c970-49d7-86b9-5650e79da3e5";

async function inspect() {
  console.log("=== CHECKING TELEMETRY TABLES FOR INVERTER ===");
  // Check rollups before vs after 2026-10-24 18:30:00 UTC (2026-10-25 00:00:00 IST)
  const todayUtcIso = "2026-10-24T18:30:00.000Z";
  const todayDate = "2026-10-25";

  const { count: count15mBefore } = await waytaraClient
    .from("equipment_rollup_15m")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .lt("bucket", todayUtcIso);

  const { count: count15mToday } = await waytaraClient
    .from("equipment_rollup_15m")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .gte("bucket", todayUtcIso);

  const { count: count1hBefore } = await waytaraClient
    .from("equipment_rollup_1h")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .lt("hour", todayUtcIso);

  const { count: count1hToday } = await waytaraClient
    .from("equipment_rollup_1h")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .gte("hour", todayUtcIso);

  const { count: count1dBefore } = await waytaraClient
    .from("equipment_rollup_1d")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .lt("day", todayDate);

  const { count: count1dToday } = await waytaraClient
    .from("equipment_rollup_1d")
    .select("*", { count: "exact", head: true })
    .eq("equipment_id", INVERTER_ID)
    .gte("day", todayDate);

  const { count: countAlertsBefore } = await waytaraClient
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("device_id", INVERTER_ID)
    .lt("ts", todayUtcIso);

  const { count: countAlertsToday } = await waytaraClient
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("device_id", INVERTER_ID)
    .gte("ts", todayUtcIso);

  console.log({
    equipment_rollup_15m: { beforeToday: count15mBefore, today: count15mToday },
    equipment_rollup_1h: { beforeToday: count1hBefore, today: count1hToday },
    equipment_rollup_1d: { beforeToday: count1dBefore, today: count1dToday },
    alerts: { beforeToday: countAlertsBefore, today: countAlertsToday },
  });

  // Check 1d records for today to inspect values
  const { data: records1dToday } = await waytaraClient
    .from("equipment_rollup_1d")
    .select("metric_key, day, count, sum, min, max")
    .eq("equipment_id", INVERTER_ID)
    .gte("day", todayDate)
    .limit(5);
  console.log("Sample 1d today records:", records1dToday);

  console.log("\n=== CHECKING USERS: ARUN & DEVAANSH ===");
  const { data: profiles } = await waytaraClient
    .from("profiles")
    .select("*")
    .in("id", [ARUN_ID, DEVAANSH_ID, MANOJ_ID]);
  console.log("Profiles:", profiles);

  const { data: customers } = await waytaraClient
    .from("customers")
    .select("*")
    .in("id", [ARUN_ID, DEVAANSH_ID, MANOJ_ID]);
  console.log("Customers:", customers);

  const { data: siteMembers } = await waytaraClient
    .from("site_members")
    .select("*")
    .in("user_id", [ARUN_ID, DEVAANSH_ID, MANOJ_ID]);
  console.log("Site Members:", siteMembers);

  const { data: customerOnboarding } = await waytaraClient
    .from("customer_onboarding")
    .select("*")
    .in("customer_id", [ARUN_ID, DEVAANSH_ID, MANOJ_ID]);
  console.log("Customer Onboarding:", customerOnboarding);

  const { data: leads } = await waytaraClient
    .from("leads")
    .select("*")
    .in("email", [
      "arun.viswanathan@waytaraenergy.com",
      "devaansh.pujara@waytaraenergy.com",
      "manojloganathan.dev@gmail.com",
    ]);
  console.log("Leads:", leads);

  const { data: sites } = await waytaraClient
    .from("sites")
    .select("*")
    .eq("id", WAYTARA_OFFICE_SITE_ID);
  console.log("Waytara Office Site:", sites);

  const { data: equipment } = await waytaraClient
    .from("equipment")
    .select("id, site_id, device_type, model_number, installed_at, warranty_start_date, created_at, customer_hidden_at")
    .eq("site_id", WAYTARA_OFFICE_SITE_ID);
  console.log("Waytara Office Equipment:", equipment);
}

inspect().catch(console.error);
