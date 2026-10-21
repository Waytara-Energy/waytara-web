-- Which device a monitoring unit belongs to, for the setup page (task T19 of docs/GATEWAY_V3_TASKS.md).
--
-- The page finds a unit over Bluetooth and knows only its hardware id. Staff can read gateway_devices; a customer cannot, but a customer must be
-- able to open the unit at their own site. This function answers for the signed-in person only: the device, its name and its site, and only when
-- that person may see the site. An unknown unit and a unit at somebody else's site give the same answer (no row), so nothing is revealed.

create or replace function waytara.my_unit_by_hardware(p_hardware_id text)
returns table (equipment_id uuid, label text, site_id uuid, site_name text, fw_version text)
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select e.id, coalesce(nullif(btrim(e.label), ''), i.name, 'Device'), s.id, s.name, d.fw_version
    from waytara.gateway_devices d
    join waytara.equipment e on e.id = d.equipment_id
    join waytara.sites s on s.id = e.site_id
    left join waytara.equipment_inventory i on i.id = e.stock_id
   where auth.uid() is not null
     and d.hardware_id = upper(btrim(p_hardware_id))
     and waytara.can_access_site(s.id);
$$;

revoke all on function waytara.my_unit_by_hardware(text) from public, anon;
grant execute on function waytara.my_unit_by_hardware(text) to authenticated;

-- To undo: drop function waytara.my_unit_by_hardware(text);
