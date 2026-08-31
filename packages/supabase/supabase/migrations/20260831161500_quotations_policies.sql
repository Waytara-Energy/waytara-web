-- Task 8.1: quotation create/send + accept/reject.
--
-- quotations had SELECT policies for all three viewer types (admin,
-- employee-own, customer-own) but no INSERT or UPDATE policy at all —
-- nobody could create or advance a quotation via the API. Same gap shape
-- as Tasks 6 and 7.
--
-- customer_onboarding also had no admin UPDATE policy (only
-- onboarding_employee_update_own existed) — needed so an admin can advance
-- the stage on accept, not just the assigned employee.
--
-- Written idempotently (drop-if-exists before each create) — an earlier
-- push of this same file partially applied before failing on the last
-- statement, so a retry needs to tolerate policies that already exist.

drop policy if exists "quotations_admin_insert" on waytara.quotations;
create policy "quotations_admin_insert" on waytara.quotations
  for insert
  with check (waytara.is_admin());

drop policy if exists "quotations_employee_insert_own" on waytara.quotations;
create policy "quotations_employee_insert_own" on waytara.quotations
  for insert
  with check (employee_id = auth.uid());

drop policy if exists "quotations_admin_update" on waytara.quotations;
create policy "quotations_admin_update" on waytara.quotations
  for update
  using (waytara.is_admin())
  with check (waytara.is_admin());

drop policy if exists "quotations_employee_update_own" on waytara.quotations;
create policy "quotations_employee_update_own" on waytara.quotations
  for update
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

drop policy if exists "onboarding_admin_update" on waytara.customer_onboarding;
create policy "onboarding_admin_update" on waytara.customer_onboarding
  for update
  using (waytara.is_admin())
  with check (waytara.is_admin());

-- storage.objects: quotation-pdfs is public-read (bucket.public = true
-- already covers downloads) but had no policy allowing anyone to upload —
-- confirmed with a direct anon upload attempt (RLS-denied). Staff need to
-- write the generated PDF here.
drop policy if exists "quotation_pdfs_staff_insert" on storage.objects;
create policy "quotation_pdfs_staff_insert" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'quotation-pdfs' and waytara.is_staff());

drop policy if exists "quotation_pdfs_staff_update" on storage.objects;
create policy "quotation_pdfs_staff_update" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'quotation-pdfs' and waytara.is_staff())
  with check (bucket_id = 'quotation-pdfs' and waytara.is_staff());
