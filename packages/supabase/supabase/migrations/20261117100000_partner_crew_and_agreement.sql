-- WayTara Partner Network: three small tables for the second half of onboarding. Additive: nothing existing is changed.
--
-- partner_crew_invites   the link a partner sends to a person on their team so that person adds their own ID, live selfie and police verification from their phone.
--                        Only a HASH of the link's secret is stored (as with the applicant's own link), a link lives 14 days, and a new link for the same person replaces the
--                        old one (status 'revoked'). Written and read by the website's server; admins may read it to see who has opened theirs.
-- partner_agreements     the record that a partner accepted the WayTara Partner Agreement: which version, a hash of its exact text, who accepted and from which address,
--                        and when. One row per application and version. Admins read it; it is never edited.
-- partner_agreement_codes the e-mail code that signs the agreement (hashed, 10 minutes, 5 tries). Server only, like partner_login_codes.
--
-- All three are deleted with their application (on delete cascade), so deleting a partner removes them too.

create table if not exists waytara.partner_crew_invites (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  -- the id the team member's documents are filed under (see memberKey in partner-onboarding.ts)
  member_id      text not null check (member_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  token_hash     text not null unique,
  status         text not null default 'sent' check (status in ('sent', 'opened', 'completed', 'revoked')),
  -- how it was sent: 'email', or 'link' when the partner copied or shared it themselves
  sent_via       text not null default 'link' check (sent_via in ('email', 'link')),
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  opened_at      timestamptz,
  completed_at   timestamptz
);

create index if not exists partner_crew_invites_application_idx on waytara.partner_crew_invites (application_id, member_id);

create table if not exists waytara.partner_agreements (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  version        text not null check (length(version) between 1 and 60),
  -- sha-256 of the exact agreement text that was shown, so what was signed can always be shown to have been this
  text_hash      text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  signer_name    text not null check (length(signer_name) between 1 and 200),
  signer_email   text not null check (length(signer_email) between 3 and 320),
  signer_ip      text,
  signer_agent   text,
  signed_at      timestamptz not null default now(),
  unique (application_id, version)
);

create table if not exists waytara.partner_agreement_codes (
  application_id uuid primary key references waytara.partner_applications (id) on delete cascade,
  code_hash      text not null,
  expires_at     timestamptz not null,
  attempts       integer not null default 0,
  last_sent_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table waytara.partner_crew_invites enable row level security;
alter table waytara.partner_agreements enable row level security;
alter table waytara.partner_agreement_codes enable row level security;

create policy partner_crew_invites_admin_select on waytara.partner_crew_invites for select to authenticated using (waytara.is_admin());
create policy partner_agreements_admin_select on waytara.partner_agreements for select to authenticated using (waytara.is_admin());

revoke all on waytara.partner_crew_invites from anon, authenticated;
revoke all on waytara.partner_agreements from anon, authenticated;
revoke all on waytara.partner_agreement_codes from anon, authenticated;
grant select on waytara.partner_crew_invites to authenticated;
grant select on waytara.partner_agreements to authenticated;
grant all on waytara.partner_crew_invites to service_role;
grant all on waytara.partner_agreements to service_role;
grant all on waytara.partner_agreement_codes to service_role;

comment on table waytara.partner_crew_invites is 'Links a partner sends to team members so they add their own documents (token hashed, 14 days). Server writes; admins read.';
comment on table waytara.partner_agreements is 'Acceptance of the Partner Agreement by e-mail code: version, text hash, signer, address, time. Admins read; never edited.';
comment on table waytara.partner_agreement_codes is 'E-mail one-time codes that sign the Partner Agreement (hashed, 10 minutes, 5 tries). Server-only: no policy for any login.';
