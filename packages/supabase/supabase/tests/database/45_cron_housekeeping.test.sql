-- Cron housekeeping: the cron run history is purged daily (7 days kept), and the three 5-minute jobs start on different minutes. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(6);

select is((select count(*)::int from cron.job where jobname = 'purge-cron-history'), 1, 'the cron run history is purged by a scheduled job');
select is((select schedule from cron.job where jobname = 'purge-cron-history'), '47 22 * * *', 'the purge runs once a day');
select ok((select command from cron.job where jobname = 'purge-cron-history') like '%cron.job_run_details%7 days%', 'the purge deletes cron history older than 7 days');
select is((select schedule from cron.job where jobname = 'rollup-run'), '*/5 * * * *', 'the rollups still start on the 5-minute marks');
select is((select schedule from cron.job where jobname = 'detect-alerts'), '1-59/5 * * * *', 'alert detection starts one minute after the rollups');
select is((select schedule from cron.job where jobname = 'evaluate-alert-rules'), '3-59/5 * * * *', 'alert rule evaluation starts three minutes after the rollups');

select * from finish();
rollback;
