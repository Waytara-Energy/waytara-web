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

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const users = [
  { name: "Manoj", email: "manojloganathan.dev@gmail.com" },
  { name: "Devaansh", email: "devaansh.pujara@waytaraenergy.com" },
  { name: "Arun", email: "arun.viswanathan@waytaraenergy.com" },
];

const routes = [
  "/dashboard",
  "/dashboard/monitoring",
  "/dashboard/performance",
  "/dashboard/reports",
  "/dashboard/maintenance",
  "/dashboard/site",
  "/dashboard/devices",
  "/dashboard/support",
  "/dashboard/settings",
];

async function run() {
  console.log("Starting Comprehensive Page Load & Latency Benchmark...\n");

  for (const u of users) {
    const { data: link, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: u.email,
    });
    if (linkErr) {
      console.error(`Failed to generate link for ${u.name}:`, linkErr);
      continue;
    }

    const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: authData, error: authErr } = await anonClient.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    });
    if (authErr) {
      console.error(`Failed to verify OTP for ${u.name}:`, authErr);
      continue;
    }

    let cookie = `sb-yxenvzcfypfqzbpfyuiz-auth-token=${encodeURIComponent(JSON.stringify(authData.session))}`;

    console.log("=========================================================================");
    console.log(`USER: ${u.name.toUpperCase()} (${u.email})`);
    console.log("=========================================================================");

    for (const r of routes) {
      const start = performance.now();
      let res;
      let text = "";
      try {
        res = await fetch("http://localhost:3000" + r, {
          headers: {
            Cookie: cookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          },
        });
        text = await res.text();
      } catch (err) {
        console.error(`Fetch error on ${r}:`, err.message);
        continue;
      }

      const duration = (performance.now() - start).toFixed(0);
      const isError =
        res.status !== 200 ||
        text.includes("Application error") ||
        text.includes("Internal Server Error") ||
        text.includes("This app is for customer accounts only");

      const statusTag = isError ? "❌ ERROR" : "✅ OK";
      console.log(
        `${r.padEnd(25)} | Status: ${res.status} | Load Time: ${duration.padStart(5)}ms | Size: ${(text.length / 1024).toFixed(1).padStart(5)} KB | ${statusTag}`
      );

      // Check cookie refresh
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const match = setCookie.match(/sb-yxenvzcfypfqzbpfyuiz-auth-token=([^;]+)/);
        if (match) cookie = `sb-yxenvzcfypfqzbpfyuiz-auth-token=${match[1]}`;
      }
    }
    console.log("");
  }
}

run().catch(console.error);
