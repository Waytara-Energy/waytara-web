-- WayTara Partner Network: the Udyam check and DigiLocker identity (Cashfree Secure ID). Additive: nothing existing is removed or renamed.
--
-- 1. partner_verifications.kind also accepts 'udyam' (the Udyam number is real and not cancelled) and 'digilocker' (the person was verified through DigiLocker and what they typed
--    matches). The rows are the same shape as the other automatic checks, so the admin pages show and accept them the same way.
-- 2. partner_digilocker: the latest DigiLocker session of a person and, once they have agreed on DigiLocker's own page, what it gave back. It holds the NAME, DATE OF BIRTH, GENDER
--    and ADDRESS the person's DigiLocker account states, and the LAST FOUR DIGITS of the Aadhaar number, and nothing else: never the full Aadhaar number, never the photo, never
--    the XML or any copy of the card. (The photo is used once, to compare with the selfie, and thrown away.)
--
-- subject  'partner', or 'member:<id>' for a person on the team
-- status   pending (the link was made, nothing agreed yet), authenticated (agreed; the details are in), expired (the ten-minute link ran out), consent_denied (they said no),
--          failed (DigiLocker or Cashfree could not give the document)
--
-- Written by the servers of the two apps only. Admins read it. Deleted with its application.

alter table waytara.partner_verifications drop constraint if exists partner_verifications_kind_check;
alter table waytara.partner_verifications
  add constraint partner_verifications_kind_check
  check (kind in ('pan', 'gstin', 'bank', 'name_match', 'face_match', 'face_liveness', 'udyam', 'digilocker'));

create table if not exists waytara.partner_digilocker (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references waytara.partner_applications (id) on delete cascade,
  subject         text not null check (subject = 'partner' or subject ~ '^member:[A-Za-z0-9_-]{1,40}$'),
  -- the id we gave Cashfree for this session (we poll with it) and Cashfree's own reference
  verification_id text not null check (verification_id ~ '^[A-Za-z0-9._-]{8,50}$'),
  reference_id    text check (reference_id is null or length(reference_id) <= 40),
  status          text not null default 'pending' check (status in ('pending', 'authenticated', 'expired', 'consent_denied', 'failed')),
  -- what DigiLocker stated (name, dob, gender, address parts, last four digits); empty until they have agreed
  identity        jsonb not null default '{}'::jsonb,
  uid_last4       text check (uid_last4 is null or uid_last4 ~ '^[0-9]{4}$'),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '10 minutes'),
  completed_at    timestamptz,
  unique (application_id, subject)
);

alter table waytara.partner_digilocker enable row level security;

create policy partner_digilocker_admin_select on waytara.partner_digilocker for select to authenticated using (waytara.is_admin());

revoke all on waytara.partner_digilocker from anon, authenticated;
grant select on waytara.partner_digilocker to authenticated;
grant all on waytara.partner_digilocker to service_role;

comment on table waytara.partner_digilocker is 'Latest DigiLocker identity session per partner and person: the stated name, date of birth, gender and address and the last four Aadhaar digits only (no number, photo or card). Servers write; admins read. Deleted with the application.';
