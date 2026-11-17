-- WayTara Partner Network: the result of each automatic check (Cashfree Secure ID) on a partner's PAN, GST number, bank account, face and names. One row per application,
-- person and kind of check: the latest result, how many times it was asked for, and what it was asked about (a fingerprint of the inputs, so a result is shown as out of
-- date once the partner changes what was checked). Additive: nothing existing is changed.
--
-- subject  'partner', or 'member:<id>' for a person on the team (their face checks)
-- kind     pan, gstin, bank, name_match (PAN holder against the bank account holder), face_match (selfie against the photo ID), face_liveness (the selfie is a live face)
-- status   passed (the check passed), review (answered, but a person must look: a partial name match, a low score), failed (the number is not valid, no match), error
--          (the service could not answer: nothing was decided, ask again)
-- summary  one line for the admin; detail is the service's answer with anything sensitive left out. Neither is ever shown to the partner beyond a plain verdict.
--
-- Written by the servers of the two apps (the website runs a check when the partner asks for one or sends their onboarding; an admin may run one again). Only admins read
-- it. Deleted with its application.

create table if not exists waytara.partner_verifications (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  subject        text not null check (subject = 'partner' or subject ~ '^member:[A-Za-z0-9_-]{1,40}$'),
  kind           text not null check (kind in ('pan', 'gstin', 'bank', 'name_match', 'face_match', 'face_liveness')),
  status         text not null check (status in ('passed', 'review', 'failed', 'error')),
  summary        text not null default '' check (length(summary) <= 400),
  detail         jsonb not null default '{}'::jsonb,
  provider       text not null default 'cashfree',
  provider_ref   text check (provider_ref is null or length(provider_ref) <= 80),
  -- sha-256 of the inputs the check was made on
  input_hash     text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  -- how many times the PARTNER asked for it (capped by the website, so the check cannot be used to look up other people's numbers)
  partner_attempts integer not null default 0,
  run_by         uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (application_id, subject, kind)
);

alter table waytara.partner_verifications enable row level security;

create policy partner_verifications_admin_select on waytara.partner_verifications for select to authenticated using (waytara.is_admin());
create policy partner_verifications_admin_insert on waytara.partner_verifications for insert to authenticated with check (waytara.is_admin());
create policy partner_verifications_admin_update on waytara.partner_verifications for update to authenticated using (waytara.is_admin()) with check (waytara.is_admin());

revoke all on waytara.partner_verifications from anon, authenticated;
grant select, insert, update on waytara.partner_verifications to authenticated;
grant all on waytara.partner_verifications to service_role;

comment on table waytara.partner_verifications is 'Latest automatic check result per partner, person and kind (Cashfree Secure ID). Servers write; admins read and may re-run. Deleted with the application.';
