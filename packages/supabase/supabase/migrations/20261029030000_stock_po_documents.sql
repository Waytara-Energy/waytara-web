-- The purchase order of a stock item is a file (a PDF, a photo or a scan) that an admin uploads, not only a reference number.
--
-- The file lives in a PRIVATE storage bucket (purchase documents are not for the public); the table keeps where it is and what it is, and the admin app
-- makes a short-lived link whenever someone views or downloads it. Only admins can read, add or delete these files.

alter table waytara.equipment_inventory
  add column if not exists po_document_path text,
  add column if not exists po_document_name text,
  add column if not exists po_document_type text,
  add column if not exists po_document_size integer,
  add column if not exists po_document_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'po-documents',
  'po-documents',
  false,
  15728640,
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

drop policy if exists "po_documents_admin_select" on storage.objects;
drop policy if exists "po_documents_admin_insert" on storage.objects;
drop policy if exists "po_documents_admin_delete" on storage.objects;

create policy "po_documents_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'po-documents' and waytara.is_admin());

create policy "po_documents_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'po-documents' and waytara.is_admin());

create policy "po_documents_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'po-documents' and waytara.is_admin());
