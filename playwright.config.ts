import { defineConfig, devices } from "@playwright/test";
import { ADMIN_URL, WEB_URL } from "./e2e/support/accounts";
import { readLocalSupabase } from "./e2e/support/local-supabase";

// End-to-end tests run both Next apps in dev mode against the LOCAL Supabase
// stack (never production). Prerequisite:
//   node packages/supabase/scripts/local-db.mjs up
//   pnpm test:e2e
const sb = readLocalSupabase();

const appEnv = {
  NEXT_PUBLIC_SUPABASE_URL: sb.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: sb.anonKey,
  SUPABASE_SERVICE_ROLE_KEY: sb.serviceRoleKey,
  // Emails are not sent in tests.
  RESEND_API_KEY: "",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Locally use the installed Edge so no browser download is needed; CI installs Chromium.
      use: { ...devices["Desktop Chrome"], ...(process.env.CI ? {} : { channel: "msedge" }) },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter waytara-web exec next dev -p 3200",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { ...appEnv, NEXT_PUBLIC_SITE_URL: WEB_URL, NEXT_DIST_DIR: ".next-e2e" },
    },
    {
      command: "pnpm --filter waytara-admin exec next dev -p 3201",
      url: ADMIN_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { ...appEnv, NEXT_PUBLIC_SITE_URL: ADMIN_URL, NEXT_DIST_DIR: ".next-e2e" },
    },
  ],
});
