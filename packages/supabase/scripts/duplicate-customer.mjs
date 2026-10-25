import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

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

console.log("Connecting to Supabase at:", supabaseUrl);
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: "waytara" },
  auth: { autoRefreshToken: false, persistSession: false },
});

const MANOJ_ID = "7b3abc68-c970-49d7-86b9-5650e79da3e5";
const MANOJ_EMAIL = "manojloganathan.dev@gmail.com";
const DEVAANSH_ID = "9c8ae2bc-9924-4855-ba65-b99e90210595";
const DEVAANSH_EMAIL = "devaansh.pujara@waytaraenergy.com";

async function duplicateCustomer() {
  console.log("==================================================");
  console.log("Starting Customer Duplication & Role Configuration");
  console.log("==================================================");

  // 1. Update Manoj's role in waytara.profiles to 'customer'
  console.log("\n[Step 1] Updating Manoj's profile role to 'customer'...");
  const { data: updatedManoj, error: manojErr } = await supabase
    .from("profiles")
    .update({ role: "customer" })
    .eq("id", MANOJ_ID)
    .select("id, email, full_name, role");

  if (manojErr) {
    console.error("Error updating Manoj role:", manojErr);
    process.exit(1);
  }
  console.log("✓ Manoj profile updated:", updatedManoj);

  // 2. Fetch Manoj's profile and customer data to copy
  console.log("\n[Step 2] Fetching source data from Manoj...");
  const { data: manojProfile, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", MANOJ_ID)
    .single();
  if (pErr) throw pErr;

  const { data: manojCustomer, error: cErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", MANOJ_ID)
    .single();
  if (cErr) throw cErr;

  // 3. Create or update Devaansh's profile in waytara.profiles
  console.log("\n[Step 3] Creating Devaansh profile in waytara.profiles...");
  const devaanshProfilePayload = {
    id: DEVAANSH_ID,
    role: "customer",
    email: DEVAANSH_EMAIL,
    full_name: "Devaansh Pujara",
    phone: manojProfile.phone ?? "9360404812",
    avatar_url: null,
    notification_preferences: manojProfile.notification_preferences,
    ui_preferences: manojProfile.ui_preferences,
    security_preferences: manojProfile.security_preferences,
    deactivated_at: null,
    deleted_at: null,
  };

  const { data: dProfile, error: dPErr } = await supabase
    .from("profiles")
    .upsert(devaanshProfilePayload, { onConflict: "id" })
    .select("*");
  if (dPErr) {
    console.error("Error creating Devaansh profile:", dPErr);
    process.exit(1);
  }
  console.log("✓ Devaansh profile created/updated:", dProfile[0]?.email);

  // 4. Create or update Devaansh in waytara.customers
  console.log("\n[Step 4] Creating Devaansh customer in waytara.customers...");
  const devaanshCustomerPayload = {
    id: DEVAANSH_ID,
    address: manojCustomer.address,
    billing_email: DEVAANSH_EMAIL,
    plan_id: manojCustomer.plan_id,
    status: "active",
    plan_started_at: manojCustomer.plan_started_at ?? new Date().toISOString(),
    tariff_rate_per_kwh: manojCustomer.tariff_rate_per_kwh ?? 8.0,
    billing_address: manojCustomer.billing_address,
    gstin: manojCustomer.gstin,
  };

  const { data: dCustomer, error: dCErr } = await supabase
    .from("customers")
    .upsert(devaanshCustomerPayload, { onConflict: "id" })
    .select("*");
  if (dCErr) {
    console.error("Error creating Devaansh customer:", dCErr);
    process.exit(1);
  }
  console.log("✓ Devaansh customer created/updated:", dCustomer[0]?.billing_email);

  // 5. Fetch Manoj's sites
  console.log("\n[Step 5] Duplicating Sites...");
  const { data: manojSites, error: sErr } = await supabase
    .from("sites")
    .select("*")
    .eq("customer_id", MANOJ_ID)
    .order("created_at", { ascending: true });
  if (sErr) throw sErr;

  console.log(`Found ${manojSites.length} site(s) for Manoj.`);

  const siteMap = new Map(); // old_site_id -> new_site_id

  for (const site of manojSites) {
    const newSiteId = randomUUID();
    siteMap.set(site.id, newSiteId);

    const sitePayload = {
      id: newSiteId,
      customer_id: DEVAANSH_ID,
      name: site.name,
      property_type: site.property_type,
      power_source_category: site.power_source_category,
      address: site.address,
      power_package: site.power_package,
      latitude: site.latitude,
      longitude: site.longitude,
      customer_hidden_at: site.customer_hidden_at,
    };

    const { error: insSiteErr } = await supabase.from("sites").insert(sitePayload);
    if (insSiteErr) {
      console.error(`Error inserting site "${site.name}":`, insSiteErr);
      process.exit(1);
    }
    console.log(`  ✓ Site "${site.name}" duplicated (${site.id} -> ${newSiteId})`);
  }

  // 6. Fetch and duplicate equipment
  console.log("\n[Step 6] Duplicating Equipment...");
  const manojSiteIds = manojSites.map((s) => s.id);
  const { data: manojEquipment, error: eErr } = await supabase
    .from("equipment")
    .select("*")
    .in("site_id", manojSiteIds);
  if (eErr) throw eErr;

  console.log(`Found ${manojEquipment.length} equipment item(s).`);

  const equipMap = new Map(); // old_equipment_id -> new_equipment_id

  // 6a. Parent equipment first (parent_id is null)
  const parents = manojEquipment.filter((e) => !e.parent_id);
  for (const eq of parents) {
    const newEquipId = randomUUID();
    equipMap.set(eq.id, newEquipId);

    const equipPayload = {
      id: newEquipId,
      site_id: siteMap.get(eq.site_id),
      stock_id: eq.stock_id,
      label: eq.label,
      device_status: eq.device_status,
      installed_at: eq.installed_at,
      installation_id: null,
      warranty_start_date: eq.warranty_start_date,
      warranty_end_date: eq.warranty_end_date,
      service_id: eq.service_id,
      parent_id: null,
      quantity: eq.quantity,
      retired_at: eq.retired_at,
      discharged_baseline_kwh: eq.discharged_baseline_kwh,
    };

    const { error: insEqErr } = await supabase.from("equipment").insert(equipPayload);
    if (insEqErr) {
      console.error(`Error inserting parent equipment "${eq.label}":`, insEqErr);
      process.exit(1);
    }
    console.log(`  ✓ Parent equipment "${eq.label}" duplicated (${eq.id} -> ${newEquipId})`);
  }

  // 6b. Child equipment second (parent_id is not null)
  const children = manojEquipment.filter((e) => e.parent_id);
  for (const eq of children) {
    const newEquipId = randomUUID();
    equipMap.set(eq.id, newEquipId);

    const equipPayload = {
      id: newEquipId,
      site_id: siteMap.get(eq.site_id),
      stock_id: eq.stock_id,
      label: eq.label,
      device_status: eq.device_status,
      installed_at: eq.installed_at,
      installation_id: null,
      warranty_start_date: eq.warranty_start_date,
      warranty_end_date: eq.warranty_end_date,
      service_id: eq.service_id,
      parent_id: equipMap.get(eq.parent_id) ?? null,
      quantity: eq.quantity,
      retired_at: eq.retired_at,
      discharged_baseline_kwh: eq.discharged_baseline_kwh,
    };

    const { error: insEqErr } = await supabase.from("equipment").insert(equipPayload);
    if (insEqErr) {
      console.error(`Error inserting child equipment "${eq.label}":`, insEqErr);
      process.exit(1);
    }
    console.log(`  ✓ Child equipment "${eq.label}" duplicated (${eq.id} -> ${newEquipId})`);
  }

  // 7. Duplicate equipment_metrics
  console.log("\n[Step 7] Duplicating Equipment Metrics...");
  const oldEquipIds = Array.from(equipMap.keys());
  let totalMetrics = 0;

  for (const oldId of oldEquipIds) {
    const newId = equipMap.get(oldId);
    const { data: metrics, error: mErr } = await supabase
      .from("equipment_metrics")
      .select("*")
      .eq("equipment_id", oldId);
    if (mErr) throw mErr;

    if (metrics && metrics.length > 0) {
      // Chunk in groups of 100
      for (let i = 0; i < metrics.length; i += 100) {
        const chunk = metrics.slice(i, i + 100).map((m) => ({
          ...m,
          id: randomUUID(),
          equipment_id: newId,
        }));
        const { error: insMErr } = await supabase.from("equipment_metrics").insert(chunk);
        if (insMErr) {
          console.error(`Error duplicating metrics for equipment ${newId}:`, insMErr);
          process.exit(1);
        }
      }
      totalMetrics += metrics.length;
    }
  }
  console.log(`✓ Duplicated ${totalMetrics} equipment_metrics records.`);

  // 8. Duplicate equipment_configs
  console.log("\n[Step 8] Duplicating Equipment Configs (Settings)...");
  let totalConfigs = 0;

  for (const oldId of oldEquipIds) {
    const newId = equipMap.get(oldId);
    const { data: configs, error: cfgErr } = await supabase
      .from("equipment_configs")
      .select("*")
      .eq("equipment_id", oldId);
    if (cfgErr) throw cfgErr;

    if (configs && configs.length > 0) {
      for (let i = 0; i < configs.length; i += 100) {
        const chunk = configs.slice(i, i + 100).map((c) => {
          const { id: _, ...rest } = c; // omit auto-generated identity id
          return {
            ...rest,
            equipment_id: newId,
          };
        });
        const { error: insCfgErr } = await supabase.from("equipment_configs").insert(chunk);
        if (insCfgErr) {
          console.error(`Error duplicating configs for equipment ${newId}:`, insCfgErr);
          process.exit(1);
        }
      }
      totalConfigs += configs.length;
    }
  }
  console.log(`✓ Duplicated ${totalConfigs} equipment_configs records.`);

  // 9. Duplicate equipment_heartbeat and equipment_latest
  console.log("\n[Step 9] Duplicating Equipment Heartbeat and Latest Metrics...");
  const { data: heartbeats } = await supabase
    .from("equipment_heartbeat")
    .select("*")
    .in("equipment_id", oldEquipIds);

  if (heartbeats && heartbeats.length > 0) {
    const newHeartbeats = heartbeats.map((h) => ({
      ...h,
      equipment_id: equipMap.get(h.equipment_id),
    }));
    const { error: hbErr } = await supabase.from("equipment_heartbeat").upsert(newHeartbeats);
    if (hbErr) console.warn("Notice: heartbeat upsert error:", hbErr.message);
    else console.log(`✓ Duplicated ${newHeartbeats.length} heartbeat records.`);
  }

  const { data: latestRows } = await supabase
    .from("equipment_latest")
    .select("*")
    .in("equipment_id", oldEquipIds);

  if (latestRows && latestRows.length > 0) {
    for (let i = 0; i < latestRows.length; i += 100) {
      const chunk = latestRows.slice(i, i + 100).map((l) => ({
        ...l,
        equipment_id: equipMap.get(l.equipment_id),
      }));
      const { error: ltErr } = await supabase.from("equipment_latest").upsert(chunk);
      if (ltErr) console.warn("Notice: equipment_latest upsert error:", ltErr.message);
    }
    console.log(`✓ Duplicated ${latestRows.length} equipment_latest records.`);
  }

  // 10. Duplicate alert_rules
  console.log("\n[Step 10] Duplicating Alert Rules...");
  const { data: alertRules, error: arErr } = await supabase
    .from("alert_rules")
    .select("*")
    .eq("customer_id", MANOJ_ID);
  if (arErr) throw arErr;

  if (alertRules && alertRules.length > 0) {
    const newRules = alertRules.map((r) => ({
      ...r,
      id: randomUUID(),
      customer_id: DEVAANSH_ID,
      site_id: r.site_id ? (siteMap.get(r.site_id) ?? null) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: insArErr } = await supabase.from("alert_rules").insert(newRules);
    if (insArErr) {
      console.error("Error duplicating alert rules:", insArErr);
      process.exit(1);
    }
    console.log(`✓ Duplicated ${newRules.length} alert rules.`);
  }

  // 11. Duplicate ev_sessions
  console.log("\n[Step 11] Duplicating EV Sessions...");
  const { data: evSessions, error: evErr } = await supabase
    .from("ev_sessions")
    .select("*")
    .in("equipment_id", oldEquipIds);
  if (evErr) throw evErr;

  if (evSessions && evSessions.length > 0) {
    const newSessions = evSessions.map((s) => ({
      ...s,
      id: randomUUID(),
      equipment_id: equipMap.get(s.equipment_id),
      created_at: new Date().toISOString(),
    }));

    const { error: insEvErr } = await supabase.from("ev_sessions").insert(newSessions);
    if (insEvErr) {
      console.warn("Notice: EV sessions copy error:", insEvErr.message);
    } else {
      console.log(`✓ Duplicated ${newSessions.length} EV session records.`);
    }
  }

  console.log("\n==================================================");
  console.log("Customer Duplication Completed Successfully!");
  console.log(`Manoj (${MANOJ_EMAIL}) role: 'customer'`);
  console.log(`Devaansh (${DEVAANSH_EMAIL}) role: 'customer' (UUID: ${DEVAANSH_ID})`);
  console.log(`Sites duplicated: ${siteMap.size}`);
  console.log(`Equipment duplicated: ${equipMap.size}`);
  console.log("==================================================");
}

duplicateCustomer().catch((err) => {
  console.error("Fatal error during duplication:", err);
  process.exit(1);
});
