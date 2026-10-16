-- Task A4a: the database side of key management and of a board collecting its key (docs/GATEWAY_ARCHITECTURE_V2.md, sections 7 and 8.4).
-- Builds on 20261015000000_site_staff_and_gateway_keys.sql. Everything here is callable only by the backend's own identity
-- (gateway_service_users), like the gw_* functions of that migration.
--
--   gw_equipment_info       which site an equipment belongs to and what kind of unit it is (the backend has no table access of its own)
--   gw_key_info             which equipment a key belongs to (to check the caller's permission before rotating or revoking it)
--   gw_issue_claim_ticket   a single-use ticket, valid 15 minutes, bound to one equipment and one board; replaces any earlier open one
--   gw_claim_peek           is this ticket good for this board? (no change made)
--   gw_claim_device         redeem the ticket and, in one step, replace the board's key, record the board, write the audit trail
--
-- Rollback is at the bottom.

create or replace function waytara.gw_equipment_info(p_equipment uuid)
returns table (equipment_id uuid, site_id uuid, label text, category text, technical_specs jsonb)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return query
    select e.id, e.site_id, e.label, i.category::text, i.technical_specs::jsonb
    from waytara.equipment e
    left join waytara.equipment_inventory i on i.id = e.stock_id
    where e.id = p_equipment;
end;
$$;

create or replace function waytara.gw_key_info(p_key uuid)
returns table (key_id uuid, equipment_id uuid, kind text, label text, revoked_at timestamptz, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return query
    select k.id, k.equipment_id, k.kind, k.label, k.revoked_at, k.expires_at
    from waytara.equipment_keys k
    where k.id = p_key;
end;
$$;

create or replace function waytara.gw_issue_claim_ticket(p_equipment uuid, p_issued_to uuid, p_hardware_id text, p_ip inet default null)
returns table (ticket uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_id uuid;
  v_exp timestamptz;
begin
  perform waytara._require_gateway_service();
  if p_hardware_id is null or p_hardware_id !~ '^[A-Za-z0-9:_-]{6,64}$' then
    raise exception 'The hardware id is not valid' using errcode = '22023';
  end if;
  if not exists (select 1 from waytara.equipment where id = p_equipment) then
    raise exception 'Unknown equipment' using errcode = 'P0002';
  end if;
  -- one live ticket per equipment: an earlier unused one stops working
  update waytara.equipment_claim_tickets set used_at = now() where equipment_id = p_equipment and used_at is null;
  insert into waytara.equipment_claim_tickets (equipment_id, issued_to, hardware_id)
  values (p_equipment, p_issued_to, p_hardware_id)
  returning id, equipment_claim_tickets.expires_at into v_id, v_exp;
  insert into waytara.equipment_key_events (equipment_id, event, actor, ip, detail)
  values (p_equipment, 'ticket_issued', p_issued_to, p_ip, jsonb_build_object('hardware_id', p_hardware_id));
  return query select v_id, v_exp;
end;
$$;

create or replace function waytara.gw_claim_peek(p_ticket uuid, p_hardware_id text)
returns table (equipment_id uuid)
language plpgsql
stable
security definer
set search_path = waytara, pg_temp
as $$
begin
  perform waytara._require_gateway_service();
  return query
    select t.equipment_id
    from waytara.equipment_claim_tickets t
    where t.id = p_ticket and t.used_at is null and t.expires_at > now() and t.hardware_id = p_hardware_id;
  if not found then
    raise exception 'Invalid ticket' using errcode = 'P0002';
  end if;
end;
$$;

-- (the result columns are named out_* so they cannot clash with the table columns used inside)
drop function if exists waytara.gw_claim_device(uuid, text, bytea, text, inet);
create or replace function waytara.gw_claim_device(
  p_ticket       uuid,
  p_hardware_id  text,
  p_ciphertext   bytea,
  p_fingerprint  text,
  p_ip           inet default null
)
returns table (out_equipment_id uuid, out_key_id uuid, out_issued_to uuid)
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_eq uuid;
  v_by uuid;
  v_key uuid;
begin
  perform waytara._require_gateway_service();
  if p_ciphertext is null or octet_length(p_ciphertext) < 28 then
    raise exception 'The encrypted key is too short' using errcode = '22023';
  end if;

  -- redeem the ticket: exactly one caller can win this
  update waytara.equipment_claim_tickets t
     set used_at = now()
   where t.id = p_ticket and t.used_at is null and t.expires_at > now() and t.hardware_id = p_hardware_id
  returning t.equipment_id, t.issued_to into v_eq, v_by;
  if v_eq is null then
    raise exception 'Invalid ticket' using errcode = 'P0002';
  end if;

  -- one board, one equipment: a board that belongs to another equipment must be released first
  if exists (select 1 from waytara.gateway_devices d where d.hardware_id = p_hardware_id and d.equipment_id <> v_eq) then
    raise exception 'This board is already assigned to other equipment' using errcode = '23505';
  end if;

  -- claiming again replaces the old key
  with revoked as (
    update waytara.equipment_keys k
       set revoked_at = now(), revoked_by = v_by, revoke_reason = 'reclaimed'
     where k.equipment_id = v_eq and k.kind = 'gateway' and k.revoked_at is null
    returning k.id
  )
  insert into waytara.equipment_key_events (equipment_id, key_id, event, actor, ip, detail)
  select v_eq, r.id, 'revoked', v_by, p_ip, jsonb_build_object('reason', 'reclaimed') from revoked r;

  insert into waytara.equipment_keys (equipment_id, kind, label, key_ciphertext, key_fingerprint, created_by)
  values (v_eq, 'gateway', 'board ' || p_hardware_id, p_ciphertext, p_fingerprint, v_by)
  returning id into v_key;

  insert into waytara.gateway_devices (equipment_id, hardware_id, claimed_at, claimed_by, updated_at)
  values (v_eq, p_hardware_id, now(), v_by, now())
  on conflict (equipment_id) do update
    set hardware_id = excluded.hardware_id, claimed_at = excluded.claimed_at, claimed_by = excluded.claimed_by, updated_at = now();

  insert into waytara.equipment_key_events (equipment_id, key_id, event, actor, ip, detail)
  values (v_eq, v_key, 'claimed', v_by, p_ip, jsonb_build_object('hardware_id', p_hardware_id, 'fingerprint', p_fingerprint));

  return query select v_eq, v_key, v_by;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'gw_equipment_info(uuid)',
    'gw_key_info(uuid)',
    'gw_issue_claim_ticket(uuid, uuid, text, inet)',
    'gw_claim_peek(uuid, text)',
    'gw_claim_device(uuid, text, bytea, text, inet)'
  ] loop
    execute format('revoke all on function waytara.%s from public, anon', f);
    execute format('grant execute on function waytara.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- Rollback:
--   drop function if exists waytara.gw_claim_device(uuid, text, bytea, text, inet), waytara.gw_claim_peek(uuid, text),
--     waytara.gw_issue_claim_ticket(uuid, uuid, text, inet), waytara.gw_key_info(uuid), waytara.gw_equipment_info(uuid);
