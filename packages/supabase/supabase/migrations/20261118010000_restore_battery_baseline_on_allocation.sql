-- Restore the battery's discharge baseline when equipment is allocated under an inverter.
--
-- 20261008030000 made waytara.assign_child_equipment() record, for a battery, the parent inverter's lifetime discharge counter (total_battery_discharge_energy_kwh)
-- on the new equipment row (equipment.discharged_baseline_kwh), so a battery's cycles count from the day IT was installed and a replaced battery starts again from zero.
-- 20261030000000 (stock units) rewrote the function to draw from stock units and DROPPED that step: since then a battery allocated under an inverter gets no baseline
-- (null = 0), so its cycles are counted from the inverter's whole lifetime. The database test 10_equipment_children caught it ("a battery remembers the inverter's
-- discharge counter from the day it was allocated") once CI could run it again.
--
-- This is the stock-units version of the function, unchanged except for the baseline: it is read for a battery (category 'Batteries') from the parent's latest counter and
-- written on every equipment row the allocation creates. Batteries allocated since 20261030000000 have no baseline and cannot be corrected here (the counter's value on
-- the day they were installed was not kept); they can be set by hand on the equipment row if their installation day is known.

create or replace function waytara.assign_child_equipment(p_parent uuid, p_stock uuid, p_quantity integer default 1, p_label text default null, p_unit uuid default null)
returns uuid
language plpgsql security definer set search_path = waytara, pg_temp as $$
declare
  v_site uuid;
  v_customer uuid;
  v_category text;
  v_tracking text;
  v_baseline numeric;
  v_need integer := p_quantity;
  v_id uuid;
  v_first uuid;
  u record;
  v_take integer;
begin
  if not waytara.is_staff() then raise exception 'only staff can allocate equipment' using errcode = '42501'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'quantity must be at least 1' using errcode = '22023'; end if;
  select e.site_id, s.customer_id into v_site, v_customer from waytara.equipment e join waytara.sites s on s.id = e.site_id where e.id = p_parent;
  if not found then raise exception 'parent device not found' using errcode = '22023'; end if;
  select category, tracking into v_category, v_tracking from waytara.equipment_inventory where id = p_stock for update;
  if not found then raise exception 'stock item not found' using errcode = '22023'; end if;
  if waytara.is_monitored_category(v_category) then
    raise exception 'inverters and chargers are added as devices, not as child equipment' using errcode = '22023';
  end if;

  -- A battery's cycles count from the inverter's discharge counter as it stands now.
  if v_category = 'Batteries' then
    select value into v_baseline from waytara.equipment_latest where equipment_id = p_parent and key_name = 'total_battery_discharge_energy_kwh';
  end if;

  if v_tracking = 'serial' then
    if p_unit is null then raise exception 'pick the serial number' using errcode = '22023'; end if;
    if p_quantity <> 1 then raise exception 'a serial-numbered item is added one at a time' using errcode = '22023'; end if;
    select * into u from waytara.stock_units where id = p_unit and model_id = p_stock for update;
    if not found then raise exception 'that serial number is not in stock for this item' using errcode = '22023'; end if;
    if u.status = 'reserved' and u.customer_id is distinct from v_customer then raise exception 'this unit is reserved for another customer' using errcode = '22023'; end if;
    if u.status not in ('in_stock', 'reserved') then raise exception 'this unit is % and cannot be installed', replace(u.status, '_', ' ') using errcode = '22023'; end if;
    insert into waytara.equipment (site_id, stock_id, stock_unit_id, label, device_status, parent_id, quantity, discharged_baseline_kwh)
    values (v_site, p_stock, p_unit, nullif(trim(p_label), ''), 'active', p_parent, 1, v_baseline) returning id into v_id;
    update waytara.stock_units set status = 'installed', customer_id = v_customer, site_id = v_site, installed_at = now() where id = p_unit;
    insert into waytara.stock_movements (model_id, unit_id, kind, from_status, to_status, customer_id, site_id, actor)
    values (p_stock, p_unit, 'installed', u.status, 'installed', v_customer, v_site, auth.uid());
    return v_id;
  end if;

  if (select coalesce(sum(remaining), 0) from waytara.stock_units where model_id = p_stock and status = 'in_stock') < p_quantity then
    raise exception 'only % in stock', (select coalesce(sum(remaining), 0) from waytara.stock_units where model_id = p_stock and status = 'in_stock') using errcode = '22023';
  end if;
  for u in select * from waytara.stock_units where model_id = p_stock and status = 'in_stock' and remaining > 0 order by created_at, id for update loop
    exit when v_need <= 0;
    v_take := least(u.remaining, v_need);
    insert into waytara.equipment (site_id, stock_id, stock_unit_id, label, device_status, parent_id, quantity, discharged_baseline_kwh)
    values (v_site, p_stock, u.id, nullif(trim(p_label), ''), 'active', p_parent, v_take, v_baseline) returning id into v_id;
    v_first := coalesce(v_first, v_id);
    update waytara.stock_units
       set remaining = remaining - v_take, status = case when remaining - v_take = 0 then 'used_up' else status end
     where id = u.id;
    insert into waytara.stock_movements (model_id, unit_id, kind, quantity, from_status, to_status, customer_id, site_id, actor)
    values (p_stock, u.id, 'installed', v_take, 'in_stock', case when u.remaining - v_take = 0 then 'used_up' else 'in_stock' end, v_customer, v_site, auth.uid());
    v_need := v_need - v_take;
  end loop;
  return v_first;
end $$;

revoke all on function waytara.assign_child_equipment(uuid, uuid, integer, text, uuid) from public, anon;
grant execute on function waytara.assign_child_equipment(uuid, uuid, integer, text, uuid) to authenticated, service_role;
