-- Reverses 20260911000000_split_shared_site_on_customer_edit.sql.
--
-- Product decision (explicit, overrides that migration's own reasoning):
-- a site's own details (name/property type/power source/power
-- package/address/coordinates) are common to every device installed at
-- that site, by definition — editing them from any one device's Site
-- Setting tab should update that one shared row for every device there,
-- not fork a device-specific copy. The split behavior surprised a real
-- customer in production: editing one device's site address silently
-- created a second site with an identical name and no visible way to
-- tell the two apart, while the sibling device was left on the original.
--
-- Each device's own individual settings (My Settings, OCPP Configuration,
-- Smart Charging, Time of Use, ...) already live entirely outside this
-- function (equipment_configs, written by updateDeviceSetting/
-- updateInstrumentSetting) — this function only ever touched `sites` and
-- `equipment.site_id`, and now only ever touches `sites`.
create or replace function waytara.update_device_site(
  p_device_id uuid,
  p_name text,
  p_property_type waytara.property_type,
  p_power_source_category waytara.power_source_category,
  p_address jsonb,
  p_power_package waytara.power_package default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'waytara', 'public', 'pg_temp'
as $function$
declare
  v_customer_id uuid;
  v_site_id uuid;
begin
  select s.customer_id, s.id
    into v_customer_id, v_site_id
  from waytara.equipment e
  join waytara.sites s on s.id = e.site_id
  where e.id = p_device_id;

  if v_customer_id is null or v_customer_id != auth.uid() then
    raise exception 'Not authorized for this device.';
  end if;

  update waytara.sites
  set name = p_name,
      property_type = p_property_type,
      power_source_category = p_power_source_category,
      address = p_address,
      power_package = p_power_package,
      latitude = p_latitude,
      longitude = p_longitude
  where id = v_site_id;

  return v_site_id;
end;
$function$;

comment on function waytara.update_device_site is
  'Updates the site a device belongs to IN PLACE, for every device sharing that site - deliberately does not fork/split a new site, even when the site has multiple devices (see this migration''s own header comment for why, and 20260911000000 for the prior, reversed behavior).';
