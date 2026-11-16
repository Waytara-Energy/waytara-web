-- WayTara Partner Network: which sign-in account belongs to which application. Set when an approved applicant creates their password. One account per application
-- and one application per account (unique). If the account is ever deleted, the application keeps existing (set null).
--
-- Additive: two nullable columns.

alter table waytara.partner_applications
  add column if not exists profile_id uuid references waytara.profiles (id) on delete set null,
  add column if not exists account_created_at timestamptz;

create unique index if not exists partner_applications_profile_key on waytara.partner_applications (profile_id) where profile_id is not null;

comment on column waytara.partner_applications.profile_id is 'The partner''s sign-in account (role partner), created when they set a password from their approval link.';
comment on column waytara.partner_applications.account_created_at is 'When the partner created their account.';
