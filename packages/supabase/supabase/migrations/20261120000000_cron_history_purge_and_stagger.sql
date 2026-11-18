-- Cron housekeeping (2026-11-18).
--
-- 1. pg_cron keeps one row per run in cron.job_run_details. fleet-tick alone runs every 10 seconds, and nothing ever deleted the rows: by 2026-11-18 the table held
--    about 499,000 rows (93 MB) and every run wrote to it. A daily job now deletes rows older than 7 days (the live table was emptied of older rows by hand first).
-- 2. detect-alerts, evaluate-alert-rules and rollup-run all started on the same 5-minute mark, together with the every-minute jobs and fleet-tick, and on 2026-11-17/18
--    the runs that failed with "job startup timeout" came in those bursts. They keep their 5-minute rhythm but start on different minutes:
--    rollup-run on 0, 5, 10 ...; detect-alerts on 1, 6, 11 ...; evaluate-alert-rules on 3, 8, 13 ...
--
-- Nothing here changes what any job does.

do $$
declare
  v_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-cron-history';
    perform cron.schedule('purge-cron-history', '47 22 * * *', $job$delete from cron.job_run_details where start_time < now() - interval '7 days'$job$);

    select jobid into v_id from cron.job where jobname = 'detect-alerts';
    if v_id is not null then
      perform cron.alter_job(v_id, schedule := '1-59/5 * * * *');
    end if;

    select jobid into v_id from cron.job where jobname = 'evaluate-alert-rules';
    if v_id is not null then
      perform cron.alter_job(v_id, schedule := '3-59/5 * * * *');
    end if;
  end if;
end $$;

-- Rollback:
--   select cron.unschedule(jobid) from cron.job where jobname = 'purge-cron-history';
--   select cron.alter_job(jobid, schedule := '*/5 * * * *') from cron.job where jobname in ('detect-alerts', 'evaluate-alert-rules');
