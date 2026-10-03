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

> Pending at the time of writing: migrations `20261003000000_security_hardening`, `…010000_audit_log_append_only`,
> `…020000_performance_data_layer`, `…030000_telemetry_rollups_retention`. **The current code requires all four**
> (it reads `equipment_latest` and calls `telemetry_buckets` / `telemetry_daily`). Apply them before deploying.

## 2. One-time setup checklist

### Vercel (both projects)
| Variable | web | admin | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔ | ✔ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✔ | ✔ | Server-only. Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | `https://waytaraenergy.com` | `https://admin.waytaraenergy.com` | Used for e-mail links. |
| `NEXT_PUBLIC_CANONICAL_URL` | optional | — | Defaults to `https://waytaraenergy.com`. |
| `CRON_SECRET` | ✔ | — | **Required in production**: the cron routes now refuse every request without it. Generate: `openssl rand -hex 32`. |
| `CUSTOMER_APP_URL` | — | `https://waytaraenergy.com` | |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `LEADS_NOTIFICATION_EMAIL` | ✔ | ✔ | |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | optional | optional | Error monitoring stays completely off until set. |

### Supabase scheduled jobs (pg_cron) — Vault secrets
The migration schedules the jobs, but they do nothing until two Vault secrets exist (run once in the SQL editor;
use the **same** value as `CRON_SECRET` in Vercel):
```sql
select vault.create_secret('https://waytaraenergy.com', 'app_base_url');
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
- **URL configuration:** Site URL `https://waytaraenergy.com`; redirect allow-list only the two production origins
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
- Verify both domains in Google Search Console and Bing Webmaster Tools; submit `https://waytaraenergy.com/sitemap.xml`.

## 3. Monitoring
- **Errors:** Sentry (once `SENTRY_DSN` is set). Server and browser errors plus all error-boundary catches.
- **Real-user performance:** Vercel Speed Insights (cookie-less) can be added with one component when wanted.
- **Uptime:** point an external monitor at `https://waytaraenergy.com/login` and `https://admin.waytaraenergy.com/login`.
- **Database:** Supabase Reports → slow queries; `select * from pg_stat_statements order by total_exec_time desc limit 10;`.

## 4. Telemetry growth plan
Measured 2026-10: ~207k rows/day for 7 devices (~30k/device/day).
- Now: raw rows kept 90 days, hourly rollups kept forever (`equipment_telemetry_hourly`); long-range pages read rollups.
- Rough size of the raw table at steady state: `devices × 30k × 90` rows (100 devices ≈ 270M rows).
- **When raw rows exceed ~50M**, convert `equipment_telemetry` to monthly range partitions (retention becomes
  `DROP PARTITION`, indexes stay small) — plan it before, not after. Also batch ingest inserts (50k+ rows per statement).

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
| Energy telemetry | `equipment_telemetry` (90 d), `…_hourly` (kept) | As above |
| Support messages / attachments | `support_*`, private bucket | 3 years after ticket closure |

Needed to be fully compliant (business/legal, not code): a named grievance officer in the privacy policy, a documented
process for access/erasure requests, and a consent notice if analytics or marketing cookies are ever added (none today).
