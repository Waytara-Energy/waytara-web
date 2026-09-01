-- Onboarding pipeline redesign, Phase 5, continued: the previous migration
-- added SELECT so the customer could read their own customer_onboarding
-- row; payFullAmount/payAdvanceAmount also need to WRITE to it (advancing
-- current_stage to site_setup, and balance_payment_status for a split) —
-- confirmed live that the payments insert succeeds under
-- payments_customer_insert_own but the stage update silently no-ops
-- without this. Same shape as the existing onboarding_employee_update_own
-- policy: row ownership only, no column restriction — the app layer is
-- trusted to only touch the columns its own actions mean to, exactly as
-- that policy's own precedent already establishes for employees.
create policy "onboarding_customer_update_own" on waytara.customer_onboarding
  for update
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());
