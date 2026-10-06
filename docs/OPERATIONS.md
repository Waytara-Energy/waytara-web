# Operations runbook

Production: **waytaraenergy.com** (customer app, `apps/web`) and **admin.waytaraenergy.com** (staff app, `apps/admin`),
both on Vercel, one Supabase project (schema `waytara`).

## 1. Release order (important)

1. **Database first.** Apply new migrations to production, then deploy the apps that depend on them.
   ```bash
   cd packages/supabase
   npx supabase db push --linked --dry-run   # review exactly what will run
   npx supabase db push --linked
   ```
2. Regenerate types if the schema changed: `pnpm db:types`.
3. Merge to `main` → Vercel deploys both apps.

Every migration must first pass on the production-shaped local database:
`node scripts/local-db.mjs reset && node scripts/test-db.mjs` (CI does this on every PR).

> **Applied to production on 2026-10-04:** `20261003000000_security_hardening`, `…010000_audit_log_append_only`,
> `…020000_performance_data_layer`, `…030000_telemetry_rollups_retention`. A schema+data backup taken immediately
> before is in `D:/Manoj-Waytara/backups/` (outside the repo; contains customer data - keep it private).
> Verified afterwards: anon cannot execute the DB functions, `quotation-pdfs` is private, 5 cron jobs scheduled,
> `equipment_latest` (1,305 rows) and the hourly rollup (390,205 rows) backfilled, no bare `auth.uid()` left in
> policies, `audit_log` has no UPDATE/DELETE for any client role, and the REST API serves the new table and RPCs.

## 2. One-time setup checklist

### Vercel (both projects)
| Variable | web | admin | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔ | ✔ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✔ | ✔ | Server-only. Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | `https://www.waytaraenergy.com` | `https://admin.waytaraenergy.com` | Used for e-mail links. |
| `NEXT_PUBLIC_CANONICAL_URL` | optional | — | Defaults to `https://www.waytaraenergy.com`. |
| `CRON_SECRET` | ✔ | — | **Required in production**: the cron routes now refuse every request without it. Generate: `openssl rand -hex 32`. |
| `CUSTOMER_APP_URL` | — | `https://www.waytaraenergy.com` | |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `LEADS_NOTIFICATION_EMAIL` | ✔ | ✔ | |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | optional | optional | Error monitoring stays completely off until set. |

### Supabase scheduled jobs (pg_cron) — Vault secrets
The migration schedules the jobs, but they do nothing until two Vault secrets exist (run once in the SQL editor;
use the **same** value as `CRON_SECRET` in Vercel):
```sql
select vault.create_secret('https://www.waytaraenergy.com', 'app_base_url');
select vault.create_secret('<the same value as CRON_SECRET>', 'cron_secret');
```
Jobs: `detect-alerts` (15 min), `detect-charging-sessions` (2 min), `rollup-telemetry-hourly` (10 min),
`purge-old-telemetry` (nightly, 90-day raw retention), `purge-rate-limit-events` (hourly).
Check health: `select jobname, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;`
and for the HTTP calls `select * from net._http_response order by created desc limit 20;` (expect 200).

### Supabase Auth (Dashboard → Authentication) — cannot be set by migration
- **Providers → Email:** *Confirm email* ON; minimum password length ≥ 10; require mixed character classes.
- **Attack protection:** enable *Leaked password protection*; keep CAPTCHA off unless abuse appears (sign-ups are invite-only).
- **Sessions:** JWT expiry ≤ 1 hour; enable refresh-token rotation (default) and reuse detection.
- **Rate limits:** keep defaults or lower sign-in / OTP / email limits.
- **URL configuration:** Site URL `https://www.waytaraenergy.com`; redirect allow-list only the two production origins
  (+ `http://localhost:3000/**`, `http://localhost:3001/**` for development).
- **SMTP:** use a custom SMTP sender (Resend) for auth e-mails.
- **Sign-ups:** keep public sign-up disabled (accounts are created from invites).
- **Settings → API:** exposed schemas should be `public, graphql_public, waytara` only.
- **Database → Network restrictions / SSL enforcement:** enforce SSL; restrict direct DB access to known IPs if possible.

### Backups and recovery
- Turn on **Point-in-Time Recovery** (Project Settings → Add-ons) before real customer data arrives.
- Do a restore drill into a scratch project once a quarter and write down how long it took.

### DNS / e-mail deliverability
- SPF, DKIM (from Resend) and a DMARC record (`v=DMARC1; p=quarantine; rua=mailto:hello@waytaraenergy.com`) on `waytaraenergy.com`.
- Verify both domains in Google Search Console and Bing Webmaster Tools; submit `https://www.waytaraenergy.com/sitemap.xml`.

## 3. Monitoring
- **Errors:** Sentry (once `SENTRY_DSN` is set). Server and browser errors plus all error-boundary catches.
- **Traffic and real-user performance:** Vercel Web Analytics (page views, cookie-less) and Speed Insights (Core Web Vitals)
  are installed in both apps. Enable each once per project in the Vercel dashboard (project -> Analytics / Speed Insights -> Enable);
  data appears after the first deployed visits. Neither sets cookies, so no consent banner is required for them; mention them in the privacy policy.
- **Uptime:** point an external monitor at `https://www.waytaraenergy.com/login` and `https://admin.waytaraenergy.com/login`.
- **Database:** Supabase Reports → slow queries; `select * from pg_stat_statements order by total_exec_time desc limit 10;`.

## 4. Telemetry data layer (rollups; no raw rows)
Replaces the old raw-row design (migration `20261006000000_rollup_data_layer.sql`, see `docs/PRODUCTION_READINESS.md`).
- **The equipment agent keeps every reading in local files** and uploads two things: the latest values/heartbeat every
  *upload interval* (chosen when the agent is started) and each finished 15-minute bucket at :00/:15/:30/:45 IST, through
  `ingest_tick(...)`. **No raw reading rows are stored in Supabase.**
- **Tiers:** `equipment_rollup_15m` (daily partitions, kept 8 days), `equipment_rollup_1h` and `equipment_rollup_1d` (kept forever).
  30 min / 1 h / 2 h views are combined from the 15-minute buckets in the browser (rollups hold weighted sums, covered
  seconds, min/max/last, so combining is exact). Late buckets are re-rolled by a watermark job.
- **Size:** per device roughly 96 buckets x metrics per day for 8 days, plus one hourly and one daily row per metric per
  day. 60 devices fits the Free tier comfortably; `select pg_size_pretty(pg_total_relation_size('waytara.equipment_rollup_15m'))` to check.
- **Realtime:** one broadcast per upload on the private channel `device:<equipment_id>` (RLS via `realtime.messages`
  policies); the dashboard closes the channel when the tab is hidden/closed. **Go Live** (Monitoring) streams every
  reading of today from the agent's local files over `live:<equipment_id>` + a private storage snapshot
  (`live-snapshots` bucket), deleted when the last viewer leaves.
- **Ranges:** Today / 7 / 30 / 90 days / custom (up to 30 days from any day since the first reading). The browser cache
  (IndexedDB, per user) and in-flight de-duplication keep repeat queries off the database. Redis is deferred until after hosting.
- **Cutover still pending (needs sign-off):** the old `equipment_telemetry` raw table, `equipment_telemetry_hourly`,
  `telemetry_buckets`, `telemetry_daily`, `purge_old_telemetry` and their cron jobs are unused by the dashboards but not
  yet dropped; `equipment_telemetry` remains only for onboarding test signals.

### Real inverter ingest (measured 2026-10-05) — read this before changing cadence
- One real Deye inverter read by the Python `equipment_agent` produced ~34k rows/hour (~170 MB/day incl. indexes)
  at the initial cadences (live 5 s, mid/energy 30 s). That fills the Supabase **Free** 500 MB limit in ~3 days
  (the project goes read-only above it). Either upgrade to Pro (8 GB) or lower `equipment_metrics.cadence_seconds`
  (suggested: live 15 s, everything else 60 s, energy counters 300 s) and shorten raw retention
  (`purge_old_telemetry(30)`).
- After mass deletes run `VACUUM (FULL, ANALYZE)` on `equipment_telemetry` — plain deletes do not return space
  (529 MB -> 152 MB on 2026-10-05).
- **Register decode formula is `value = raw x scale + offset`** (same in `packages/supabase/scripts/register-codec.mjs`,
  the admin Registers form, and the Python agent's `codec.py`). A Deye temperature in 0.1 C units where raw 1000 = 0 C
  is `scale 0.1, offset -100`; battery temperature (reg 182) is `scale 0.1` only.
- The agent reloads metric edits live only if `equipment_metrics` is in the `supabase_realtime` publication
  (`alter publication supabase_realtime add table waytara.equipment_metrics;`, done in production). A running agent
  must still be **restarted** once to pick up decode fixes made while it was off that publication.
- Real hardware is read only by the Python agent. `deye-modbus-agent.mjs --mode=modbus` is disabled (two writers
  would duplicate readings); its `--mode=simulate` writes fake rows to whatever database `.env.local` points at and
  now requires an explicit `--device-id`.

## 5. Incident cheat-sheet
| Symptom | Check |
|---|---|
| Dashboards show "no data" for every device | Were the migrations applied? Is `equipment_latest` populated (`select count(*) from waytara.equipment_latest`)? |
| Offline alerts / charging sessions not appearing | `cron.job_run_details` and `net._http_response`; is `CRON_SECRET` identical in Vercel and Vault? |
| Lead form returns 429 | `select * from waytara.rate_limit_events order by created_at desc limit 20;` (limits: 5 per IP / 10 min, 300 total / hour) |
| Need to remove a staff member | Admin → Employees → *Revoke access* (bans sign-in; never delete the auth user — profile history depends on it) |
| Suspected leaked service-role key | Rotate in Supabase (Settings → API), update Vercel env on both projects, redeploy, review `waytara.audit_log`. |

## 6. Personal data (India DPDP Act 2023) — inventory
| Data | Where | Retention proposal |
|---|---|---|
| Name, e-mail, phone | `profiles`, `leads` | Life of the account; leads not converted: delete after 24 months |
| Site address / coordinates | `sites`, `customers.address` | Life of the account |
| KYC documents | private bucket `customer-kyc` | Life of the contract + statutory period; delete on request when legally allowed |
| Quotation PDFs (pricing) | private bucket `quotation-pdfs` | 8 years (accounting) |
| Energy telemetry | `equipment_rollup_15m` (8 d), `…_1h` / `…_1d` (kept) | As above |
| Support messages / attachments | `support_*`, private bucket | 3 years after ticket closure |

Needed to be fully compliant (business/legal, not code): a named grievance officer in the privacy policy, a documented
process for access/erasure requests, and a consent notice if analytics or marketing cookies are ever added (none today).
