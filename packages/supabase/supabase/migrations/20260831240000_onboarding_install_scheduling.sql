-- Task 8.6 (Install completion): the install_scheduled stage needs
-- somewhere to record when the crew is due on site — nothing on
-- customer_onboarding captures a date at all. Employee-writable via the
-- existing onboarding_employee_update_own policy (no new policy needed,
-- that one already covers any column on a row the employee owns).

alter table waytara.customer_onboarding
  add column if not exists install_scheduled_at timestamptz;
