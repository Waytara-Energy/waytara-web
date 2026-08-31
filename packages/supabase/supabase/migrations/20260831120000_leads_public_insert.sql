-- Task 6: public "Request a Quote" form needs to insert into waytara.leads
-- as the anon Postgres role (no session — visitor isn't logged in).
--
-- Checked the existing RLS policy set on leads: only SELECT/UPDATE policies
-- exist (leads_admin_all, leads_employee_assigned, leads_employee_update_assigned).
-- No INSERT policy at all, and `anon` was never granted table-level access
-- to any waytara table (the original migration only granted authenticated:
-- `grant select, insert, update, delete on all tables in schema waytara to authenticated;`).
-- Both gaps block this, so this migration fixes both, for `leads` only.

grant insert on waytara.leads to anon, authenticated;

-- Insert-only, no select — a lead's own submitter can't read it (or anyone
-- else's) back through the API. `with check (true)` is intentional: this is
-- a public lead-capture form, there's nothing to scope the check to yet.
create policy "leads_public_insert" on waytara.leads
  for insert
  to anon, authenticated
  with check (true);
