-- Real bug: `sites` belongs to `customer_id`, not to any one device, so
-- when an admin groups several devices under one site during onboarding
-- (a legitimate way to represent devices genuinely co-located at the same
-- property), a customer editing that site's name/address/etc. from one
-- device's "Site Setting" tab silently changes it for every sibling
-- device on that same site too — there was no way to make one device's
-- site details diverge from the group.
--
-- Product decision: every device's site details should always be
-- independently editable. Rather than a one-time data migration
-- (touching devices nobody's looked at yet), this fixes it lazily: the
-- moment someone actually edits a device's site details, and that site is
-- currently shared, this splits it into a fresh site scoped to just that
-- device — a clone of the old one, overwritten with the submitted values.
-- Every other device already on that site is left exactly as it was,
-- still grouped together, until one of *them* gets edited too. A site
-- that's already sole-owned by one device just updates in place, same as
-- the plain UPDATE this replaces.
--
-- SECURITY DEFINER is required because reassigning devices.site_id is
-- deliberately not customer-grantable (see
-- 20260902010000_site_and_device_customer_update.sql's own reasoning —
-- site_id should never move as a side effect of an unrelated write). This
-- function is the one narrow, intentional exception: a customer splitting
-- their own device off onto a brand-new site that they themselves just
-- created is safe, and is exactly (and only) what this does — every path
-- still goes through an explicit ownership check against auth.uid()
-- before touching anything, and the underlying column grant stays locked
-- down for every other caller.
create or replace function waytara.update_device_site(
  p_device_id uuid,
  p_name text,
  p_property_type waytara.property_type,
  p_power_source_category waytara.power_source_category,
  p_address jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'waytara', 'public', 'pg_temp'
as $function$
declare
  v_customer_id uuid;
  v_site_id uuid;
  v_sibling_count int;
  v_target_site_id uuid;
begin
  select s.customer_id, s.id
    into v_customer_id, v_site_id
  from waytara.devices d
  join waytara.sites s on s.id = d.site_id
  where d.id = p_device_id;

  if v_customer_id is null or v_customer_id != auth.uid() then
    raise exception 'Not authorized for this device.';
  end if;

  select count(*) into v_sibling_count
  from waytara.devices
  where site_id = v_site_id and id != p_device_id;

  if v_sibling_count = 0 then
    update waytara.sites
    set name = p_name,
        property_type = p_property_type,
        power_source_category = p_power_source_category,
        address = p_address
    where id = v_site_id;

    v_target_site_id := v_site_id;
  else
    insert into waytara.sites (customer_id, name, property_type, power_source_category, address)
    values (v_customer_id, p_name, p_property_type, p_power_source_category, p_address)
    returning id into v_target_site_id;

    update waytara.devices set site_id = v_target_site_id where id = p_device_id;
  end if;

  return v_target_site_id;
end;
$function$;

grant execute on function waytara.update_device_site(uuid, text, waytara.property_type, waytara.power_source_category, jsonb) to authenticated;
