-- EV chargers that connect to a monitoring unit's own Wi-Fi instead of the internet. The unit passes the charger's OCPP messages to the hub
-- (sealed, up/ocpp and dn/ocpp); this table says which charger equipment a charger name belongs to, per unit, so a unit can only speak for the
-- chargers that were added to it.

create table if not exists waytara.gateway_chargers (
  id uuid primary key default gen_random_uuid(),
  gateway_equipment_id uuid not null references waytara.equipment(id) on delete cascade,
  charger_equipment_id uuid not null references waytara.equipment(id) on delete cascade,
  charge_point_id text not null check (charge_point_id ~ '^[A-Za-z0-9._:-]{1,64}$'),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (gateway_equipment_id, charge_point_id),
  unique (charger_equipment_id)
);

alter table waytara.gateway_chargers enable row level security;

drop policy if exists gateway_chargers_select on waytara.gateway_chargers;
create policy gateway_chargers_select on waytara.gateway_chargers
  for select to authenticated
  using (exists (select 1 from waytara.equipment e where e.id = gateway_equipment_id and waytara.can_access_site(e.site_id)));

grant select on waytara.gateway_chargers to authenticated, service_role;

comment on table waytara.gateway_chargers is 'EV chargers added to a monitoring unit: the charger name in ws://<unit>/ocpp/<name> and the charger equipment it stands for. Written only through the gw_*gateway_charger functions.';

-- may this person manage this unit (and its chargers), and as whom: 'staff' or 'owner'
create or replace function waytara.gw_gateway_access(p_actor uuid, p_equipment uuid)
returns text
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_role text;
begin
  perform waytara._require_gateway_service();
  select e.site_id into v_site from waytara.equipment e where e.id = p_equipment;
  if v_site is null or not waytara.can_access_site_as(p_actor, v_site) then
    return null;
  end if;
  select me.role::text into v_role from waytara.profiles me where me.id = p_actor;
  return case when v_role in ('admin', 'employee', 'site_engineer') then 'staff' else 'owner' end;
end;
$$;

-- the charger equipment of a unit's charger name, or null
create or replace function waytara.gw_gateway_charger(p_gateway uuid, p_cp text)
returns uuid
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  v uuid;
begin
  perform waytara._require_gateway_service();
  select g.charger_equipment_id into v from waytara.gateway_chargers g where g.gateway_equipment_id = p_gateway and g.charge_point_id = p_cp;
  return v;
end;
$$;

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

create or replace function waytara.gw_gateway_chargers(p_gateway uuid)
returns table (out_equipment_id uuid, out_charge_point_id text, out_label text)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return query
    select g.charger_equipment_id, g.charge_point_id, e.label
      from waytara.gateway_chargers g join waytara.equipment e on e.id = g.charger_equipment_id
     where g.gateway_equipment_id = p_gateway
     order by g.created_at;
end;
$$;

create or replace function waytara.gw_remove_gateway_charger(p_gateway uuid, p_cp text)
returns boolean
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  n int;
begin
  perform waytara._require_gateway_service();
  delete from waytara.gateway_chargers where gateway_equipment_id = p_gateway and charge_point_id = p_cp;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'gw_gateway_access(uuid, uuid)',
    'gw_gateway_charger(uuid, text)',
    'gw_add_gateway_charger(uuid, uuid, text, text, uuid)',
    'gw_gateway_chargers(uuid)',
    'gw_remove_gateway_charger(uuid, text)'
  ] loop
    execute format('revoke all on function waytara.%s from public, anon', f);
    execute format('grant execute on function waytara.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- To undo: drop the five functions above, then drop table waytara.gateway_chargers (the charger equipment it created stays).
