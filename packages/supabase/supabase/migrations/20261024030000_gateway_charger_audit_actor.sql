-- gw_add_gateway_charger wrote equipment as the backend's service user, which the audit trigger (auth.uid() -> audit_log.actor_id -> profiles) refuses.
-- The function now acts as the person who asked for the charger, so the audit trail names them.

-- Adds a charger to a unit: a new charger equipment at the unit's site, or (staff only) an existing charger moved to that site.
create or replace function waytara.gw_add_gateway_charger(p_gateway uuid, p_actor uuid, p_cp text, p_label text, p_existing uuid default null)
returns table (out_equipment_id uuid, out_charge_point_id text, out_label text)
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_role text;
  v_eq uuid;
  v_stock uuid;
  v_label text;
begin
  perform waytara._require_gateway_service();
  -- the audit trigger records who changed the equipment as auth.uid(): this is the person who asked, not the backend's service user
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor::text)::text, true);
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  if p_cp is null or p_cp !~ '^[A-Za-z0-9._:-]{1,64}$' then
    raise exception 'The charger name is not valid' using errcode = '22023';
  end if;
  select e.site_id into v_site from waytara.equipment e where e.id = p_gateway;
  if v_site is null or not waytara.can_access_site_as(p_actor, v_site) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select me.role::text into v_role from waytara.profiles me where me.id = p_actor;

  if p_existing is not null then
    if v_role not in ('admin', 'employee', 'site_engineer') then
      raise exception 'Only staff can move an existing charger' using errcode = '42501';
    end if;
    select e.id, e.label into v_eq, v_label
      from waytara.equipment e join waytara.equipment_inventory i on i.id = e.stock_id
     where e.id = p_existing and i.category::text = 'ev_charger';
    if v_eq is null then
      raise exception 'That is not a charger' using errcode = 'P0002';
    end if;
    if exists (select 1 from waytara.gateway_chargers g where g.charger_equipment_id = v_eq) then
      raise exception 'That charger is already added to a unit' using errcode = '23505';
    end if;
    update waytara.equipment set site_id = v_site, updated_at = now() where id = v_eq;
  else
    select i.id into v_stock from waytara.equipment_inventory i where i.category::text = 'ev_charger' order by i.id limit 1;
    if v_stock is null then
      raise exception 'No charger model is set up yet' using errcode = 'P0002';
    end if;
    v_label := coalesce(nullif(btrim(p_label), ''), 'EV charger');
    insert into waytara.equipment (site_id, stock_id, label, device_status)
    values (v_site, v_stock, v_label, 'active')
    returning id into v_eq;
  end if;

  insert into waytara.gateway_chargers (gateway_equipment_id, charger_equipment_id, charge_point_id, created_by)
  values (p_gateway, v_eq, p_cp, p_actor);
  return query select v_eq, p_cp, v_label;
end;
$$;


-- To undo: re-run the function from 20261024020000_gateway_chargers.sql.
