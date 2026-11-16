-- WayTara Partner Network: the public directory of authorised partners (shown on the /partner map).
--
-- Additive. An admin ticks "Show in the public directory" on an APPROVED application; only then does the partner appear, and only with the business name, the kind of
-- partner and the districts they cover (never a phone number, e-mail, notes or answers). Nothing is listed by default, so the directory starts empty and the page says
-- "be the first partner in this district" until an admin lists someone.

alter table waytara.partner_applications
  add column if not exists listed_publicly boolean not null default false;

-- Only an approved application can be listed (the admin action clears the tick whenever it moves an application out of 'approved').
alter table waytara.partner_applications
  add constraint partner_applications_listed_needs_approval check (not listed_publicly or status = 'approved');

comment on column waytara.partner_applications.listed_publicly is 'True when an admin has chosen to show this approved partner in the public directory on the Partner Network page.';

-- What the public page may read: one row per listed partner. The districts are the main one first, then the others they cover (the form stores them as "Main; also A, B").
create or replace function waytara.list_authorized_partners()
returns table (name text, partner_type text, districts text[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.company_name,
    coalesce(p.partner_type, 'contractor'),
    array_prepend(
      split_part(coalesce(p.cities, ''), '; also ', 1),
      coalesce(string_to_array(nullif(split_part(coalesce(p.cities, ''), '; also ', 2), ''), ', '), '{}'::text[])
    )
  from waytara.partner_applications p
  where p.status = 'approved' and p.listed_publicly
  order by p.company_name
$$;

revoke all on function waytara.list_authorized_partners() from public;
grant execute on function waytara.list_authorized_partners() to anon, authenticated, service_role;
