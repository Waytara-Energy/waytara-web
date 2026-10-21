-- Offline alerts that know WHY a device is silent (follow-up to T3 and T9 of docs/GATEWAY_V3_TASKS.md).
--
-- A monitoring unit can fail in three ways, and the people reading the alert need to be told which:
--   * the unit lost POWER or its NETWORK: it stops checking in (status "offline"). The server cannot tell these two apart while it lasts;
--     it can tell afterwards: a unit that came back with a new start (gateway_devices.last_boot_at moved) lost power, one that came back
--     without restarting had a network or internet outage.
--   * the unit is online but the INVERTER does not answer it (RS485 cable, inverter off or asleep): the unit says so in its own heartbeat
--     (status "device_unreachable").
--
-- What this adds:
--   1. one place for the wording (_offline_message) and one way to read the cause back from an alert (_offline_cause);
--   2. a CAUSE CHANGE while an alert is open (for example the inverter line was silent, then power was lost): once the new cause has held
--      for 2 minutes, the alert text is updated, the activity log says so, and the customer is told (an unsent first e-mail is corrected
--      instead of adding a second one); a status that merely flaps never produces mail;
--   3. the "back online" e-mail carries what the outage was and whether the unit restarted, so it can say "power was probably lost" or
--      "the connection came back without a restart";
--   4. the activity log says what happened in plain words for each cause.
-- Nothing changes while the status stays the same: every step acts only on a difference between what is recorded and what is now true.

-- ---- the wording, in one place ---------------------------------------------------------------------------------------------------

create or replace function waytara._offline_message(p_status text, p_label text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'device_unreachable' then 'Device offline: ' || p_label || ' is not responding - its monitoring unit is online but the inverter does not answer it; check that the inverter is switched on and not asleep, and that the cable between the unit and the inverter (RS485) is connected.'
    else 'Device offline: ' || p_label || ' has stopped reporting - nothing has arrived from its monitoring unit recently (it may have lost power or its internet connection).'
  end
$$;

-- what an alert says its cause is (alerts written before this change carry the same two sentences)
create or replace function waytara._offline_cause(p_message text)
returns text
language sql
immutable
as $$
  select case when p_message like '%is not responding%' then 'device_unreachable' else 'offline' end
$$;

revoke all on function waytara._offline_message(text, text) from public, anon, authenticated;
revoke all on function waytara._offline_cause(text) from public, anon, authenticated;

-- ---- the activity log says which cause --------------------------------------------------------------------------------------------

create or replace function waytara._activity_from_alert()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_label text;
begin
  begin
    if new.message like 'Device offline%' then
      select coalesce(label, 'The device') into v_label from waytara.equipment where id = new.device_id;
      if tg_op = 'INSERT' then
        perform waytara._record_activity(new.device_id, null, null, 'system', 'device_offline',
          case waytara._offline_cause(new.message)
            when 'device_unreachable' then v_label || ': the monitoring unit is online but the inverter is not answering it'
            else v_label || ' stopped reporting: the monitoring unit stopped checking in (power or internet)'
          end,
          jsonb_build_object('alert_id', new.id, 'since', new.offline_since, 'cause', waytara._offline_cause(new.message)), null);
      elsif new.resolved_at is not null and old.resolved_at is null then
        perform waytara._record_activity(new.device_id, null, null, 'system', 'device_online', v_label || ' is reporting again', jsonb_build_object('alert_id', new.id), null);
      end if;
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- ---- the alert step: the same as before, plus the cause change and what the back-online record carries ---------------------------------

create or replace function waytara._fleet_alert_step(p_now timestamptz, p_allow_open boolean)
returns jsonb
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  d          record;
  a          record;
  c          record;
  v_alert    uuid;
  v_msg      text;
  v_last     text;
  v_opened   integer := 0;
  v_reminded integer := 0;
  v_closed   integer := 0;
  v_changed  integer := 0;
  v_gap      interval;
begin
  -- 1. close: the device is checking in again (and answering)
  for a in
    select al.id, al.device_id, al.ts, al.offline_since, al.notified_count, al.message, e.site_id, s.customer_id,
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
                                 'down_for_s', greatest(0, extract(epoch from (p_now - coalesce(a.offline_since, a.ts)))::bigint),
                                 'was_status', waytara._offline_cause(a.message),
                                 -- a new start of the unit since the outage began means it lost power
                                 'restarted', exists (select 1 from waytara.gateway_devices g where g.equipment_id = a.device_id and g.last_boot_at > coalesce(a.offline_since, a.ts))))
      on conflict (dedupe_key) do nothing;
    end if;
  end loop;

  -- 1b. the cause changed while the alert is open, and the new cause has held for 2 minutes
  for c in
    select al.id, al.device_id, al.notified_count, s.customer_id, s.name as site_name, h.status, h.status_since, h.last_read_at, h.device_error,
           coalesce(e.label, i.serial_number, i.model_number, 'Device') as label
      from waytara.alerts al
      join waytara.equipment e on e.id = al.device_id
      join waytara.equipment_heartbeat h on h.equipment_id = e.id
      left join waytara.equipment_inventory i on i.id = e.stock_id
      left join waytara.sites s on s.id = e.site_id
     where al.resolved_at is null and al.message like 'Device offline%'
       and h.status in ('offline', 'device_unreachable')
       and waytara._offline_cause(al.message) <> h.status
       and h.status_since <= p_now - interval '2 minutes'
  loop
    v_last := case when c.last_read_at is not null
                   then ' Last reading: ' || to_char(c.last_read_at at time zone 'Asia/Kolkata', 'FMDD Mon, FMHH12:MI am') || '.' else '' end;
    v_msg := waytara._offline_message(c.status, c.label) || v_last;
    update waytara.alerts set message = v_msg where id = c.id;
    v_changed := v_changed + 1;
    perform waytara._record_activity(c.device_id, null, null, 'system', 'device_offline',
      case c.status
        when 'device_unreachable' then c.label || ': the monitoring unit is back but the inverter is not answering it'
        else c.label || ': the monitoring unit stopped checking in (power or internet)'
      end,
      jsonb_build_object('alert_id', c.id, 'since', c.status_since, 'cause', c.status), null);
    if c.customer_id is not null and waytara._customer_wants_status_emails(c.customer_id) then
      if exists (select 1 from waytara.notification_outbox o where o.alert_id = c.id and o.kind = 'offline' and o.sent_at is null) then
        -- the first e-mail has not gone yet: say the right thing in it instead of sending two
        update waytara.notification_outbox
           set payload = payload || jsonb_build_object('status', c.status, 'message', v_msg, 'device_error', c.device_error)
         where alert_id = c.id and kind = 'offline' and sent_at is null;
      elsif c.notified_count >= 1 then
        insert into waytara.notification_outbox (audience, kind, customer_id, device_id, alert_id, dedupe_key, payload)
        values ('customer', 'offline', c.customer_id, c.device_id, c.id, 'cause:' || c.id || ':' || c.status || ':' || extract(epoch from c.status_since)::bigint,
                jsonb_build_object('device_label', c.label, 'site_name', c.site_name, 'status', c.status, 'message', v_msg,
                                   'since', c.status_since, 'last_read_at', c.last_read_at, 'device_error', c.device_error, 'cause_changed', true))
        on conflict (dedupe_key) do nothing;
      end if;
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
      v_msg := waytara._offline_message(d.status, d.label) || v_last;
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
              jsonb_build_object('device_label', a.label, 'site_name', a.site_name, 'status', waytara._offline_cause(a.message), 'message', a.message,
                                 'since', coalesce(a.offline_since, a.ts), 'last_read_at', a.last_read_at, 'device_error', a.device_error,
                                 'offline_for_s', greatest(0, extract(epoch from (p_now - coalesce(a.offline_since, a.ts)))::bigint)))
      on conflict (dedupe_key) do nothing;
      if found then v_reminded := v_reminded + 1; end if;
    end if;
  end loop;

  return jsonb_build_object('opened', v_opened, 'reminders', v_reminded, 'closed', v_closed, 'cause_changed', v_changed);
end;
$$;

revoke all on function waytara._fleet_alert_step(timestamptz, boolean) from public, anon, authenticated;

-- To undo: re-apply the bodies of waytara._fleet_alert_step from 20261021020000_fleet_tick.sql and waytara._activity_from_alert from
-- 20261021030000_device_activity_log.sql, then: drop function waytara._offline_message(text, text), waytara._offline_cause(text);
