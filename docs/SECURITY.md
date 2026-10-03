# Security overview

## Reporting a vulnerability
E-mail **hello@waytaraenergy.com** (also published at `/.well-known/security.txt`). Please include steps to reproduce and
do not access other people's data. (Set a response-time commitment here once the team has agreed one.)

## Model in one page
- **Identity:** Supabase Auth (e-mail + password, invite-only sign-up). Roles live in `waytara.profiles.role`
  (`admin`, `employee`, `site_engineer`, `customer`). Revoked staff are banned in Auth *and* marked `deactivated_at`,
  which `getCurrentProfile()` treats as "no session" immediately.
- **Authorization, three layers (all must agree):**
  1. Proxy (`proxy.ts`): admin app is *secure by default* (everything except an explicit public list needs a staff session);
     the customer app gates `/dashboard` and `/api/reports`.
  2. Server code: `requireAdmin/Staff/Customer()` as the first statement of every privileged action.
  3. **Row Level Security** on every table (the real boundary). Customers see only their own sites/devices/telemetry;
     employees only assigned customers; admins everything. `audit_log` is append-only for every role.
- **Anonymous surface (intentionally tiny):** the contact form (`/api/leads`: validated, honeypot, Postgres-backed
  rate limit per IP and globally, DB length constraints, inserts only `status='new'` unassigned rows) and the
  token-addressed quote page (`/quote/[token]`: unguessable token, rate-limited PDF links that expire in 60 s).
- **Secrets:** service-role key server-only; cron secret in Vercel + Supabase Vault (never in git); cron routes **fail closed**.
- **Storage:** `quotation-pdfs`, `customer-kyc`, `support-attachments`, `maintenance-media`, `site-documents` are private
  (signed URLs); only `avatars` and `device-catalog` are public by design.
- **Browser hardening:** CSP (no third-party scripts; connect only to self + Supabase [+ Sentry when configured]; no framing),
  HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP. Known gap: `script-src` still needs `'unsafe-inline'`
  for Next's bootstrap scripts; moving to nonces would make every page dynamic.

## Automated checks
CodeQL (weekly + every PR), `pnpm audit` (high+), Dependabot weekly, pgTAP RLS suite, Playwright access-control tests.

## Not done yet (ranked)
0. **Verify** in the Supabase dashboard that public sign-up is disabled (accounts are meant to be invite-only); this cannot be checked from code.
1. Enable MFA for admin accounts (decision: not required for now).
2. Leaked-password protection and password policy in the Supabase dashboard (see OPERATIONS.md).
3. Nonce-based CSP.
4. Periodic dependency and RLS review; external penetration test before large-scale launch.
