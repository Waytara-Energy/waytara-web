-- The activity log tells customers WHY a stretch of the charts has no readings. The two facts a chart needs from an offline event
-- (which kind of outage it was, and when it started) are not sensitive, so they are exposed as their own columns while the rest of
-- `details` stays staff-only. New columns go at the end so the view can be replaced in place.
create or replace view waytara.device_activity_log
with (security_invoker = true) as
select a.id, a.at, a.equipment_id, a.site_id, a.actor_id, a.actor_name, a.actor_role, a.source, a.action, a.summary,
       case when waytara.is_staff() then a.details end as details,
       case when waytara.is_staff() then a.ip end as ip,
       case when a.action = 'device_offline' then a.details ->> 'cause' end as cause,
       case when a.action = 'device_offline' then nullif(a.details ->> 'since', '')::timestamptz end as since
  from waytara.device_activity a;

grant select on waytara.device_activity_log to authenticated, service_role;

-- To undo: re-run the create view in 20261021030000_device_activity_log.sql (without the last two columns).
