-- Task 8.2: recording payments (simulated for now — no Razorpay
-- integration yet, see the admin pipeline UI for the "Pay" buttons).
--
-- payments had SELECT policies for all three viewer types (admin,
-- customer-own, employee-assigned-via-quotation) but no INSERT at all —
-- same gap shape as every other write path in this schema so far.
-- payments has no employee_id column of its own — it's scoped through the
-- quotation it belongs to, same as the existing payments_employee_assigned
-- SELECT policy already does.

create policy "payments_admin_insert" on waytara.payments
  for insert
  with check (waytara.is_admin());

create policy "payments_employee_insert_own_quotation" on waytara.payments
  for insert
  with check (
    exists (
      select 1 from waytara.quotations q
      where q.id = quotation_id and q.employee_id = auth.uid()
    )
  );
