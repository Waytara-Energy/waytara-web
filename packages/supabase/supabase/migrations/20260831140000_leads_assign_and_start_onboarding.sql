-- Task 7: admin lead assignment + "Start Onboarding" button.
--
-- Checked the existing RLS policy set again:
--   leads: only SELECT policies exist (leads_admin_all, leads_employee_assigned)
--   plus one UPDATE policy scoped to employees on their own assigned leads
--   (leads_employee_update_assigned). No UPDATE policy for admin at all —
--   an admin can currently see every lead but can't update any of them,
--   which blocks "assign a lead to an employee" (sets assigned_to + status).
--
--   customer_onboarding: only SELECT (onboarding_admin_all,
--   onboarding_employee_own) and one UPDATE (onboarding_employee_update_own)
--   policy exist. No INSERT policy at all — nobody can create an onboarding
--   row via the API today, which blocks "Start Onboarding" entirely.

-- Admin can update any lead (assignment, status changes, etc.).
create policy "leads_admin_update" on waytara.leads
  for update
  using (waytara.is_admin())
  with check (waytara.is_admin());

-- Admin can start onboarding for any lead.
create policy "onboarding_admin_insert" on waytara.customer_onboarding
  for insert
  with check (waytara.is_admin());

-- An employee can start onboarding only for a lead already assigned to
-- them, and only naming themselves as the onboarding's employee_id (can't
-- create a row on someone else's behalf).
create policy "onboarding_employee_insert_own_lead" on waytara.customer_onboarding
  for insert
  with check (
    employee_id = auth.uid()
    and exists (
      select 1 from waytara.leads l
      where l.id = lead_id and l.assigned_to = auth.uid()
    )
  );
