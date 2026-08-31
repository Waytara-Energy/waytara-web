-- Task 10.5 (instrument settings write) hit a real bug: every INSERT into
-- device_settings has been failing since the schema was created — nothing
-- ever wrote to it before this feature, so nobody had hit it yet.
--
-- Root cause: trg_audit_device_settings -> waytara.log_activity() does
--   insert into audit_log (..., entity_id, ...)
--   values (..., coalesce(new.id, old.id), ...)
-- and audit_log.entity_id is `uuid`. Every other audited table (alerts,
-- customer_onboarding, devices, employee_invites, leads, payments, plans,
-- quotations) has a uuid primary key, so the implicit cast worked. Only
-- device_settings has a bigint identity id — coalesce(new.id, old.id)
-- there is a bigint, and Postgres refuses to cast bigint -> uuid:
--   ERROR 42804: column "entity_id" is of type uuid but expression is of
--   type bigint
--
-- Fix: widen entity_id to text (both uuid and bigint values stringify
-- into it losslessly) and have log_activity() cast explicitly instead of
-- relying on an implicit cast that only worked for uuid-keyed tables.
-- audit_log is still empty (Task 12 hasn't built a reader yet), so this
-- is a pure schema correction with nothing to migrate.

alter table waytara.audit_log
  alter column entity_id type text using entity_id::text;

create or replace function waytara.log_activity()
returns trigger
language plpgsql
security definer
set search_path to 'waytara', 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_role user_role;
begin
  select role into v_role from profiles where id = v_actor;
  insert into audit_log (actor_id, actor_role, action, entity, entity_id, changes)
  values (
    v_actor,
    v_role,
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id)::text,
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
  );
  return coalesce(new, old);
end;
$function$;
