-- Part B: what the backend's OCPP server (EV chargers) needs from the database.
--
--   ev_sessions            extended: the charger's own ids, meters, status, power figures and the solar / battery / grid split
--   ev_session_samples     one row per MeterValues sample (every 30 s while charging), with the site figures at that moment
--   ev_events              charger events (status changes, faults, remote commands) with their time
--   gw_charger_keys        the active charger secrets (encrypted) so the backend can recognise a charger by its address
--   gw_ev_*                session start / sample / stop / event, the next transaction number, the site figures, access for commands
--
-- Everything the backend writes goes through gw_* functions that only the registered backend identity may call. Read access reuses the
-- rules of ev_sessions: the site's owner, an admin, an employee assigned to the customer or to the site (site_staff, with its expiry).
-- Samples are kept 6 months (purge job at the bottom); sessions stay. Rollback is at the end of this file.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 1. Sessions
-- ---------------------------------------------------------------------------------------------------------------------------------

alter table waytara.ev_sessions
  add column if not exists charge_point_id         text,
  add column if not exists connector_id            integer,
  add column if not exists ocpp_transaction_id     bigint,
  add column if not exists id_tag_hash             text,
  add column if not exists meter_start_wh          numeric,
  add column if not exists meter_stop_wh           numeric,
  add column if not exists status                  text not null default 'completed',
  add column if not exists source                  text not null default 'inferred',
  add column if not exists peak_power_kw           numeric,
  add column if not exists avg_power_kw            numeric,
  add column if not exists max_current_a           numeric,
  add column if not exists charging_seconds        integer,
  add column if not exists energy_from_solar_kwh   numeric,
  add column if not exists energy_from_battery_kwh numeric,
  add column if not exists energy_from_grid_kwh    numeric,
  add column if not exists energy_unattributed_kwh numeric,
  add column if not exists solar_share_pct         numeric,
  add column if not exists site_data_coverage_pct  numeric,
  add column if not exists cost_amount             numeric,
  add column if not exists tariff_snapshot         jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ev_sessions_status_check') then
    alter table waytara.ev_sessions add constraint ev_sessions_status_check check (status in ('active', 'completed', 'suspect', 'aborted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ev_sessions_source_check') then
    alter table waytara.ev_sessions add constraint ev_sessions_source_check check (source in ('ocpp', 'inferred', 'simulated'));
  end if;
end $$;

create unique index if not exists ev_sessions_transaction_uniq on waytara.ev_sessions (equipment_id, ocpp_transaction_id) where ocpp_transaction_id is not null;
create index if not exists ev_sessions_equipment_started_idx on waytara.ev_sessions (equipment_id, started_at desc);

comment on column waytara.ev_sessions.source is 'ocpp = reported by the charger itself; inferred = worked out from the inverter''s load (older sessions); simulated = a test.';
comment on column waytara.ev_sessions.status is 'active while the car is charging; suspect when the energy is implausible (kept as reported, never corrected).';

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 2. Samples and events
-- ---------------------------------------------------------------------------------------------------------------------------------

create table if not exists waytara.ev_session_samples (
  id               bigint generated always as identity primary key,
  session_id       uuid not null references waytara.ev_sessions(id) on delete cascade,
  equipment_id     uuid not null references waytara.equipment(id) on delete cascade,
  ts               timestamptz not null,
  energy_kwh       numeric,
  power_kw         numeric,
  current_a_l1     numeric, current_a_l2 numeric, current_a_l3 numeric,
  voltage_v_l1     numeric, voltage_v_l2 numeric, voltage_v_l3 numeric,
  current_offered_a numeric,
  soc_pct          numeric,
  temperature_c    numeric,
  frequency_hz     numeric,
  power_factor     numeric,
  -- the site at that moment (from the inverter; empty when it had no reading in the last minute)
  site_load_w      numeric,
  pv_w             numeric,
  battery_w        numeric,   -- above zero = discharging
  grid_w           numeric,   -- above zero = importing
  -- the split of this sample
  ev_from_solar_w  numeric,
  ev_from_battery_w numeric,
  ev_from_grid_w   numeric,
  raw              jsonb,
  unique (session_id, ts)
);
create index if not exists ev_session_samples_session_idx on waytara.ev_session_samples (session_id, ts);
create index if not exists ev_session_samples_ts_idx on waytara.ev_session_samples (ts);

create table if not exists waytara.ev_events (
  id           bigint generated always as identity primary key,
  equipment_id uuid not null references waytara.equipment(id) on delete cascade,
  session_id   uuid references waytara.ev_sessions(id) on delete set null,
  ts           timestamptz not null default now(),
  kind         text not null check (char_length(kind) between 1 and 64),
  detail       jsonb not null default '{}'::jsonb
);
create index if not exists ev_events_equipment_ts_idx on waytara.ev_events (equipment_id, ts desc);
create index if not exists ev_events_session_idx on waytara.ev_events (session_id);

alter table waytara.ev_session_samples enable row level security;
alter table waytara.ev_events enable row level security;
revoke all on waytara.ev_session_samples, waytara.ev_events from public, anon, authenticated;
grant select on waytara.ev_session_samples, waytara.ev_events to authenticated;
grant all on waytara.ev_session_samples, waytara.ev_events to service_role;

-- The same four routes as ev_sessions: admin, the site's owner, an employee assigned to the customer, a staff member assigned to the site.
do $$
declare
  t text;
begin
  foreach t in array array['ev_session_samples', 'ev_events'] loop
    execute format('drop policy if exists %I on waytara.%I', t || '_admin', t);
    execute format('create policy %I on waytara.%I for select to authenticated using ((select waytara.is_admin()))', t || '_admin', t);

    execute format('drop policy if exists %I on waytara.%I', t || '_owner', t);
    execute format($p$create policy %I on waytara.%I for select to authenticated using (
      exists (select 1 from waytara.equipment d join waytara.sites s on s.id = d.site_id
              where d.id = %I.equipment_id and s.customer_id = (select auth.uid())))$p$, t || '_owner', t, t);

    execute format('drop policy if exists %I on waytara.%I', t || '_employee_assigned', t);
    execute format($p$create policy %I on waytara.%I for select to authenticated using (
      exists (select 1 from waytara.equipment d join waytara.sites s on s.id = d.site_id
              join waytara.customer_onboarding co on co.customer_id = s.customer_id
              where d.id = %I.equipment_id and co.employee_id = (select auth.uid())))$p$, t || '_employee_assigned', t, t);

    execute format('drop policy if exists %I on waytara.%I', t || '_site_staff', t);
    execute format($p$create policy %I on waytara.%I for select to authenticated using (
      equipment_id in (select waytara.my_assigned_equipment_ids()))$p$, t || '_site_staff', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 3. Functions for the backend
-- ---------------------------------------------------------------------------------------------------------------------------------

create sequence if not exists waytara.ev_transaction_seq as integer start 1000 increment 1 cycle;
revoke all on sequence waytara.ev_transaction_seq from public, anon, authenticated;

-- every active charger secret, still encrypted: the backend decrypts them and recognises a charger by the secret in its address
create or replace function waytara.gw_charger_keys()
returns table (equipment_id uuid, key_id uuid, label text, key_ciphertext bytea, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return query
    select k.equipment_id, k.id, k.label, k.key_ciphertext, k.expires_at
    from waytara.equipment_keys k
    where k.kind = 'charger' and k.revoked_at is null and (k.expires_at is null or k.expires_at > now());
end;
$$;

create or replace function waytara.gw_ev_next_transaction()
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return nextval('waytara.ev_transaction_seq')::integer;
end;
$$;

-- a session begins (a repeat of the same transaction returns the same session)
create or replace function waytara.gw_ev_session_start(
  p_equipment uuid, p_connector integer, p_transaction bigint, p_started_at timestamptz,
  p_meter_start_wh numeric, p_id_tag_hash text, p_charge_point text, p_source text default 'ocpp'
)
returns uuid
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_id uuid;
begin
  perform waytara._require_gateway_service();
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;
  if p_source not in ('ocpp', 'simulated') then
    raise exception 'bad source' using errcode = '22023';
  end if;
  insert into waytara.ev_sessions (equipment_id, started_at, start_energy_kwh, status, source, charge_point_id, connector_id, ocpp_transaction_id, id_tag_hash, meter_start_wh, is_test)
  values (p_equipment, p_started_at, p_meter_start_wh / 1000.0, 'active', p_source, p_charge_point, p_connector, p_transaction, p_id_tag_hash, p_meter_start_wh, p_source = 'simulated')
  on conflict (equipment_id, ocpp_transaction_id) where ocpp_transaction_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from waytara.ev_sessions where equipment_id = p_equipment and ocpp_transaction_id = p_transaction;
  end if;
  return v_id;
end;
$$;

create or replace function waytara.gw_ev_session_by_transaction(p_equipment uuid, p_transaction bigint)
returns table (id uuid, started_at timestamptz, ended_at timestamptz, meter_start_wh numeric, status text)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return query select s.id, s.started_at, s.ended_at, s.meter_start_wh, s.status
               from waytara.ev_sessions s where s.equipment_id = p_equipment and s.ocpp_transaction_id = p_transaction;
end;
$$;

-- one MeterValues sample; p_sample carries only what was reported (absent = not reported, never zero)
create or replace function waytara.gw_ev_sample(p_session uuid, p_ts timestamptz, p_sample jsonb)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_eq uuid;
  n numeric;
begin
  perform waytara._require_gateway_service();
  select equipment_id into v_eq from waytara.ev_sessions where id = p_session;
  if v_eq is null then
    raise exception 'unknown session' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_sample) <> 'object' then
    raise exception 'the sample must be an object' using errcode = '22023';
  end if;
  insert into waytara.ev_session_samples as x (
    session_id, equipment_id, ts, energy_kwh, power_kw,
    current_a_l1, current_a_l2, current_a_l3, voltage_v_l1, voltage_v_l2, voltage_v_l3,
    current_offered_a, soc_pct, temperature_c, frequency_hz, power_factor,
    site_load_w, pv_w, battery_w, grid_w, ev_from_solar_w, ev_from_battery_w, ev_from_grid_w, raw)
  values (
    p_session, v_eq, p_ts,
    (p_sample ->> 'energy_kwh')::numeric, (p_sample ->> 'power_kw')::numeric,
    (p_sample ->> 'current_a_l1')::numeric, (p_sample ->> 'current_a_l2')::numeric, (p_sample ->> 'current_a_l3')::numeric,
    (p_sample ->> 'voltage_v_l1')::numeric, (p_sample ->> 'voltage_v_l2')::numeric, (p_sample ->> 'voltage_v_l3')::numeric,
    (p_sample ->> 'current_offered_a')::numeric, (p_sample ->> 'soc_pct')::numeric, (p_sample ->> 'temperature_c')::numeric,
    (p_sample ->> 'frequency_hz')::numeric, (p_sample ->> 'power_factor')::numeric,
    (p_sample ->> 'site_load_w')::numeric, (p_sample ->> 'pv_w')::numeric, (p_sample ->> 'battery_w')::numeric, (p_sample ->> 'grid_w')::numeric,
    (p_sample ->> 'ev_from_solar_w')::numeric, (p_sample ->> 'ev_from_battery_w')::numeric, (p_sample ->> 'ev_from_grid_w')::numeric,
    p_sample -> 'raw')
  on conflict (session_id, ts) do update set
    energy_kwh = excluded.energy_kwh, power_kw = excluded.power_kw,
    current_a_l1 = excluded.current_a_l1, current_a_l2 = excluded.current_a_l2, current_a_l3 = excluded.current_a_l3,
    voltage_v_l1 = excluded.voltage_v_l1, voltage_v_l2 = excluded.voltage_v_l2, voltage_v_l3 = excluded.voltage_v_l3,
    current_offered_a = excluded.current_offered_a, soc_pct = excluded.soc_pct, temperature_c = excluded.temperature_c,
    frequency_hz = excluded.frequency_hz, power_factor = excluded.power_factor,
    site_load_w = excluded.site_load_w, pv_w = excluded.pv_w, battery_w = excluded.battery_w, grid_w = excluded.grid_w,
    ev_from_solar_w = excluded.ev_from_solar_w, ev_from_battery_w = excluded.ev_from_battery_w, ev_from_grid_w = excluded.ev_from_grid_w,
    raw = excluded.raw;
  n := 0;
end;
$$;

-- a session ends; p_summary carries the figures the backend worked out (status, peak, average, split ...)
create or replace function waytara.gw_ev_session_stop(p_session uuid, p_ended_at timestamptz, p_meter_stop_wh numeric, p_reason text, p_summary jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  update waytara.ev_sessions s
     set ended_at = p_ended_at,
         meter_stop_wh = p_meter_stop_wh,
         end_energy_kwh = p_meter_stop_wh / 1000.0,
         stop_reason = left(p_reason, 64),
         status = coalesce(nullif(p_summary ->> 'status', ''), 'completed'),
         peak_power_kw = (p_summary ->> 'peak_power_kw')::numeric,
         avg_power_kw = (p_summary ->> 'avg_power_kw')::numeric,
         max_current_a = (p_summary ->> 'max_current_a')::numeric,
         charging_seconds = (p_summary ->> 'charging_seconds')::integer,
         energy_from_solar_kwh = (p_summary ->> 'energy_from_solar_kwh')::numeric,
         energy_from_battery_kwh = (p_summary ->> 'energy_from_battery_kwh')::numeric,
         energy_from_grid_kwh = (p_summary ->> 'energy_from_grid_kwh')::numeric,
         energy_unattributed_kwh = (p_summary ->> 'energy_unattributed_kwh')::numeric,
         solar_share_pct = (p_summary ->> 'solar_share_pct')::numeric,
         site_data_coverage_pct = (p_summary ->> 'site_data_coverage_pct')::numeric
   where s.id = p_session;
  if not found then
    raise exception 'unknown session' using errcode = 'P0002';
  end if;
end;
$$;

-- the samples of a session (for the summary at its end, so a restart of the backend in the middle of a session loses nothing)
create or replace function waytara.gw_ev_session_samples(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'ts', extract(epoch from x.ts), 'power_kw', x.power_kw, 'energy_kwh', x.energy_kwh,
             'current_a', greatest(coalesce(x.current_a_l1, 0), coalesce(x.current_a_l2, 0), coalesce(x.current_a_l3, 0)),
             'has_site', x.pv_w is not null or x.grid_w is not null or x.battery_w is not null or x.site_load_w is not null,
             'solar_w', x.ev_from_solar_w, 'battery_w', x.ev_from_battery_w, 'grid_w', x.ev_from_grid_w) order by x.ts)
    from waytara.ev_session_samples x where x.session_id = p_session), '[]'::jsonb);
end;
$$;

create or replace function waytara.gw_ev_event(p_equipment uuid, p_session uuid, p_ts timestamptz, p_kind text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'unknown equipment' using errcode = 'P0002';
  end if;
  insert into waytara.ev_events (equipment_id, session_id, ts, kind, detail)
  values (p_equipment, p_session, coalesce(p_ts, now()), p_kind, coalesce(p_detail, '{}'::jsonb));
end;
$$;

-- the site's figures from the inverter at the same site: the latest reading of each, with its age
create or replace function waytara.gw_ev_site_figures(p_equipment uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_inv uuid;
  v_result jsonb;
begin
  perform waytara._require_gateway_service();
  select site_id into v_site from waytara.equipment where id = p_equipment;
  if v_site is null then return null; end if;
  select e.id into v_inv
  from waytara.equipment e
  join waytara.equipment_inventory i on i.id = e.stock_id
  where e.site_id = v_site and e.parent_id is null and e.retired_at is null and i.category::text = 'solar_inverter'
  order by e.created_at
  limit 1;
  if v_inv is null then return null; end if;

  select jsonb_build_object(
           'inverter_id', v_inv,
           'ts', extract(epoch from max(l.ts)),
           'age_s', extract(epoch from now() - max(l.ts)),
           'pv_w', sum(l.value) filter (where l.key_name in ('pv1_power_w', 'pv2_power_w', 'pv3_power_w', 'pv4_power_w')),
           'battery_w', max(l.value) filter (where l.key_name = 'battery_power_w'),
           'grid_w', max(l.value) filter (where l.key_name = 'grid_total_power_w'),
           'load_w', max(l.value) filter (where l.key_name = 'load_total_power_w'))
    into v_result
  from waytara.equipment_latest l
  where l.equipment_id = v_inv
    and l.key_name in ('pv1_power_w', 'pv2_power_w', 'pv3_power_w', 'pv4_power_w', 'battery_power_w', 'grid_total_power_w', 'load_total_power_w');
  return v_result;
end;
$$;

-- who may send commands to a charger (remote start / stop, reset): the site's owner, assigned staff, admins; the equipment must be a charger
create or replace function waytara.gw_ev_access(p_actor uuid, p_equipment uuid)
returns text
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_role text;
  v_cat text;
begin
  perform waytara._require_gateway_service();
  select e.site_id, i.category::text into v_site, v_cat
  from waytara.equipment e left join waytara.equipment_inventory i on i.id = e.stock_id
  where e.id = p_equipment;
  if v_site is null or v_cat is distinct from 'ev_charger' or not waytara.can_access_site_as(p_actor, v_site) then
    return null;
  end if;
  select me.role::text into v_role from waytara.profiles me where me.id = p_actor;
  return case when v_role in ('admin', 'employee', 'site_engineer') then 'staff' else 'owner' end;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'gw_charger_keys()',
    'gw_ev_next_transaction()',
    'gw_ev_session_start(uuid, integer, bigint, timestamptz, numeric, text, text, text)',
    'gw_ev_session_by_transaction(uuid, bigint)',
    'gw_ev_sample(uuid, timestamptz, jsonb)',
    'gw_ev_session_stop(uuid, timestamptz, numeric, text, jsonb)',
    'gw_ev_event(uuid, uuid, timestamptz, text, jsonb)',
    'gw_ev_session_samples(uuid)',
    'gw_ev_site_figures(uuid)',
    'gw_ev_access(uuid, uuid)'
  ] loop
    execute format('revoke all on function waytara.%s from public, anon', f);
    execute format('grant execute on function waytara.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 4. Retention: samples are kept six months
-- ---------------------------------------------------------------------------------------------------------------------------------

create or replace function waytara.purge_old_ev_samples()
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  n integer;
begin
  delete from waytara.ev_session_samples where ts < now() - interval '6 months';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function waytara.purge_old_ev_samples() from public, anon, authenticated;
grant execute on function waytara.purge_old_ev_samples() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-ev-samples';
    perform cron.schedule('purge-ev-samples', '17 3 * * *', $job$select waytara.purge_old_ev_samples()$job$);
  end if;
end $$;

-- Rollback:
--   drop function if exists waytara.purge_old_ev_samples(), waytara.gw_ev_session_samples(uuid), waytara.gw_ev_access(uuid, uuid), waytara.gw_ev_site_figures(uuid),
--     waytara.gw_ev_event(uuid, uuid, timestamptz, text, jsonb), waytara.gw_ev_session_stop(uuid, timestamptz, numeric, text, jsonb),
--     waytara.gw_ev_sample(uuid, timestamptz, jsonb), waytara.gw_ev_session_by_transaction(uuid, bigint),
--     waytara.gw_ev_session_start(uuid, integer, bigint, timestamptz, numeric, text, text, text), waytara.gw_ev_next_transaction(),
--     waytara.gw_charger_keys();
--   drop table if exists waytara.ev_events, waytara.ev_session_samples;
--   (the new ev_sessions columns are harmless and may stay)
