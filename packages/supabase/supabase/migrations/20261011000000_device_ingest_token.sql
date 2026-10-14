-- A narrow way for a small device (an ESP32 with only the public anon key) to report its readings.
--
-- ingest_tick() is service_role only, and a service_role key must never sit in a device's flash. Instead each such
-- device gets its own secret token, stored here only as a hash. ingest_device_tick() is callable with the anon key,
-- checks the token for exactly one equipment id, and then runs the normal ingest_tick() for that equipment - so a
-- leaked token can only write values for that one device. Nothing else is exposed to anon.
--
-- Register a device (run as an admin / in the SQL editor; keep the plain token for the device's firmware):
--   insert into waytara.equipment_ingest_tokens (equipment_id, token_hash)
--   values ('<equipment id>', encode(sha256(convert_to('<long random token>', 'utf8')), 'hex'))
--   on conflict (equipment_id) do update set token_hash = excluded.token_hash, created_at = now();
-- Revoke it by deleting the row.

create table if not exists waytara.equipment_ingest_tokens (
  equipment_id uuid primary key references waytara.equipment(id) on delete cascade,
  token_hash   text not null,
  created_at   timestamptz not null default now()
);

comment on table waytara.equipment_ingest_tokens is
  'SHA-256 of the secret a device presents to ingest_device_tick(). Never readable through the API.';

alter table waytara.equipment_ingest_tokens enable row level security;
revoke all on waytara.equipment_ingest_tokens from public, anon, authenticated;
grant all on waytara.equipment_ingest_tokens to service_role;

create or replace function waytara.ingest_device_tick(
  p_equipment_id uuid,
  p_token        text,
  p_values       jsonb default '{}'::jsonb,
  p_agent        jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  -- one message for a wrong token and an unknown device, so ids cannot be probed
  if p_token is null or length(p_token) < 16 or not exists (
    select 1 from equipment_ingest_tokens t
    where t.equipment_id = p_equipment_id
      and t.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
  ) then
    raise exception 'invalid device credentials' using errcode = '28000';
  end if;

  -- latest values and the heartbeat only: a device cannot write rollup buckets
  return ingest_tick(p_equipment_id, now(), coalesce(p_values, '{}'::jsonb), '{}'::jsonb, '[]'::jsonb,
                     coalesce(p_agent, '{}'::jsonb));
end;
$$;

revoke all on function waytara.ingest_device_tick(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function waytara.ingest_device_tick(uuid, text, jsonb, jsonb) to anon, authenticated, service_role;
