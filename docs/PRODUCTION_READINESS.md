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
