-- A site's property type, power package and power source decide what the energy flow diagram and the reports assume, so a customer must
-- not change them (the customer app shows them read-only). Only staff do, from the admin app under the customer.
--
-- The customer app already stopped sending them, but a signed-in customer could still call the database directly: the sites UPDATE grant
-- covers these columns and update_device_site() writes them. A trigger closes both doors at once: any change to one of the three
-- columns is refused unless the caller is staff. Service-role and migration work (no signed-in user) is unaffected.

create or replace function waytara.is_staff()
returns boolean
language sql
stable
security definer
set search_path = waytara, public
as $function$
  select exists (
    select 1 from waytara.profiles
    where id = auth.uid() and role::text in ('admin', 'employee', 'site_engineer')
  );
$function$;

create or replace function waytara.sites_guard_staff_only_fields()
returns trigger
language plpgsql
set search_path = waytara, public
as $function$
begin
  if auth.uid() is not null
     and (new.property_type is distinct from old.property_type
          or new.power_source_category is distinct from old.power_source_category
          or new.power_package is distinct from old.power_package)
     and not waytara.is_staff() then
    raise exception 'The property type, power source and power package can only be changed by WayTara staff.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists sites_guard_staff_only_fields on waytara.sites;
create trigger sites_guard_staff_only_fields
  before update on waytara.sites
  for each row execute function waytara.sites_guard_staff_only_fields();

comment on function waytara.sites_guard_staff_only_fields is
  'Refuses a customer changing property_type, power_source_category or power_package on a site; staff (admin, employee, site_engineer) may.';
