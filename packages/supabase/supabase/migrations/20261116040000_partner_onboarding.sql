-- WayTara Partner Network: onboarding. A shortlisted applicant fills in their business details, licences, team, areas and past work on the page their private tracking link
-- opens, and uploads their documents. Their answers are one row (partner_onboarding); each uploaded file is a row (partner_documents) pointing at a file in a PRIVATE bucket.
--
-- Who can touch what:
--   * The applicant has no database login. Their page talks to the website's server, which checks the tracking link and then writes with the server's own key. So the
--     public (anon) and signed-in roles get NO access to these tables or to the bucket: the applicant cannot read a file back, only send one (write-only).
--   * Admins can read both tables and the files (to verify them). An admin cannot change an applicant's answers; the only thing they may write is the 'sent'
--     mark, to re-open an onboarding.
--   * Deleting an application deletes its answers and its document rows (cascade). The FILES in the bucket are removed by the admin's decline flow, which also
--     decides whether to keep the documents at all.
--
-- Additive: nothing existing is changed.

create table if not exists waytara.partner_onboarding (
  application_id uuid primary key references waytara.partner_applications (id) on delete cascade,
  -- The sections (business, licences, team, areas, past work), checked by the server before they are saved.
  data           jsonb not null default '{}'::jsonb,
  -- Set when the applicant sends it for verification; the page is then read-only.
  submitted_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint partner_onboarding_data_size check (octet_length(data::text) <= 100000)
);

create table if not exists waytara.partner_documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  kind           text not null,
  file_name      text not null,
  storage_path   text not null,
  content_type   text not null,
  size_bytes     integer not null,
  uploaded_at    timestamptz not null default now(),
  constraint partner_documents_kind_valid check (kind in ('licence', 'registration', 'identity', 'insurance', 'certificate', 'work_photo', 'other')),
  constraint partner_documents_name_length check (char_length(file_name) between 1 and 200),
  constraint partner_documents_size_valid check (size_bytes > 0 and size_bytes <= 10485760),
  constraint partner_documents_path_key unique (storage_path)
);

create index if not exists partner_documents_application_idx on waytara.partner_documents (application_id, uploaded_at);

alter table waytara.partner_onboarding enable row level security;
alter table waytara.partner_documents enable row level security;

create policy partner_onboarding_admin_select on waytara.partner_onboarding for select to authenticated using (waytara.is_admin());
create policy partner_documents_admin_select on waytara.partner_documents for select to authenticated using (waytara.is_admin());

-- An admin may re-open a sent onboarding (to ask for more) and for that one purpose only: clearing the 'sent' mark. The column-level grant below means no other
-- column, in particular none of the applicant's answers, can be changed with an admin's login.
create policy partner_onboarding_admin_reopen on waytara.partner_onboarding for update to authenticated using (waytara.is_admin()) with check (waytara.is_admin());

revoke all on waytara.partner_onboarding from anon, authenticated;
revoke all on waytara.partner_documents from anon, authenticated;
grant select on waytara.partner_onboarding to authenticated;
grant update (submitted_at) on waytara.partner_onboarding to authenticated;
grant select on waytara.partner_documents to authenticated;
grant all on waytara.partner_onboarding to service_role;
grant all on waytara.partner_documents to service_role;

create trigger partner_onboarding_set_updated_at
  before update on waytara.partner_onboarding
  for each row execute function waytara.set_updated_at();

comment on table waytara.partner_onboarding is 'A partner applicant''s onboarding answers. Written only by the website server after it has checked their tracking link; admins can read.';
comment on table waytara.partner_documents is 'Documents a partner applicant uploaded (licences, registration, identity and so on). The files are in the private partner-documents bucket.';

-- The private bucket. 10 MB a file; PDF and pictures only. Files go in through one-time signed upload addresses the server hands out after checking the link, so
-- there is deliberately NO storage policy for the public or signed-in roles on insert or select. Admins can read (view) them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-documents', 'partner-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "partner_documents_admin_select" on storage.objects;
create policy "partner_documents_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'partner-documents' and waytara.is_admin());
