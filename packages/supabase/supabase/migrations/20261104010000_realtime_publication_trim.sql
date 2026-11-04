-- Realtime was switched on for every table, and the database has been running at its limit (statement timeouts, then pooled connections left stuck:
-- Postgres 57014, then 25P02). Seven internal tables take nearly every write Realtime has to decode and permission-check (about 277,000 updates, against a
-- few hundred for everything the apps listen to). Neither app subscribes to them: the live values and the device state travel over the broadcast channel
-- device:<id>, and the state is read from the equipment_status view. They are taken out of the publication.
--
-- KEPT on purpose: equipment_heartbeat (the device's check-ins), so a change of it can still be listened to.
--
-- Idempotent. Only publications change, no data. A partitioned table is dropped by its own name (the partitions follow); if the partitions were
-- added one by one, each is dropped by its own name. To undo one: alter publication supabase_realtime add table waytara.<name>;
do $$
declare r record;
begin
  for r in
    select n.nspname, c.relname
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'waytara'
      and (c.relname like 'equipment\_rollup\_%'
           or c.relname in ('equipment_open_bucket', 'equipment_latest', 'hub_health', 'gateway_devices', 'rollup_state'))
  loop
    execute format('alter publication supabase_realtime drop table %I.%I', r.nspname, r.relname);
    raise notice 'dropped %.%', r.nspname, r.relname;
  end loop;
end $$;
