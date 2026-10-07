-- Cutover: raw telemetry rows are no longer stored in Supabase (the equipment agent keeps them locally and uploads
-- 15-minute buckets, see 20261006000000_rollup_data_layer.sql). Retires everything that served the old design:
--   * the nightly raw purge and the hourly rollup jobs (cron),
--   * purge_old_telemetry, rollup_telemetry_hourly, telemetry_buckets, telemetry_daily,
--   * the equipment_telemetry_hourly table,
--   * every real (non-test) row of equipment_telemetry.
-- equipment_telemetry itself stays: the admin app's onboarding "connection test" writes and reads is_test rows there
-- (and listens to its realtime INSERTs), and the equipment_latest trigger stays attached to it.
-- Before this ran in production the last raw readings (6 Oct 13:00-15:07) were folded into the rollups with
-- backfill_rollup_15m, so no real reading is lost.

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname in ('purge-old-telemetry', 'rollup-telemetry-hourly');
  end if;
end $$;

drop function if exists waytara.purge_old_telemetry(integer, integer, integer);
drop function if exists waytara.rollup_telemetry_hourly(timestamptz, timestamptz);
drop function if exists waytara.telemetry_buckets(uuid, text[], timestamptz, timestamptz, integer);
drop function if exists waytara.telemetry_daily(uuid, text[], timestamptz, timestamptz);

drop table if exists waytara.equipment_telemetry_hourly;

-- The delete does not touch equipment_latest (its trigger fires on insert only).
delete from waytara.equipment_telemetry where not is_test;

comment on table waytara.equipment_telemetry is
  'Onboarding connection-test signals only (is_test = true). Real readings are not stored: the agent keeps them locally and uploads rollups (equipment_rollup_15m / 1h / 1d).';
