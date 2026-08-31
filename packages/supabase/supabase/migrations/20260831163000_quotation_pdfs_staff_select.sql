-- Fixes a gap in 20260831161500: uploading with upsert (what the app
-- actually calls — .storage.upload(..., { upsert: true })) needs a SELECT
-- policy too, since upsert checks whether the object already exists before
-- deciding insert vs update. Confirmed by testing directly as a signed-in
-- employee: a plain POST upload succeeded, but the same request with the
-- x-upsert header (what the JS client sends) got RLS-denied.

drop policy if exists "quotation_pdfs_staff_select" on storage.objects;
create policy "quotation_pdfs_staff_select" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'quotation-pdfs' and waytara.is_staff());
