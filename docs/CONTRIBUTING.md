# Contributing

## Layout
```
apps/web        customer site + dashboard (waytaraenergy.com)
apps/admin      staff app (admin.waytaraenergy.com)
packages/supabase   DB client helpers, generated types, migrations, tests, local-DB tooling
packages/ui     shared React pieces (toasts, error fallback, PDF, realtime)
packages/config shared config (tsconfig, tailwind theme, security headers)
e2e/            Playwright end-to-end tests
docs/           this folder
```

## Daily commands
```bash
pnpm install
pnpm dev                      # both apps
pnpm lint && pnpm typecheck && pnpm test && pnpm build
node packages/supabase/scripts/local-db.mjs up      # local Supabase (Docker) mirroring production
pnpm test:db                  # pgTAP security/data-layer tests
pnpm test:e2e                 # Playwright (needs the local DB)
```
CI runs all of the above on every pull request.

## Rules that exist because we broke them once
1. **Every Server Action and Route Handler that does anything privileged starts with `await requireAdmin()` /
   `requireStaff()` / `requireCustomer()`** (`@waytara/supabase/auth`). A page redirect or the proxy is *not* access control:
   actions are directly callable POST endpoints.
2. **Never use the service-role client without a comment saying why RLS cannot do the job**, and always check the
   caller's identity and ownership of the thing they pass in before using it.
3. **Every new table gets RLS enabled + policies + a pgTAP test** proving a customer cannot read another customer's rows.
   Write policies with `(select auth.uid())` / `(select waytara.is_admin())`, not bare calls.
4. **New functions in `waytara` are not executable by `anon`/`PUBLIC`** (default privileges handle this) — grant only to the
   roles that need them. `SECURITY DEFINER` functions must `set search_path`.
5. **Don't guess "latest value" from raw telemetry.** Use `equipment_latest`. Long ranges use `telemetry_daily`
   (`fetchDailyMaxReadings`); short intraday charts use `telemetry_buckets`. Never page raw rows for more than a day.
6. **Server-render public pages.** No `useSearchParams()` at page level on marketing routes (it blanks the HTML for
   crawlers). New public pages need `pageMetadata()`; private pages need `NO_INDEX`.
7. **Migrations are additive and tested locally first** (`local-db.mjs reset` + `test:db`). Never edit an applied migration.
8. **Errors from actions are thrown** (so `ActionForm` shows a toast); auth pages are the exception (redirect + `?error=`).
9. **Images**: use `next/image`, compress before committing (no file in `public/` over ~500 KB without a reason).

## Pull request checklist
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass
- [ ] New/changed tables or policies have pgTAP tests; `pnpm test:db` passes
- [ ] New privileged actions call a `require…()` guard first
- [ ] User-visible change checked in a browser (light + dark, mobile width)
- [ ] `docs/PRODUCTION_READINESS.md` / `OPERATIONS.md` updated if behaviour or setup changed
