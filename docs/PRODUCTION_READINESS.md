# Production readiness — change log

Work branch: `hardening/production-readiness` (not yet merged to `main`).
Each phase lists what changed, why, and how it was verified.

## Baseline (before any optimisation) — Lighthouse, mobile, local `next start`

| Page | Perf | A11y | Best-practices | SEO | LCP | TBT | Transfer |
|---|---|---|---|---|---|---|---|
| `/` | 80 | 95 | 100 | 100 | 3.9 s | 330 ms | 3.4 MB |
| `/login` | 90 | 88 | 100 | 100 | 3.4 s | 150 ms | 0.5 MB |
| `/solutions` | **48** | 93 | 100 | 100 | **15.5 s** | **1,630 ms** | 2.8 MB |
| `/technology` | 88 | 91 | 100 | 100 | 3.5 s | 190 ms | 0.5 MB |

Database baseline (2026-10): `equipment_telemetry` 1.69M rows / 309 MB, ~207k rows/day over 7 devices;
telemetry insert avg 75 ms/call; 52 of 109 RLS policies use bare `auth.uid()`.

## Phase 0 — Baseline & guardrails
- `.gitattributes` (LF everywhere, binaries marked), removed 4 stray working files.
- GitHub Actions: `ci.yml` (lint, typecheck, test, build, `pnpm audit`), `codeql.yml`, Dependabot.
- `typecheck` / `test` turbo tasks and root scripts.
- Error handling: `error.tsx`, `global-error.tsx`, `not-found.tsx` for both apps, dashboard-level
  `error.tsx`, admin `(dashboard)/loading.tsx`; shared `@waytara/ui/error-fallback`.

## Phase 1 — Security: critical fixes
- **Cron routes fail closed** (`apps/web/src/lib/cron-auth.ts`): with no `CRON_SECRET` in production every request is
  refused (they use the service-role key); constant-time comparison. Previously they ran unauthenticated.
- **Scheduling via Supabase `pg_cron` + `pg_net`** (migration `20261003000000_security_hardening.sql`): jobs call the
  web app's cron routes with a bearer secret read from **Vault** (`cron_secret`, `app_base_url`) — never stored in git.
  Jobs no-op harmlessly until the Vault secrets exist.
- **Lead form** (the only anonymous write): Postgres-backed rate limiter (`consume_rate_limit`, per-IP + global,
  IPs hashed, works across serverless instances) replacing the in-memory one; DB check constraints on field
  lengths; insert policy now only allows `status='new'`, unassigned leads.
- **Database functions** no longer executable by `anon`/`PUBLIC` (`is_admin`, `is_staff`, `update_device_site`, ...).
- **Quotation PDFs**: bucket `quotation-pdfs` made private; PDF is stored on acceptance and its path saved in
  `quotations.pdf_url`; customers download through `/quote/[token]/pdf` (token-checked, rate-limited, 60 s signed URL);
  staff through admin `/quotations/[id]/pdf` (caller's own RLS/storage policies, no service-role shortcut).
- **Proxy hardening**: admin proxy is now secure-by-default (protects everything except explicit public paths — new
  routes can no longer be accidentally unauthenticated); web proxy also covers `/api/reports/*`.
- **Security headers** shared via `@waytara/config/security-headers`: CSP (no third-party script/connect hosts, no
  framing, `object-src 'none'`, `form-action 'self'`), HSTS, nosniff, X-Frame-Options, Referrer-Policy,
  Permissions-Policy, COOP; `X-Powered-By` removed. Verified in a browser: pages render/hydrate, off-origin requests blocked.
  Known limitation: `script-src` keeps `'unsafe-inline'` (Next's inline bootstrap); a nonce-based CSP would force all
  pages dynamic.
- **Status:** migration written but NOT yet applied to the production database (apply blocked by the sandbox).

## Phase 2 — Security: hardening
- **Authorization inside every privileged Server Action** (`requireAdmin` / `requireStaff` / `requireCustomer` in
  `@waytara/supabase/auth`). Found and fixed a privilege-escalation gap: `changeEmployeeRole`, `revokeEmployeeAccess`,
  `restoreEmployeeAccess`, `permanentlyDeleteEmployee` (service-role, RLS bypassed) only checked that *someone* was
  signed in. Page-level redirects/proxy are not access control for Server Actions (they are directly invocable POST
  endpoints). Guards added to all admin-only (employees, devices, catalog, registers, plans, service plans) and staff
  (onboarding, leads, support) actions, plus customer actions in apps/web.
- **Audit log is append-only** (migration `20261003010000_audit_log_append_only.sql`): UPDATE/DELETE/TRUNCATE revoked
  from every client role.
- **Local production-shaped database** (`packages/supabase/scripts/local-db.mjs`, `supabase/local/baseline-*.sql`):
  Docker Supabase built from a read-only dump of production, then every newer migration applied on top. Used to verify
  the security migrations (anon cannot execute functions; bucket private; limiter blocks the 6th request;
  pre-converted anonymous lead insert rejected; cron jobs scheduled; cron wrapper no-ops without Vault secrets).

## Phase 6 (started early) — Testing foundation
- **Unit tests (Vitest)**: register codec (decode/encode round-trips, offsets, 32-bit words), field formatting,
  phase/index grouping, cron auth (fails closed), rate limiter (DB path + in-memory fallback). `pnpm test`.
- **Database security tests (pgTAP)**: 39 assertions in `supabase/tests/database/01_security.test.sql` run against the
  production-shaped local DB: anonymous access, customer ↔ customer isolation, privilege-escalation attempts
  (self-promotion to admin, moving/renaming another customer's device, forging telemetry), employee scoping,
  audit-log immutability (even for admins), rate limiter, private quotation bucket. `pnpm --filter @waytara/supabase test:db`.
- CI runs lint, type-check, unit tests, build, dependency audit, CodeQL, and the database suite.

## Phase 3 — Performance quick wins (measured)
| Change | Effect |
|---|---|
| Compressed/resized oversized media (18 MB house photo → 193 KB, login PNGs 9.1 MB → 0.4 MB WebP, hero video 7.5 → 2.2 MB, EV image 957 → 89 KB); checked visually | `public/` **44 MB → 5.7 MB** |
| Deleted 4 unused files (incl. a byte-identical 2.3 MB duplicate) | |
| Removed 4 `unoptimized` flags (images now served as AVIF/WebP at the right size); added `sizes` to the `/solutions` hero | `/solutions` transfer 2.8 → 0.5 MB, LCP 15.5 → ~4.2 s |
| Replaced `framer-motion` (used only for a skeleton shimmer and a button spinner) with CSS; dependency removed | −~50 KB JS everywhere |
| Marketing nav no longer loads the Supabase client for anonymous visitors (cookie check + dynamic import) | home first-load JS **338 → 234 KB gzip** (−65 KB) |

Lighthouse (mobile, local, noisy because Docker runs alongside): `/` 80 → ~77 (TBT-bound), `/login` 90 → 91,
`/solutions` 48 → ~65-73, transfer `/` 3.4 → 0.7 MB. Re-measure with `node scripts/first-load-js.mjs <base> <routes...>`.

## Phase 4 — Data layer (migration `20261003020000_performance_data_layer.sql`)
> **Deploy order matters:** the app now reads `equipment_latest` and calls `telemetry_buckets`. Apply migrations
> `20261003000000`, `…010000`, `…020000` to production **before** deploying this code.
- **`equipment_latest`** (one row per device+key, kept current by a *statement-level* trigger — one upsert per ingest
  batch, not per row; newer-wins, test data excluded; RLS mirrors the telemetry policies; realtime-published). Every
  "latest value" read (Overview, Monitoring, device pages, catalog, cron jobs, EV session actions) now uses it instead of
  `ORDER BY ts DESC LIMIT keys×5`. Fixes a correctness bug as well as speed: keys that hadn't reported recently were
  silently missing, and the offline-alert cron judged "last seen" from the newest 2,000 rows across *all* devices.
- **`telemetry_buckets()`** (SECURITY INVOKER, so RLS applies; guards bucket size and ≤400-day ranges): `BarTrendChart`
  fetches a few hundred pre-averaged rows instead of paging 1,000 raw rows at a time.
- **Composite index** `(equipment_id, key_name, ts desc) where not is_test` for the time-series access pattern.
- **RLS rewrite**: all `auth.uid()` / `is_admin()` / `is_staff()` calls wrapped as `(select …)` so they run once per
  query, not per row (65 policies). The pgTAP security suite (39 assertions) passes unchanged on the rewritten policies.
- **Realtime refresh throttling**: pages that re-render server-side on telemetry now refresh at most every 15 s
  (`RealtimeRefresh throttleMs`) instead of re-running the whole page every ingest tick.
- Tests: `02_data_layer.test.sql` (16 assertions: newest-wins trigger, test data ignored, RLS, bucket math, guards).

## Phase 7 — SEO / GEO / AEO
**Biggest finding: the home page and `/solutions` were invisible to crawlers.** Both used `useSearchParams()` inside a
`Suspense` boundary, so the prerendered HTML was only "Loading WayTara Energy…" (17 KB, no `<h1>`); the real content
was built in the browser. Now server-rendered (104 KB / 141 KB with full content, one `<h1>` each). The query-string
values they read (`?for=`, `?segment=`) are applied after mount instead. Lighthouse: home 77 → 82 (blocking time
330 → 80 ms), `/solutions` 48 → 82.

- **Technical SEO**: `metadataBase` on the real domain; title template; per-page title/description/canonical/Open
  Graph/Twitter via `pageMetadata()`; canonical for `/solutions/ev_fleet` → `/solutions/ev-fleet` (no duplicate
  content); `robots.txt`, `sitemap.xml` (14 canonical URLs), web manifest; generated 1200×630 link-preview image.
- **Indexing rules**: login/reset/invite/quote (auth group) and `/dashboard` are `noindex`; admin app disallows all.
  `/technology` and `/knowledge-centre` are `noindex` and out of the sitemap because they still contain
  "coming soon" placeholder copy (thin content). Remove `noIndex` once real content is published.
- **AEO (answer engines)**: `FAQPage` JSON-LD from the FAQs that are actually visible on each solutions page (6
  segment pages + the consolidated FAQ on `/solutions`), `Service` and `BreadcrumbList` per segment page,
  `Organization` + `WebSite` site-wide. XSS-safe serialisation (`<` escaped).
- **GEO (generative engines)**: `/llms.txt` (company facts, six solutions with summaries, key pages, guidance for
  assistants); AI crawlers are not blocked on public pages. Facts live in one place (`src/lib/site.ts`).
- `/.well-known/security.txt` (vulnerability contact).
- 10 unit tests lock the rules in (no duplicate/underscore sitemap URLs, private pages never listed, noindex, JSON-LD shape).

**Needs the founder (marked REVIEW in `src/lib/site.ts`)**: which phone number is the public one (the site shows three);
real social-profile URLs (footer links are bare `twitter.com` etc., so `sameAs` is omitted); founding year; content for
the two placeholder pages; confirm Search Console / Bing Webmaster ownership once deployed; GA4 measurement ID + consent
banner (not added — needs your property ID).

## Phase 6 (continued) — End-to-end tests
`pnpm test:e2e` (Playwright, 26 tests) boots both apps in dev mode against the **local** Supabase stack
(`e2e/support/local-supabase.ts` refuses any non-local URL) and seeds a customer, admin and employee. Covers:
- Public site: server-rendered HTML for crawlers, JSON-LD types, canonical aliasing, robots/sitemap/llms.txt,
  noindex rules, security headers.
- Access control: anonymous redirects (including a brand-new unknown admin route), customer refused by admin app and
  staff refused by customer app, employee blocked from admin-only pages, forged/malformed quotation tokens, PDF routes.
- Auth flows: wrong password, successful sign-in, session survives reload.
- Accessibility (axe, WCAG A/AA): critical violations fail the build.
- A regression test for a bug the suite itself found: the secure-by-default admin proxy briefly blocked `/images/*`, breaking
  the login hero image for logged-out users (matcher now exempts static assets).

**Accessibility debt logged by axe (serious, not yet failing the build):** colour contrast on `/login` (2), `/contact`
(1) and `/solutions/home` (17 nodes), and a link-in-text-block on `/login`. Fix in a design pass.

Also fixed: pnpm 11 left `esbuild: set this to true or false` in `pnpm-workspace.yaml`, which makes every
`pnpm install` / `pnpm exec` exit non-zero (would have failed CI). Approved as `true`.

## Phase 8 — Telemetry at scale (migration `20261003030000_telemetry_rollups_retention.sql`)
- **Found:** Analytics, Performance and report export (30–365 days) read *raw* readings through a helper capped at
  20,000 rows (~one day of one key), so their long-range numbers were silently computed from the first day or two.
- **`equipment_telemetry_hourly`** rollup (min/avg/max/count per device+key+hour, IST-aligned bins so every India
  midnight is an exact boundary), refreshed every 10 min by pg_cron, backfilled, kept forever, RLS like telemetry.
- **`telemetry_daily()`** (per-IST-day max/avg/min, SECURITY INVOKER) + `fetchDailyMaxReadings()`; the five long-range
  call sites now use it (a year of one key ≈ 365 rows instead of millions).
- **Retention:** `purge_old_telemetry(90)` runs nightly, bounded batches, refuses < 14 days; raw rows older than 90 days
  go, rollups stay. (Nothing is old enough to delete yet — oldest raw row is from 2026-09-20.)
- **Not done on purpose:** table partitioning. Plan and trigger (raw rows > ~50M) are in OPERATIONS.md §4.
- Tests: `03_rollups_retention.test.sql` (18 assertions incl. exact IST day boundaries, RLS, idempotence, retention keeps rollups).

## Phase 9 — Production readiness
- **Error monitoring:** Sentry wired into both apps (`instrumentation.ts`, `instrumentation-client.ts`, all error
  boundaries); completely inactive and not downloaded until a DSN is set; no PII, no session replay; CSP extends to the
  DSN origin automatically.
- **Docs:** `OPERATIONS.md` (release order, env vars, Vault/cron setup, Supabase Auth checklist, backups, monitoring,
  telemetry plan, incident cheat-sheet, DPDP data inventory), `CONTRIBUTING.md` (rules learned from real bugs, PR
  checklist), `SECURITY.md` (model, reporting, remaining gaps). `.env.example` brought up to date.
- **Tooling fixes found along the way:** pnpm-11 unapproved build scripts (esbuild, @sentry/cli) broke `pnpm install`/`exec`
  exit codes; ESLint/tsc now ignore the E2E build dir (lint ran out of memory without it).

## Final verification (all on the finished branch)
| Check | Result |
|---|---|
| `pnpm lint` / `typecheck` | clean (both apps + packages) |
| Unit tests (Vitest) | 46 passed (13 codec + 33 web) |
| Database tests (pgTAP) | 73 assertions passed |
| End-to-end (Playwright) | 26 passed |
| `pnpm build` | both apps build |
| Lighthouse (mobile, local) | home 83, solutions 85, login 90 (SEO 63 is intentional: `noindex`); first-load JS 188–236 KB gz |

## Still open / needs a human
1. ~~Apply the 4 pending migrations to production~~ **Done 2026-10-04** (backup first, dry-run showed exactly the 4, post-checks passed; see OPERATIONS.md §1).
2. Set in Vercel: `CRON_SECRET`; create the two Vault secrets (`OPERATIONS.md` §2). Until then scheduled jobs are no-ops.
3. Supabase dashboard settings that cannot be done by migration (Auth hardening, PITR, SSL) — `OPERATIONS.md` §2.
4. Founder content/facts (`src/lib/site.ts` REVIEW items; `/technology` and `/knowledge-centre` placeholder copy).
5. Accessibility debt from axe: colour contrast (login 2, contact 1, solutions 17 nodes).
6. Home LCP is still ~4 s in the throttled lab (target 2.5 s): next candidates are a poster image + deferred hero video.
7. GA4 / cookie-consent banner not added (needs a measurement ID); Vercel Speed Insights optional.
8. MFA for admins deliberately skipped (your decision); nonce-based CSP not done (see `SECURITY.md`).

## Update 2026-10-05
- Canonical host is now **https://www.waytaraenergy.com** (matches the live Vercel redirect apex -> www): `SITE.url`, `llms.txt`,
  `security.txt`, tests and docs. Override with `NEXT_PUBLIC_CANONICAL_URL` if it ever changes.
- Added **Vercel Web Analytics** and **Speed Insights** to both apps (root layouts). First-party `/_vercel/...` paths, so the CSP is
  unchanged in production (dev mode additionally allows `va.vercel-scripts.com`).
- Security: **Next.js 16.3.2 -> 16.3.8** (3 critical advisories); `pnpm audit` clean.
- Production DB: migrations applied and verified; Vault secrets `app_base_url` (www) and `cron_secret` present.
- Still open: Supabase "Allow new users to sign up" reads as ENABLED (re-check the dashboard toggle and save).

## Fix 2026-10-05 — false "never reported" offline alerts
The first scheduled `detect-alerts` run raised 9 critical alerts, 7 of them wrong ("has never reported" for devices that
had readings). Cause: the job read every `equipment_latest` row and reduced in JS, but the REST API returns at most 1,000
rows per request and the table has one row per device+key (1,305), so devices with older readings fell out of the result.
Fix: migration `20261005000000_device_last_seen.sql` (`device_last_seen(uuid[])`, one row per device, RLS-aware) + the
route now uses it and returns 500 on error instead of guessing. Regression test `04_device_last_seen.test.sql` (7 assertions,
includes >1,000 rows). **Rule of thumb: never page or reduce `equipment_latest`/telemetry client-side to answer a per-device
question — aggregate in SQL.**

## Update 2026-10-07 — rollup data layer, live dashboards, range pickers
- **Data layer:** `20261006000000_rollup_data_layer.sql` (applied to production; 56 pgTAP assertions in `05_rollup_data_layer.test.sql`).
  15-minute / hourly / daily rollups with exact-combine columns, `ingest_tick`, `device_data_range`, retention and late-data jobs,
  Realtime channel policies and the `live-snapshots` bucket. No raw rows are stored.
- **Agent:** `equipment_agent` keeps a local copy of every reading, uploads latest values each interval and finished 15-minute buckets,
  and answers Go Live. Verified: SQL/agent parity (2,756/2,756 buckets); energy totals within ~1.5% of the inverter's own counters
  (battery charge differs: 1.18 vs 1.90 kWh, unexplained); local end-to-end Go Live and per-upload broadcast.
- **Dashboard:** Overview, Monitoring (solar and EV), Performance and Maintenance gauges follow the live channel in place;
  Monitoring and Performance have the Today/7/30/90/custom picker; Reports export a day, 7/30/90 days or a custom 30-day window
  as CSV/PDF; Monitoring has **Go Live**. Battery direction fixed (positive = discharging).
- **Fixed on the way:** EV Monitoring called helpers from a `"use client"` module on the server (would have thrown at runtime).
- **Dependencies:** `source-map-js` and `sharp` pinned to patched versions (pnpm overrides); `pnpm audit` clean.
- **Not verified:** a signed-in browser run of the new screens against production, the agent against the real inverter,
  and production behaviour of the private Realtime channels (policies are applied; first real test is the first live agent run).
- **Waiting on a human:** dropping the old raw tables/functions/cron jobs (cutover), running the agent on the real inverter, any plan upgrade or move to Tiger/VPS.
