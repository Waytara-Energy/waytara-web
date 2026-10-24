-- The live values of a charger (connector state, power, current, voltage, energy), written by the OCPP server of the backend.
--
-- The dashboard reads a charger's live figures from equipment_latest, as it does for an inverter. The OCPP server stored a charger's events,
-- sessions and meter samples but never these, so a real charger never showed live. gw_ev_set_latest writes them, as the backend's service user
-- only (like every other gw_* function): p_values is {"<key>": {"v": <number>, "u": "<unit>"}, ...}; a key that is not a known parameter of
-- the charger's own catalogue is ignored.

create or replace function waytara.gw_ev_set_latest(p_equipment uuid, p_values jsonb, p_ts timestamptz default null)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  k text;
  v jsonb;
begin
  perform waytara._require_gateway_service();
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;
  for k, v in select * from jsonb_each(coalesce(p_values, '{}'::jsonb)) loop
    if k not in ('connector_status', 'error_code', 'power_active_import_kw', 'current_import_l1_a', 'voltage_l1_n_v', 'energy_active_import_register_kwh') then
      continue;
    end if;
    if jsonb_typeof(v -> 'v') <> 'number' then
      continue;
    end if;
    insert into waytara.equipment_latest (equipment_id, key_name, value, unit, ts)
    values (p_equipment, k, (v ->> 'v')::numeric, nullif(v ->> 'u', ''), coalesce(p_ts, now()))
    on conflict (equipment_id, key_name) do update set value = excluded.value, unit = excluded.unit, ts = excluded.ts;
  end loop;
end;
$$;

revoke all on function waytara.gw_ev_set_latest(uuid, jsonb, timestamptz) from public, anon;
grant execute on function waytara.gw_ev_set_latest(uuid, jsonb, timestamptz) to authenticated, service_role;
