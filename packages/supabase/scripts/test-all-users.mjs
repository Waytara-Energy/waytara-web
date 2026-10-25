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

class SimpleCookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromHeader(rawCookies) {
    if (!rawCookies) return;
    const cookieStrings = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    for (const cStr of cookieStrings) {
      if (!cStr) continue;
      const parts = cStr.split(";")[0].trim();
      const eqIdx = parts.indexOf("=");
      if (eqIdx !== -1) {
        const name = parts.substring(0, eqIdx).trim();
        const value = parts.substring(eqIdx + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }

  toHeader() {
    const list = [];
    for (const [k, v] of this.cookies.entries()) {
      list.push(`${k}=${v}`);
    }
    return list.join("; ");
  }
}

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

async function testUser(email, name) {
  console.log(`\n======================================================`);
  console.log(`TESTING USER: ${name} (${email})`);
  console.log(`======================================================`);

  const { data: link, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: email,
  });
  if (linkErr) {
    console.error(`Link error for ${name}:`, linkErr);
    return;
  }

  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: authData, error: authErr } = await anonClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (authErr) {
    console.error(`Auth error for ${name}:`, authErr);
    return;
  }

  const jar = new SimpleCookieJar();
  const subDomain = env.NEXT_PUBLIC_SUPABASE_URL.split(".")[0].replace("https://", "");
  const sessionStr = JSON.stringify(authData.session);
  const cookieVal = "base64-" + Buffer.from(sessionStr).toString("base64");
  jar.cookies.set(`sb-${subDomain}-auth-token`, cookieVal);

  for (const r of routes) {
    const start = performance.now();
    try {
      const res = await fetch("http://localhost:3000" + r, {
        headers: {
          Cookie: jar.toHeader(),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        },
        redirect: "manual",
      });

      const dur = (performance.now() - start).toFixed(0);
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
      jar.setFromHeader(setCookies);

      const loc = res.headers.get("location");
      const isRedir = res.status >= 300 && res.status < 400;

      if (isRedir) {
        console.log(`${r.padEnd(25)} | ⚠️ REDIRECT ${res.status} -> ${loc} (${dur}ms)`);
      } else {
        const text = await res.text();
        const kb = (text.length / 1024).toFixed(1);
        const hasError = text.includes("Application error") || text.includes("Internal Server Error");
        console.log(`${r.padEnd(25)} | Status ${res.status} | Size: ${kb.padStart(5)} KB | ${dur.padStart(5)}ms | ${hasError ? "❌ ERROR" : "✅ OK"}`);
      }
    } catch (err) {
      console.error(`${r.padEnd(25)} | 💥 FETCH ERROR: ${err.message}`);
    }
  }
}

async function run() {
  await testUser("devaansh.pujara@waytaraenergy.com", "Devaansh");
  await testUser("arun.viswanathan@waytaraenergy.com", "Arun");
  await testUser("manojloganathan.dev@gmail.com", "Manoj");
}

run().catch(console.error);
