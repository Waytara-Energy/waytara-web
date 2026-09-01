-- Onboarding pipeline redesign, Phase 9: another real gap found live —
-- payments has INSERT policies for admin and the assigned employee
-- (payments_admin_insert, payments_employee_insert_own_quotation, added
-- for Task 8.2) but no UPDATE policy for either. That went unnoticed
-- until now because nothing before this needed to update an existing
-- payments row — every prior payment action (recordFullPayment,
-- recordSplitPayment, the customer's own payFullAmount/payAdvanceAmount)
-- only ever inserts. Phase 9's recordBalancePayment is the first thing
-- that updates one (marking the pre-created balance row paid at
-- installation) — confirmed live: the action ran and returned success,
-- but the row silently stayed unchanged with no error, exactly the same
-- silent-no-op shape as the customer_onboarding gap two migrations ago.
create policy "payments_admin_update" on waytara.payments
  for update
  using (waytara.is_admin())
  with check (waytara.is_admin());

create policy "payments_employee_update_own_quotation" on waytara.payments
  for update
  using (
    exists (
      select 1 from waytara.quotations q
      where q.id = quotation_id and q.employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from waytara.quotations q
      where q.id = quotation_id and q.employee_id = auth.uid()
    )
  );
