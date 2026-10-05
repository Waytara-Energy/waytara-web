-- Fix: the offline-alert job decided "when did this device last report?" by
-- pulling every equipment_latest row and reducing them in JavaScript. The REST
-- API returns at most 1,000 rows per request and equipment_latest holds one row
-- per (device, key) — 1,305 rows today — so the newest 1,000 rows won and any
-- device whose newest reading was older fell out of the result entirely, which
-- the job then reported as "has never reported a reading".
--
-- The answer is one row per device, so let the database compute it.
-- SECURITY INVOKER: RLS still applies to whoever calls it (the cron route uses
-- the service role; a signed-in user would only ever see their own devices).

create or replace function waytara.device_last_seen(p_equipment_ids uuid[])
returns table (equipment_id uuid, last_ts timestamptz)
language sql
stable
security invoker
set search_path = waytara, pg_temp
as $$
  select l.equipment_id, max(l.ts) as last_ts
  from equipment_latest l
  where l.equipment_id = any (p_equipment_ids)
  group by l.equipment_id;
$$;

revoke all on function waytara.device_last_seen(uuid[]) from public, anon;
grant execute on function waytara.device_last_seen(uuid[]) to authenticated, service_role;
