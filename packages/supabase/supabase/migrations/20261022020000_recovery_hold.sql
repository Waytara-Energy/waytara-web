-- A recovery must hold for a minute before an offline alert closes and "back online" is sent (follow-up to 20261022010000_cause_aware_alerts.sql).
--
-- Found on the real board on 2026-10-21 20:34: a unit that was switched on again with its inverter cable out reported "online" for about 25 seconds
-- (three check-ins are needed before the inverter counts as silent), which closed the alert and e-mailed "back online" two minutes before the
-- "inverter not answering" alert opened. Now the alert closes only when the status has been "online" for 60 seconds; the rest of the step is unchanged.

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
  -- 1. close: the device is checking in again and answering, and has been for a minute
  for a in
    select al.id, al.device_id, al.ts, al.offline_since, al.notified_count, al.message, e.site_id, s.customer_id,
           coalesce(e.label, i.serial_number, i.model_number, 'Device') as label, s.name as site_name
      from waytara.alerts al
      join waytara.equipment e on e.id = al.device_id
      join waytara.equipment_heartbeat h on h.equipment_id = e.id
      left join waytara.equipment_inventory i on i.id = e.stock_id
      left join waytara.sites s on s.id = e.site_id
     where al.resolved_at is null and al.message like 'Device offline%' and h.status = 'online'
       -- a recovery counts only once it has held for a minute: a unit that has just started reports "online" for a few check-ins before it
       -- proves its inverter is silent, and that must not close the alert and send "back online"
       and h.status_since <= p_now - interval '60 seconds'
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

-- To undo: re-apply the function from 20261022010000_cause_aware_alerts.sql.
