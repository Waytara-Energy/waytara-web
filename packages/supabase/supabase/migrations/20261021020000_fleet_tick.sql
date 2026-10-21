-- The one heartbeat (task T3 of docs/GATEWAY_V3_TASKS.md): waytara.fleet_tick() is meant to run every 10 seconds from pg_cron and does
-- everything that has to be decided about the fleet in one place:
--
--   1. re-derives every device's status from its last check-in (the existing waytara.refresh_device_status());
--   2. calls the hub once (keep-alive and health) and reads the answer to the previous call at the next tick;
--   3. opens, repeats and closes the "device offline" alerts, writing the e-mails that follow into waytara.notification_outbox;
--   4. asks the dashboard app's mailer to send what is due (it is only called when something is due).
--
-- The rules (docs/GATEWAY_V3_TASKS.md, "T1 findings"):
--   * a device is "offline" in the dashboard 30 s after its last check-in (the verdict already works like that);
--   * an offline ALERT, and its first e-mail, only follows when the verdict has stayed offline / device_unreachable for 2 minutes;
--   * while the hub itself is down, or in its first 2 minutes after a start, no offline alert is opened (the boards cannot reach it);
--   * a reminder every 3 hours while the alert is open and not acknowledged (once a day after 24 hours);
--   * when the device is back the alert closes, and if the customer had been told, one "back online" e-mail says how long it was down;
--   * a customer who switched alert e-mails off, a deactivated or deleted account, and a device without an agent heartbeat get nothing.
-- The sender (not this function) puts a customer's due rows into ONE digest and keeps 10 minutes between two e-mails to a customer.
--
-- This migration only creates the functions. The job is switched on in a later step (T6), after the old jobs are ready to retire.

alter table waytara.hub_health
  add column if not exists last_down_since timestamptz,
  add column if not exists last_mailer_call_at timestamptz;
comment on column waytara.hub_health.last_down_since is 'When the hub last went down (kept after it is back, so the "back" message can be matched to the "down" one).';
comment on column waytara.hub_health.last_mailer_call_at is 'When fleet_tick last asked the mailer to send (at most every 30 seconds).';

alter table waytara.notification_outbox add column if not exists claimed_at timestamptz;
comment on column waytara.notification_outbox.claimed_at is 'Set by the sender when it takes a row, so two overlapping calls never send the same one; a claim older than 2 minutes counts as abandoned.';

alter table waytara.alerts add column if not exists offline_since timestamptz;
comment on column waytara.alerts.offline_since is 'For an offline alert: when the device last stopped checking in (the verdict changed), so "how long it was down" is right.';

-- ---- who may be told -------------------------------------------------------------------------------------------------------------

create or replace function waytara._customer_wants_status_emails(p_customer uuid)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select coalesce(
    (select p.email is not null and p.deactivated_at is null and p.deleted_at is null
            and coalesce((p.notification_preferences ->> 'email_alerts')::boolean, true)
       from waytara.profiles p where p.id = p_customer), false)
$$;

revoke all on function waytara._customer_wants_status_emails(uuid) from public, anon, authenticated;

-- ---- the hub: read the last answer, make the next call ----------------------------------------------------------------------------

create or replace function waytara._fleet_hub_step(p_now timestamptz, p_io boolean)
returns void
language plpgsql
security definer
set search_path = waytara, public, extensions, vault, net, pg_temp
as $$
declare
  h        waytara.hub_health%rowtype;
  r        record;
  v_url    text;
  v_secret text;
  v_json   jsonb;
  v_ok     boolean;
  v_failed boolean := false;
  v_id     bigint;
begin
  select * into h from waytara.hub_health where id for update;

  if p_io then
    -- 1. the answer to the call made at the previous tick
    if h.last_request_id is not null then
      select status_code, content, timed_out, error_msg into r from net._http_response where id = h.last_request_id;
      if found then
        v_ok := coalesce(r.status_code, 0) between 200 and 299 and not coalesce(r.timed_out, false);
        if v_ok then
          begin
            v_json := r.content::jsonb;
          exception when others then
            v_json := '{}'::jsonb;
          end;
          update waytara.hub_health
             set consecutive_failures = 0, last_ok_at = p_now, hub_up = true, down_since = null,
                 hub_uptime_s = coalesce((v_json ->> 'uptime_s')::numeric, hub_uptime_s),
                 boards_connected = coalesce((v_json ->> 'boards_connected')::integer, boards_connected),
                 hub_version = coalesce(v_json ->> 'version', hub_version),
                 last_request_id = null, updated_at = p_now
           where id;
        else
          v_failed := true;
        end if;
      elsif h.last_request_at is not null and p_now - h.last_request_at > interval '40 seconds' then
        v_failed := true;  -- the answer never turned up
      end if;

      if v_failed then
        update waytara.hub_health
           set consecutive_failures = consecutive_failures + 1,
               hub_up = case when consecutive_failures + 1 >= 3 then false else hub_up end,
               down_since = case when consecutive_failures + 1 >= 3 and hub_up then p_now else down_since end,
               last_down_since = case when consecutive_failures + 1 >= 3 and hub_up then p_now else last_down_since end,
               hub_uptime_s = case when consecutive_failures + 1 >= 3 then null else hub_uptime_s end,
               last_request_id = null, updated_at = p_now
         where id;
      end if;
    end if;

    -- 2. the next call (the secret is in the vault; without it the open health address is called instead, which still keeps the hub awake)
    select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'hub_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'hub_tick_secret';
    v_url := rtrim(coalesce(nullif(v_url, ''), 'https://hub.waytaraenergy.com'), '/');
    if v_secret is not null and v_secret <> '' then
      v_id := net.http_post(url := v_url || '/v1/internal/tick', body := '{}'::jsonb,
                            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
                            timeout_milliseconds := 8000);
    else
      v_id := net.http_get(url := v_url || '/healthz', timeout_milliseconds := 8000);
    end if;
    update waytara.hub_health set last_request_id = v_id, last_request_at = p_now, updated_at = p_now where id;
  end if;
end;
$$;

revoke all on function waytara._fleet_hub_step(timestamptz, boolean) from public, anon, authenticated;

-- ---- the hub's own messages to admins ---------------------------------------------------------------------------------------------

create or replace function waytara._fleet_hub_events(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  h waytara.hub_health%rowtype;
  n integer := 0;
begin
  select * into h from waytara.hub_health where id;
  if not h.hub_up and h.down_since is not null and p_now - h.down_since >= interval '2 minutes' then
    insert into waytara.notification_outbox (audience, kind, dedupe_key, payload)
    values ('admin', 'hub_down', 'hub_down:' || extract(epoch from h.down_since)::bigint, jsonb_build_object('since', h.down_since))
    on conflict (dedupe_key) do nothing;
    get diagnostics n = row_count;
  elsif h.hub_up and h.last_down_since is not null
        and exists (select 1 from waytara.notification_outbox o where o.dedupe_key = 'hub_down:' || extract(epoch from h.last_down_since)::bigint) then
    -- it was down long enough to be announced: say it is back
    insert into waytara.notification_outbox (audience, kind, dedupe_key, payload)
    values ('admin', 'hub_back', 'hub_back:' || extract(epoch from h.last_down_since)::bigint,
            jsonb_build_object('since', h.last_down_since, 'down_for_s', greatest(0, extract(epoch from (p_now - h.last_down_since))::bigint)))
    on conflict (dedupe_key) do nothing;
    get diagnostics n = row_count;
  end if;
  return n;
end;
$$;

revoke all on function waytara._fleet_hub_events(timestamptz) from public, anon, authenticated;

-- ---- the offline alerts ---------------------------------------------------------------------------------------------------------

create or replace function waytara._fleet_alert_step(p_now timestamptz, p_allow_open boolean)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  d          record;
  a          record;
  v_alert    uuid;
  v_label    text;
  v_msg      text;
  v_last     text;
  v_opened   integer := 0;
  v_reminded integer := 0;
  v_closed   integer := 0;
  v_gap      interval;
begin
  -- 1. close: the device is checking in again
  for a in
    select al.id, al.device_id, al.ts, al.offline_since, al.notified_count, e.site_id, s.customer_id,
           coalesce(e.label, i.serial_number, i.model_number, 'Device') as label, s.name as site_name
      from waytara.alerts al
      join waytara.equipment e on e.id = al.device_id
      join waytara.equipment_heartbeat h on h.equipment_id = e.id
      left join waytara.equipment_inventory i on i.id = e.stock_id
      left join waytara.sites s on s.id = e.site_id
     where al.resolved_at is null and al.message like 'Device offline%' and h.status = 'online'
  loop
    update waytara.alerts set resolved_at = p_now, acknowledged_at = coalesce(acknowledged_at, p_now) where id = a.id;
    v_closed := v_closed + 1;
    if a.notified_count >= 1 and a.customer_id is not null and waytara._customer_wants_status_emails(a.customer_id) then
      insert into waytara.notification_outbox (audience, kind, customer_id, device_id, alert_id, dedupe_key, payload)
      values ('customer', 'back_online', a.customer_id, a.device_id, a.id, 'online:' || a.id,
              jsonb_build_object('device_label', a.label, 'site_name', a.site_name, 'back_at', p_now,
                                 'down_for_s', greatest(0, extract(epoch from (p_now - coalesce(a.offline_since, a.ts)))::bigint)))
      on conflict (dedupe_key) do nothing;
    end if;
  end loop;

  -- 2. open: offline for 2 minutes in a row, and the hub is up and settled
  if p_allow_open then
    for d in
      select e.id as device_id, h.status, h.status_since, h.last_read_at, h.device_error, s.customer_id, s.name as site_name,
             coalesce(e.label, i.serial_number, i.model_number, 'Device') as label
        from waytara.equipment e
        join waytara.equipment_inventory i on i.id = e.stock_id and i.category::text in ('solar_inverter', 'ev_charger')
        join waytara.equipment_heartbeat h on h.equipment_id = e.id
        left join waytara.sites s on s.id = e.site_id
       where e.device_status = 'active'
         and h.status in ('offline', 'device_unreachable')
         and h.status_since <= p_now - interval '2 minutes'
         and not exists (select 1 from waytara.alerts al where al.device_id = e.id and al.resolved_at is null and al.message like 'Device offline%')
    loop
      v_last := case when d.last_read_at is not null
                     then ' Last reading: ' || to_char(d.last_read_at at time zone 'Asia/Kolkata', 'FMDD Mon, FMHH12:MI am') || '.' else '' end;
      v_msg := case d.status
                 when 'device_unreachable' then 'Device offline: ' || d.label || ' is not responding - its monitoring unit is online but the inverter does not answer it; check that the inverter is switched on and not asleep.'
                 else 'Device offline: ' || d.label || ' has stopped reporting - nothing has arrived from its monitoring unit recently (it may have lost power or its internet connection).'
               end || v_last;
      insert into waytara.alerts (device_id, severity, message, offline_since) values (d.device_id, 'critical', v_msg, d.status_since) returning id into v_alert;
      v_opened := v_opened + 1;
      if d.customer_id is not null and waytara._customer_wants_status_emails(d.customer_id) then
        insert into waytara.notification_outbox (audience, kind, customer_id, device_id, alert_id, dedupe_key, payload)
        values ('customer', 'offline', d.customer_id, d.device_id, v_alert, 'offline:' || v_alert,
                jsonb_build_object('device_label', d.label, 'site_name', d.site_name, 'status', d.status, 'message', v_msg,
                                   'since', d.status_since, 'last_read_at', d.last_read_at, 'device_error', d.device_error))
        on conflict (dedupe_key) do nothing;
      end if;
    end loop;
  end if;

  -- 3. remind: still open, not acknowledged, the customer was told before; every 3 hours, once a day after 24 hours
  for a in
    select al.id, al.device_id, al.ts, al.offline_since, al.notified_count, al.last_notified_at, al.message, s.customer_id, s.name as site_name,
           coalesce(e.label, i.serial_number, i.model_number, 'Device') as label, h.status, h.last_read_at, h.device_error
      from waytara.alerts al
      join waytara.equipment e on e.id = al.device_id
      join waytara.equipment_heartbeat h on h.equipment_id = e.id
      left join waytara.equipment_inventory i on i.id = e.stock_id
      left join waytara.sites s on s.id = e.site_id
     where al.resolved_at is null and al.acknowledged_at is null and al.message like 'Device offline%'
       and al.notified_count >= 1 and al.last_notified_at is not null and h.status in ('offline', 'device_unreachable')
  loop
    v_gap := case when p_now - coalesce(a.offline_since, a.ts) >= interval '24 hours' then interval '24 hours' else interval '3 hours' end;
    if a.last_notified_at + v_gap <= p_now and a.customer_id is not null and waytara._customer_wants_status_emails(a.customer_id) then
      insert into waytara.notification_outbox (audience, kind, customer_id, device_id, alert_id, dedupe_key, payload)
      values ('customer', 'still_offline', a.customer_id, a.device_id, a.id, 'reminder:' || a.id || ':' || (a.notified_count + 1),
              jsonb_build_object('device_label', a.label, 'site_name', a.site_name, 'status', a.status, 'message', a.message,
                                 'since', coalesce(a.offline_since, a.ts), 'last_read_at', a.last_read_at, 'device_error', a.device_error,
                                 'offline_for_s', greatest(0, extract(epoch from (p_now - coalesce(a.offline_since, a.ts)))::bigint)))
      on conflict (dedupe_key) do nothing;
      if found then v_reminded := v_reminded + 1; end if;
    end if;
  end loop;

  return jsonb_build_object('opened', v_opened, 'reminders', v_reminded, 'closed', v_closed);
end;
$$;

revoke all on function waytara._fleet_alert_step(timestamptz, boolean) from public, anon, authenticated;

-- ---- is there mail the sender could send now? -----------------------------------------------------------------------------------

create or replace function waytara._fleet_has_due_mail(p_now timestamptz)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select exists (
    select 1
      from waytara.notification_outbox o
      left join waytara.notification_state s on s.customer_id = o.customer_id
     where o.sent_at is null and o.due_at <= p_now
       and (o.claimed_at is null or o.claimed_at < p_now - interval '2 minutes')
       and (o.audience = 'admin' or s.last_status_email_at is null or s.last_status_email_at <= p_now - interval '10 minutes'))
$$;

revoke all on function waytara._fleet_has_due_mail(timestamptz) from public, anon, authenticated;

-- ---- the tick ---------------------------------------------------------------------------------------------------------------------
-- p_io = false skips the two outside calls (the hub and the mailer): that is how the tests run it, with the hub's state set by hand.

create or replace function waytara.fleet_tick(p_now timestamptz default now(), p_io boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  h        waytara.hub_health%rowtype;
  v_alerts jsonb;
  v_hub    integer;
  v_kicked boolean := false;
  v_settled boolean;
begin
  perform waytara.refresh_device_status();
  perform waytara._fleet_hub_step(p_now, p_io);
  v_hub := waytara._fleet_hub_events(p_now);

  select * into h from waytara.hub_health where id;
  -- "settled": up, and past its first 2 minutes (the uptime comes from its own answer)
  v_settled := h.hub_up and coalesce(h.hub_uptime_s, 0) >= 120;
  v_alerts := waytara._fleet_alert_step(p_now, v_settled);

  if p_io and waytara._fleet_has_due_mail(p_now) and (h.last_mailer_call_at is null or p_now - h.last_mailer_call_at >= interval '30 seconds') then
    perform waytara.invoke_cron_route('/api/cron/send-device-notifications');
    update waytara.hub_health set last_mailer_call_at = p_now where id;
    v_kicked := true;
  end if;

  return jsonb_build_object('hub_up', h.hub_up, 'hub_settled', v_settled, 'hub_messages', v_hub, 'alerts', v_alerts, 'mailer_called', v_kicked);
end;
$$;

revoke all on function waytara.fleet_tick(timestamptz, boolean) from public, anon, authenticated;
grant execute on function waytara.fleet_tick(timestamptz, boolean) to service_role;

-- To undo: drop function waytara.fleet_tick(timestamptz, boolean), waytara._fleet_has_due_mail(timestamptz),
--   waytara._fleet_alert_step(timestamptz, boolean), waytara._fleet_hub_events(timestamptz), waytara._fleet_hub_step(timestamptz, boolean),
--   waytara._customer_wants_status_emails(uuid);  (the added columns can stay)
