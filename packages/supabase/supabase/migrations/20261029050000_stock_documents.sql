-- A stock item can carry its user manual and its data sheet (as well as its purchase order): files an admin uploads for the device model.
--
-- The files live in a PRIVATE storage bucket, device-documents (the purchase orders already have their own, po-documents); the table keeps where each
-- one is and what it is, and the admin app makes a short-lived link whenever someone views or downloads one. Only admins can read, add or delete them
-- for now. The admin's browser uploads straight to the bucket (a manual can be tens of megabytes; a server request cannot carry that).

alter table waytara.equipment_inventory
  add column if not exists manual_document_path text,
  add column if not exists manual_document_name text,
  add column if not exists manual_document_type text,
  add column if not exists manual_document_size integer,
  add column if not exists manual_document_uploaded_at timestamptz,
  add column if not exists datasheet_document_path text,
  add column if not exists datasheet_document_name text,
  add column if not exists datasheet_document_type text,
  add column if not exists datasheet_document_size integer,
  add column if not exists datasheet_document_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'device-documents',
  'device-documents',
  false,
  26214400,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "device_documents_admin_select" on storage.objects;
drop policy if exists "device_documents_admin_insert" on storage.objects;
drop policy if exists "device_documents_admin_delete" on storage.objects;

create policy "device_documents_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'device-documents' and waytara.is_admin());
create policy "device_documents_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'device-documents' and waytara.is_admin());
create policy "device_documents_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'device-documents' and waytara.is_admin());
