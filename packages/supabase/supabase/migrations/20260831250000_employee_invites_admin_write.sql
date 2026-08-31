-- Task 11.1 (employee management): employee_invites had RLS enabled with
-- zero policies at all — fully locked, not even SELECT for admin. Harmless
-- until now: the invite *acceptance* flow (apps/admin/(auth)/invite/[token])
-- already worked despite this because it runs pre-auth via
-- createServiceRoleClient() on both sides (there's no session yet to
-- scope RLS against). What was missing is the admin-side "send an
-- invite" UI, which needs a normal authenticated read/write path.
--
-- Same admin-only shape as plans_write_admin (already existed) — only an
-- admin manages staff accounts, not a regular employee.

drop policy if exists "employee_invites_admin_all" on waytara.employee_invites;
create policy "employee_invites_admin_all" on waytara.employee_invites
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());
