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
