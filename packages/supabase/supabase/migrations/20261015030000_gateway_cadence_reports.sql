-- Task A5: what the backend needs to serve cadence reports.
--
--   gw_cadence_access     may this person read the cadence data of this equipment, and as whom ('staff' sees every register,
--                         'customer' only those shown to customers)? A customer needs a plan with the "reports" feature.
--   gw_equipment_profile  now also carries each metric's display name and unit, so a downloaded file has readable column names
--
-- Callable only by the registered backend identity. Rollback is at the bottom of this file.

create or replace function waytara.gw_cadence_access(p_actor uuid, p_equipment uuid)
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
  if v_role in ('admin', 'employee', 'site_engineer') then
    return 'staff';
  end if;

  -- the owner of the site: only on a plan that includes reports
  if exists (
    select 1
    from waytara.customers c
    join waytara.plans p on p.id = c.plan_id
    where c.id = p_actor and coalesce((p.features ->> 'reports')::boolean, false)
  ) then
    return 'customer';
  end if;
  return null;
end;
$$;

create or replace function waytara.gw_equipment_profile(p_equipment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_result jsonb;
begin
  perform waytara._require_gateway_service();

  select jsonb_build_object(
    'upload_interval_s', coalesce(s.upload_interval_s, 900),
    'unreadable_registers', to_jsonb(coalesce(s.unreadable_registers, '{}'::integer[])),
    'mppt_count', case when (i.technical_specs ->> 'mppt_count') ~ '^[0-9]{1,3}$' then (i.technical_specs ->> 'mppt_count')::integer end,
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', m.key_name,
               'direction', m.direction,
               'registers', coalesce(m.address -> 'registers', '[]'::jsonb),
               'decode', m.decode,
               'enum_ref', m.enum_ref,
               'value_kind', t.value_kind,
               'valid_min', m.valid_min,
               'valid_max', m.valid_max,
               'cadence_seconds', m.cadence_seconds,
               'show_for_user', m.show_for_user,
               'poll_enabled', m.poll_enabled,
               'verified', m.is_verified,
               'label', t.display_name,
               'unit', t.unit,
               'category', m.category
             ) order by m.key_name, m.direction)
      from waytara.equipment_metrics m
      left join waytara.equipment_templates t on t.device_category = m.device_category and t.key_name = m.key_name
      where m.equipment_id = p_equipment
    ), '[]'::jsonb)
  )
  into v_result
  from waytara.equipment e
  left join waytara.equipment_inventory i on i.id = e.stock_id
  left join waytara.gateway_equipment_settings s on s.equipment_id = e.id
  where e.id = p_equipment;

  return v_result;   -- null when the equipment does not exist
end;
$$;

revoke all on function waytara.gw_cadence_access(uuid, uuid) from public, anon;
grant execute on function waytara.gw_cadence_access(uuid, uuid) to authenticated, service_role;

-- Rollback:
--   drop function if exists waytara.gw_cadence_access(uuid, uuid);
--   and re-run 20261015020000_gateway_ingest.sql to restore the previous gw_equipment_profile.
