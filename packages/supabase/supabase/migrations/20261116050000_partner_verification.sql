-- WayTara Partner Network: verification. After an applicant sends their onboarding, an admin checks it. This adds (1) a checklist of what was checked and what was found,
-- (2) an append-only log of every time an admin opened or downloaded an applicant's document, and (3) a record of how a declined application's data was handled.
--
-- Who can touch what: admins only. The log can be added to but never changed or deleted by anyone's login (no update or delete privilege exists for it), so it can be trusted
-- as a record. Deleting an application removes its checklist and its log with it (the decline flow's "delete everything" option), which is what that option promises.
--
-- Additive: nothing existing is changed except two new nullable columns.

create table if not exists waytara.partner_checks (
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  key            text not null,
  state          text not null default 'pending',
  note           text,
  checked_by     uuid references waytara.profiles (id) on delete set null,
  checked_at     timestamptz,
  primary key (application_id, key),
  constraint partner_checks_key_valid check (key in ('identity', 'contact', 'licence', 'registration', 'work')),
  constraint partner_checks_state_valid check (state in ('pending', 'verified', 'problem')),
  constraint partner_checks_note_length check (note is null or char_length(note) <= 500)
);

create table if not exists waytara.partner_document_access (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  -- no foreign key: the document row may be deleted later and the record of who opened it should stay while the application does
  document_id    uuid,
  kind           text not null,
  file_name      text not null,
  action         text not null,
  accessed_by    uuid references waytara.profiles (id) on delete set null,
  accessed_at    timestamptz not null default now(),
  constraint partner_document_access_action_valid check (action in ('view', 'download'))
);

create index if not exists partner_document_access_application_idx on waytara.partner_document_access (application_id, accessed_at desc);

alter table waytara.partner_checks enable row level security;
alter table waytara.partner_document_access enable row level security;

create policy partner_checks_admin_select on waytara.partner_checks for select to authenticated using (waytara.is_admin());
create policy partner_checks_admin_insert on waytara.partner_checks for insert to authenticated with check (waytara.is_admin());
create policy partner_checks_admin_update on waytara.partner_checks for update to authenticated using (waytara.is_admin()) with check (waytara.is_admin());

create policy partner_document_access_admin_select on waytara.partner_document_access for select to authenticated using (waytara.is_admin());
-- An admin can only log themselves: the row must name the person who is signed in.
create policy partner_document_access_admin_insert on waytara.partner_document_access for insert to authenticated with check (waytara.is_admin() and accessed_by = auth.uid());

revoke all on waytara.partner_checks from anon, authenticated;
revoke all on waytara.partner_document_access from anon, authenticated;
grant select, insert, update on waytara.partner_checks to authenticated;
grant select, insert on waytara.partner_document_access to authenticated;
grant all on waytara.partner_checks to service_role;
grant all on waytara.partner_document_access to service_role;

-- How a declined application's data was handled, so the record says what was kept: 'delete_documents' (files and onboarding answers deleted; contact details and the
-- first application kept) or 'keep' (nothing deleted). The third option, delete everything, removes the application itself, so it has nothing to record on.
alter table waytara.partner_applications
  add column if not exists declined_at timestamptz,
  add column if not exists declined_handling text;

alter table waytara.partner_applications
  add constraint partner_applications_declined_handling_valid check (declined_handling is null or declined_handling in ('delete_documents', 'keep'));

comment on table waytara.partner_checks is 'The verification checklist of a partner application: what an admin checked, what they found, and when.';
comment on table waytara.partner_document_access is 'Append-only log of each time an admin opened or downloaded an applicant''s document.';
comment on column waytara.partner_applications.declined_at is 'When the application was declined.';
comment on column waytara.partner_applications.declined_handling is 'What was done with the applicant''s data on declining: delete_documents or keep. Null when not declined (or when everything was deleted, which removes the row).';
