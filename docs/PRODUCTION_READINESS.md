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
