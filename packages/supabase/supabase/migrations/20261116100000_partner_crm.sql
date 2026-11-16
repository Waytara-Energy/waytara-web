-- WayTara Partner Network: the partner record as a CRM. Three additions, all additive (nothing the live code uses is altered):
--
--  1. partner_item_checks: verification of ONE item at a time, for the partner or for one of their team members. A member's id is in the subject ('member:<id>'), so
--     each person added to a team is verified on their own (identity, and their licence or certificate where one is needed). The older five-check table
--     (partner_checks) is left as it is and its rows are copied across; new code reads and writes only this table.
--  2. partner_screening_calls: the screening call log. One row per call: when, who, what came of it, notes and the next step. Append-only, like the document log: a
--     mistake is corrected with another entry.
--  3. partner_documents.subject and more kinds: a document can belong to the partner ('partner'), to a team member ('member:<id>') or to a past-work category
--     ('category:<name>'), and there are kinds for KYC proofs, bank proof and survey records.
--
-- Admins only, as for the rest of the partner tables. Applicants and partners have no access to any of it: their pages go through the server.

create table if not exists waytara.partner_item_checks (
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  subject        text not null default 'partner',
  key            text not null,
  state          text not null default 'pending',
  note           text,
  checked_by     uuid references waytara.profiles (id) on delete set null,
  checked_at     timestamptz,
  primary key (application_id, subject, key),
  constraint partner_item_checks_subject_valid check (subject = 'partner' or subject ~ '^member:[A-Za-z0-9_-]{1,40}$'),
  constraint partner_item_checks_key_valid check (key in ('identity', 'contact', 'licence', 'registration', 'work', 'kyc', 'bank', 'member_identity', 'member_licence')),
  constraint partner_item_checks_state_valid check (state in ('pending', 'verified', 'problem')),
  constraint partner_item_checks_note_length check (note is null or char_length(note) <= 500)
);

-- what has been checked so far carries over
insert into waytara.partner_item_checks (application_id, subject, key, state, note, checked_by, checked_at)
select application_id, 'partner', key, state, note, checked_by, checked_at from waytara.partner_checks
on conflict do nothing;

create table if not exists waytara.partner_screening_calls (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  called_by      uuid references waytara.profiles (id) on delete set null,
  called_at      timestamptz not null default now(),
  outcome        text not null,
  notes          text,
  next_step      text,
  constraint partner_screening_calls_outcome_valid check (outcome in ('reached', 'no_answer', 'call_back', 'wrong_number')),
  constraint partner_screening_calls_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint partner_screening_calls_next_length check (next_step is null or char_length(next_step) <= 300)
);

create index if not exists partner_screening_calls_application_idx on waytara.partner_screening_calls (application_id, called_at desc);

alter table waytara.partner_item_checks enable row level security;
alter table waytara.partner_screening_calls enable row level security;

create policy partner_item_checks_admin_select on waytara.partner_item_checks for select to authenticated using (waytara.is_admin());
create policy partner_item_checks_admin_insert on waytara.partner_item_checks for insert to authenticated with check (waytara.is_admin());
create policy partner_item_checks_admin_update on waytara.partner_item_checks for update to authenticated using (waytara.is_admin()) with check (waytara.is_admin());

create policy partner_screening_calls_admin_select on waytara.partner_screening_calls for select to authenticated using (waytara.is_admin());
-- an admin can only log a call as themselves
create policy partner_screening_calls_admin_insert on waytara.partner_screening_calls for insert to authenticated with check (waytara.is_admin() and called_by = auth.uid());

revoke all on waytara.partner_item_checks from anon, authenticated;
revoke all on waytara.partner_screening_calls from anon, authenticated;
grant select, insert, update on waytara.partner_item_checks to authenticated;
grant select, insert on waytara.partner_screening_calls to authenticated;
grant all on waytara.partner_item_checks to service_role;
grant all on waytara.partner_screening_calls to service_role;

-- documents: who they belong to, and the new kinds
alter table waytara.partner_documents add column if not exists subject text not null default 'partner';
alter table waytara.partner_documents drop constraint if exists partner_documents_subject_valid;
alter table waytara.partner_documents add constraint partner_documents_subject_valid check (subject = 'partner' or subject ~ '^(member|category):[A-Za-z0-9_-]{1,40}$');
alter table waytara.partner_documents drop constraint if exists partner_documents_kind_valid;
alter table waytara.partner_documents
  add constraint partner_documents_kind_valid check (kind in ('licence', 'registration', 'identity', 'insurance', 'certificate', 'work_photo', 'other', 'kyc', 'bank_proof', 'survey_record'));

comment on table waytara.partner_item_checks is 'Verification of one item of a partner application, or of one of the partner''s team members (subject member:<id>).';
comment on table waytara.partner_screening_calls is 'Append-only log of screening calls made to an applicant.';
comment on column waytara.partner_documents.subject is 'Whose document it is: partner, member:<id> (a team member) or category:<name> (past work).';
