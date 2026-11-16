-- WayTara Partner Network: the e-mail code that proves an applicant owns the address they applied with. They ask for a code on the start page, type it, and only then
-- choose a password and get an account. At most one live code per application (a new one replaces the old). Only a HASH of the code is stored, a code lives 10 minutes,
-- and gets 5 tries. When the code is right, a one-time proof (also hashed) is stored, which the account step must present.
--
-- Written and read only by the website's server (its own key): no policy and no grant for the public or signed-in roles, so nobody can read or guess a code from the
-- database or the API. Deleted with its application. Additive.

create table if not exists waytara.partner_login_codes (
  application_id   uuid primary key references waytara.partner_applications (id) on delete cascade,
  code_hash        text not null,
  expires_at       timestamptz not null,
  attempts         integer not null default 0,
  last_sent_at     timestamptz not null default now(),
  proof_hash       text,
  proof_expires_at timestamptz,
  created_at       timestamptz not null default now()
);

alter table waytara.partner_login_codes enable row level security;
revoke all on waytara.partner_login_codes from anon, authenticated;
grant all on waytara.partner_login_codes to service_role;

comment on table waytara.partner_login_codes is 'E-mail one-time codes for partner applicants (hashed, 10 minutes, 5 tries). Server-only: no policy for any login.';
