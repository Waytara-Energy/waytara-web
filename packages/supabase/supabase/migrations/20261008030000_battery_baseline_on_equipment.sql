-- The battery's size, rated cycles and end of life live on its STOCK record (equipment_inventory), and the battery is
-- allocated to the customer as child equipment, so a separate battery_profiles table is not needed. What the stock record
-- cannot hold is per-unit: the inverter's lifetime discharge counter on the day THIS battery was installed, so a replaced
-- battery starts again from zero cycles. That belongs to the allocated equipment row.
--
--   equipment.discharged_baseline_kwh   the inverter's lifetime discharge (kWh) when this battery was allocated; null = 0
--
-- waytara.assign_child_equipment() now records it automatically for a battery (the parent's counter at that moment).

alter table waytara.equipment add column if not exists discharged_baseline_kwh numeric check (discharged_baseline_kwh is null or discharged_baseline_kwh >= 0);
comment on column waytara.equipment.discharged_baseline_kwh is 'For a battery: the parent inverter''s lifetime discharge counter (kWh) when it was installed, so cycles count from here; null = 0.';

drop table if exists waytara.battery_profiles;

create or replace function waytara.assign_child_equipment(p_parent uuid, p_stock uuid, p_quantity integer default 1, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_available integer;
  v_category text;
  v_baseline numeric;
  v_id uuid;
begin
  if not waytara.is_staff() then
    raise exception 'only staff can allocate equipment' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be at least 1' using errcode = '22023';
  end if;
  select site_id into v_site from waytara.equipment where id = p_parent;
  if not found then
    raise exception 'parent device not found' using errcode = '22023';
  end if;
  select quantity, category into v_available, v_category from waytara.equipment_inventory where id = p_stock for update;
  if not found then
    raise exception 'stock item not found' using errcode = '22023';
  end if;
  if waytara.is_monitored_category(v_category) then
    raise exception 'inverters and chargers are added as devices, not as child equipment' using errcode = '22023';
  end if;
  if v_available < p_quantity then
    raise exception 'only % in stock', v_available using errcode = '22023';
  end if;

  -- A battery's cycles count from the inverter's discharge counter as it stands now.
  if v_category = 'Batteries' then
    select value into v_baseline from waytara.equipment_latest where equipment_id = p_parent and key_name = 'total_battery_discharge_energy_kwh';
  end if;

  insert into waytara.equipment (site_id, stock_id, label, device_status, parent_id, quantity, discharged_baseline_kwh)
  values (v_site, p_stock, nullif(trim(p_label), ''), 'active', p_parent, p_quantity, v_baseline)
  returning id into v_id;

  update waytara.equipment_inventory
     set quantity = quantity - p_quantity,
         status = case when quantity - p_quantity = 0 then 'allocated' else status end
   where id = p_stock;
  return v_id;
end;
$$;

revoke all on function waytara.assign_child_equipment(uuid, uuid, integer, text) from public, anon;
grant execute on function waytara.assign_child_equipment(uuid, uuid, integer, text) to authenticated, service_role;
