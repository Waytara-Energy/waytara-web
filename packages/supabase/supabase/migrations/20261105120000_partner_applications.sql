-- Partner programme: installers across India apply from the public /partner page, and the admins review them in the admin app.
--
-- Public visitors can only INSERT a plain 'new' application (same pattern as waytara.leads): they can never read one back, set a status,
-- or write admin notes. Only an admin can read and update applications. Nothing here deletes a row.

create table if not exists waytara.partner_applications (
  id                uuid primary key default gen_random_uuid(),
  company_name      text not null,
  contact_name      text not null,
  phone             text not null,
  email             text not null,
  website           text,
  -- where they work: states or union territories, and any cities or districts they want to name
  states            text[] not null default '{}',
  cities            text,
  -- what they do: any of solar, battery, ev_charger, ems_integration, maintenance
  services          text[] not null default '{}',
  years_in_business integer,
  installs_completed text,
  team_size         text,
  certifications    text,
  message           text,
  -- how the admins are handling it
  status            text not null default 'new',
  admin_notes       text,
  reviewed_by       uuid references waytara.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint partner_applications_status_valid check (status in ('new', 'in_review', 'approved', 'rejected')),
  constraint partner_applications_field_lengths check (
    char_length(company_name) between 1 and 200
    and char_length(contact_name) between 1 and 200
    and char_length(phone) between 6 and 32
    and char_length(email) between 3 and 320
    and (website is null or char_length(website) <= 300)
    and (cities is null or char_length(cities) <= 1000)
    and (installs_completed is null or char_length(installs_completed) <= 64)
    and (team_size is null or char_length(team_size) <= 64)
    and (certifications is null or char_length(certifications) <= 1000)
    and (message is null or char_length(message) <= 5000)
    and (admin_notes is null or char_length(admin_notes) <= 5000)
    and cardinality(states) <= 40
    and cardinality(services) <= 10
  ),
  constraint partner_applications_years_valid check (years_in_business is null or years_in_business between 0 and 100)
);

create index if not exists partner_applications_status_created_idx on waytara.partner_applications (status, created_at desc);

alter table waytara.partner_applications enable row level security;

-- Visitors (logged out or in) may only submit a plain new application: never a pre-reviewed one, and never with admin notes.
create policy partner_applications_public_insert on waytara.partner_applications
  for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null and reviewed_by is null and reviewed_at is null);

create policy partner_applications_admin_select on waytara.partner_applications
  for select to authenticated
  using (waytara.is_admin());

create policy partner_applications_admin_update on waytara.partner_applications
  for update to authenticated
  using (waytara.is_admin())
  with check (waytara.is_admin());

-- Table privileges: anon may only insert. The app's signed-in role may insert (a signed-in visitor), select and update (RLS then limits those two to admins).
revoke all on waytara.partner_applications from anon, authenticated;
grant insert on waytara.partner_applications to anon;
grant select, insert, update on waytara.partner_applications to authenticated;
grant all on waytara.partner_applications to service_role;

create trigger partner_applications_set_updated_at
  before update on waytara.partner_applications
  for each row execute function waytara.set_updated_at();

-- Who changed what, the same as for leads.
create trigger trg_audit_partner_applications
  after insert or update or delete on waytara.partner_applications
  for each row execute function waytara.log_activity();

-- Live refresh of the admin list when an application arrives.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'waytara' and tablename = 'partner_applications'
  ) then
    alter publication supabase_realtime add table waytara.partner_applications;
  end if;
end $$;

comment on table waytara.partner_applications is
  'Installer applications from the public /partner page. Insert-only for visitors; read and update for admins only.';
