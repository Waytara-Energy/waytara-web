import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../../apps/web/.env.local");
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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: "waytara" },
  auth: { autoRefreshToken: false, persistSession: false },
});

const MANOJ_ID = "7b3abc68-c970-49d7-86b9-5650e79da3e5";
const DEVAANSH_ID = "9c8ae2bc-9924-4855-ba65-b99e90210595";
const WAYTARA_OFFICE_SITE_ID = "9a3947a4-b37e-471c-b97c-141acedaa96d";

async function configureSiteAccess() {
  console.log("==================================================");
  console.log("Configuring Site Access for Devaansh and Manoj");
  console.log("==================================================");

  // 1. Identify and remove the 7 cloned duplicate sites created for Devaansh
  console.log("\n[Step 1] Cleaning up duplicated sites created for Devaansh...");
  const { data: clonedSites, error: sErr } = await supabase
    .from("sites")
    .select("id, name")
    .eq("customer_id", DEVAANSH_ID);
  if (sErr) throw sErr;

  console.log(`Found ${clonedSites.length} cloned site(s) for Devaansh.`);
  for (const cs of clonedSites) {
    // Delete equipment under this cloned site
    const { data: cEquip } = await supabase.from("equipment").select("id").eq("site_id", cs.id);
    if (cEquip && cEquip.length > 0) {
      const equipIds = cEquip.map((e) => e.id);
      await supabase.from("equipment_latest").delete().in("equipment_id", equipIds);
      await supabase.from("equipment_heartbeat").delete().in("equipment_id", equipIds);
      await supabase.from("equipment_configs").delete().in("equipment_id", equipIds);
      await supabase.from("equipment_metrics").delete().in("equipment_id", equipIds);
      await supabase.from("ev_sessions").delete().in("equipment_id", equipIds);
      await supabase.from("equipment").delete().in("id", equipIds);
    }
    await supabase.from("alert_rules").delete().eq("customer_id", DEVAANSH_ID);
    await supabase.from("sites").delete().eq("id", cs.id);
    console.log(`  ✓ Deleted cloned site "${cs.name}" (${cs.id}) and all its child records.`);
  }

  // 2. Assign the REAL "Waytara Office" site to Devaansh
  console.log(`\n[Step 2] Assigning real Waytara Office site (${WAYTARA_OFFICE_SITE_ID}) to Devaansh...`);
  const { data: updatedSite, error: uErr } = await supabase
    .from("sites")
    .update({ customer_id: DEVAANSH_ID })
    .eq("id", WAYTARA_OFFICE_SITE_ID)
    .select("id, name, customer_id");

  if (uErr) {
    console.error("Error transferring Waytara Office site:", uErr);
    process.exit(1);
  }
  console.log("✓ Waytara Office site transferred to Devaansh:", updatedSite);

  // Also point any alert rules for Waytara Office to Devaansh if needed, or keep for both
  const { data: officeEquip } = await supabase
    .from("equipment")
    .select("id, label, device_status")
    .eq("site_id", WAYTARA_OFFICE_SITE_ID);
  console.log(`✓ Real devices now under Devaansh's Waytara Office:`, officeEquip);

  // 3. Update Manoj's role in waytara.profiles to 'admin'
  console.log("\n[Step 3] Setting Manoj's profile role to 'admin' for full platform access...");
  const { data: updatedManoj, error: mErr } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", MANOJ_ID)
    .select("id, email, full_name, role");

  if (mErr) {
    console.error("Error setting Manoj role to admin:", mErr);
    process.exit(1);
  }
  console.log("✓ Manoj profile updated:", updatedManoj);

  // 4. Verify what Devaansh sees
  console.log("\n[Step 4] Verifying Devaansh's sites and devices...");
  const { data: dSites } = await supabase.from("sites").select("id, name").eq("customer_id", DEVAANSH_ID);
  console.log("Devaansh owned sites (should be Waytara Office alone):", dSites);

  // 5. Verify what Manoj owns directly
  console.log("\n[Step 5] Verifying Manoj's directly owned sites...");
  const { data: mSites } = await supabase.from("sites").select("id, name").eq("customer_id", MANOJ_ID);
  console.log(`Manoj directly owned sites (${mSites.length}):`, mSites.map((s) => s.name));

  console.log("\n==================================================");
  console.log("Configuration Complete!");
  console.log("- Devaansh: Full access to 'Waytara Office' site alone (with real live inverter & EV)");
  console.log("- Manoj: Full admin access to ALL sites & devices across the platform");
  console.log("==================================================");
}

configureSiteAccess().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
