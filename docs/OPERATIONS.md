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
- **Cutover done 2026-10-07** (`20261007000000_retire_raw_telemetry.sql`): dropped `equipment_telemetry_hourly`,
  `telemetry_buckets`, `telemetry_daily`, `purge_old_telemetry`, `rollup_telemetry_hourly` and the `purge-old-telemetry` /
  `rollup-telemetry-hourly` cron jobs, and deleted every real row of `equipment_telemetry` (database 368 MB -> 26 MB after
  `VACUUM FULL`). The table remains only for the admin onboarding connection test (`is_test` rows, realtime INSERTs).
  Before the delete, the last raw readings (6 Oct 13:00-15:07) were folded into the rollups with `backfill_rollup_15m`.
  A CSV export of the raw 5 Oct readings is in `D:\Manoj-Waytara\Documents\equipment_telemetry_rows.csv`.
  Do not write real readings to `equipment_telemetry` again (the `ev-charger-backfill.mjs` / `deye-modbus-agent.mjs --mode=simulate`
  scripts still do; run them only against a throwaway database).

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

### Device alerts and e-mails (detect-alerts, every 5 minutes)
The cron route opens an **alert** (bell and Recent Alerts) and **e-mails the customer through Resend** when a device
goes offline, reports a fault (`fault_message_N`) or an alarm (`alarm_status_N`), and again (briefly) when it clears.
- *Offline* = the agent says the device does not answer (`equipment_heartbeat.device_online = false`, with the agent's
  reason in `device_error`), or the agent itself has been silent for three upload intervals (at least 10 minutes) - the
  unit lost power or internet. The two read differently in the alert and the e-mail. Devices with no heartbeat are judged
  slowly (6 h) and are **not** e-mailed.
- One open alert (`resolved_at is null`) per device and kind: the first e-mail goes out when it opens, not on every run.
- **Reminders:** a critical alert (offline, a serious fault) that is still open and **not acknowledged** is e-mailed again
  every 3 hours (`alerts.last_notified_at`, `notified_count`). Pressing *Acknowledge* in the dashboard stops the reminders
  but leaves the alert open, so it is not raised a second time; when the condition clears the alert is closed
  (`resolved_at`) and a short "cleared" e-mail is sent. Warnings (alarms, minor faults) are e-mailed once.
- Customers can switch these e-mails off under Settings > Application Settings (`notification_preferences.email_alerts`).
- Needs `RESEND_API_KEY` (and optionally `RESEND_FROM_EMAIL`, `CUSTOMER_APP_URL`) in the Vercel environment. Set
  `DEVICE_ALERT_EMAILS=off` to stop the e-mails without a deploy; the alerts keep being created.
- **Dashboard wording.** The unit checks in every minute (`equipment_heartbeat.heartbeat_s`), so the page knows within about
  three minutes: **Connection lost** = the unit is alive but cannot reach the inverter (`device_online = false`); **Offline** =
  nothing arrives from the unit at all (it lost power or internet - e.g. an adapter fed by an inverter that was switched off).
  Both replace the inverter's state in the status pill, the energy-flow diagram freezes (last readings, no moving dots, a
  "showing the last readings" note) and Go Live is disabled; everything resumes by itself when readings return.

### Battery health and cycle count (Performance page)
The Deye does not report a battery's state of health or cycle count, so the page works them out from the lifetime energy
counters and the charge level. The battery's size and rating come from its **stock record** (`equipment_inventory`:
nominal capacity, `technical_specs.usable_kwh` or `dod`, `technical_specs.eol_pct` - 80 if absent - and
`warranty_info.cycle_life`), and the battery is allocated to the customer as child equipment under the inverter (see below).
The one per-unit figure, the inverter's lifetime discharge counter on the day that battery went in, is kept on the allocated
row (`equipment.discharged_baseline_kwh`, set automatically when a battery is allocated) so a replaced battery starts again
from zero cycles. Without an allocated battery the customer sees a note instead.
- **Cycles** = (lifetime discharged kWh - baseline) / usable capacity (equivalent full cycles, as manufacturers rate them).
- **Health, measured** = energy delivered in a discharge / share of the charge level it used, as the median of the last
  (up to ten) discharges of the past 7 days that used at least 30 points of charge (the charge level is a whole number,
  so a 30-point swing keeps the error near 3%). Capped at 100%.
- **Health, from usage** (until a measurement exists) = a straight line from 100% to the end-of-life capacity at the rated
  cycle life. The page says which of the two it is showing.
- **Life left** = remaining rated cycles / the last 30 days' cycles per day.
Measured capacity depends on the 15-minute summaries, which are kept for 8 days, so only recent discharges can be used.

### Equipment: devices and their children
A customer's installation is one **monitored device** (a solar inverter or an EV charger: registers, readings, alerts, shown on
the dashboard) with **child equipment** under it (panels, battery, meters, switchgear ...: no readings, never shown as a
device). `equipment.parent_id` links a child to its device (same site, one level deep, enforced by the database);
`equipment.quantity` lets one row stand for many units (12 panels = one row); `equipment.retired_at` takes something out while
keeping it on record. Which stock categories are devices is `waytara.is_monitored_category` (`solar_inverter`, `ev_charger`).
- **Allocating (admin):** Onboarding > Site & Device Setup > under the inverter, *Add equipment* (stock item, quantity,
  label). It calls `waytara.assign_child_equipment`, which checks the rules, takes the units off the stock count (a stock item
  that reaches 0 shows as allocated) and creates the row. *Remove* retires it.
- **What it feeds:** the battery's usable energy and rated cycles give the cycle count and health on Performance; the panels'
  rated power x quantity give the installed kWp and the yield per kWp. Warranty dates come from each child's stock record when
  the installation is completed. The customer sees only the inverter; the alert job and the connection test skip children.
- **Stock records must say what the dashboard needs:** a panel's `power_capacity_value` / `power_capacity_unit` (W per panel); a
  battery's capacity (kWh), `technical_specs.usable_kwh` (or `dod`), `technical_specs.eol_pct` (80 if absent) and
  `warranty_info.cycle_life`.

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
