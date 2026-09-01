-- Onboarding pipeline redesign, Phase 5: a real gap found while wiring up
-- the customer's self-service payment step. customer_onboarding has only
-- ever had SELECT policies for admin (onboarding_admin_all) and the
-- assigned employee (onboarding_employee_own) — no policy ever let the
-- customer read their own row. That went unnoticed until now because
-- nothing customer-facing needed current_stage before this: the dashboard
-- had no stage-based gating (still doesn't — that's Phase 6), and the
-- invite-acceptance flow writes to this table via the service-role client,
-- which bypasses RLS entirely. Phase 5's onboarding-status page is the
-- first thing that reads it under the customer's own session, and without
-- this policy the query silently returns zero rows rather than erroring.
create policy "onboarding_customer_select_own" on waytara.customer_onboarding
  for select
  using (customer_id = auth.uid());
