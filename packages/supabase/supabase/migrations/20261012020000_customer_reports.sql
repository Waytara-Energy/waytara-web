-- Reports a customer builds for themselves (pick the parameters, name them, compare across categories) and, optionally, has
-- generated and e-mailed on a schedule.
--
--   customer_reports       the definition: name, parameters (with the display name each is shown under), period, schedule, recipients
--   customer_report_runs   each e-mail sent (or failed) for a report; the dashboard shows these live
--
-- A customer manages only their own rows. Runs are written by the scheduled job / the send-now action (service role); a customer
-- can only read them. The scheduled job is the route /api/cron/run-scheduled-reports, called every minute by pg_cron through
-- invoke_cron_route (the same way the other cron routes are).
--
--   params   {"series":[{"param":"pv","label":"My solar"}, ...], "period":"last30", "formats":["pdf","csv"], "comparePrevious":false}
--   schedule_dow  0 = Sunday ... 6 = Saturday;  schedule_dom  1-28, or 0 for the last day of the month.  Times are India time.

create table if not exists waytara.customer_reports (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references waytara.customers(id) on delete cascade,
  equipment_id  uuid references waytara.equipment(id) on delete set null,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  params        jsonb not null,
  schedule_kind text not null default 'none' check (schedule_kind in ('none', 'daily', 'weekly', 'monthly')),
  schedule_time time not null default '08:00',
  schedule_dow  smallint check (schedule_dow between 0 and 6),
  schedule_dom  smallint check (schedule_dom between 0 and 28),
  send_to_me    boolean not null default true,
  recipients    text[] not null default '{}' check (cardinality(recipients) <= 10),
  enabled       boolean not null default true,
  next_run_at   timestamptz,
  last_run_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists customer_reports_customer_idx on waytara.customer_reports (customer_id);
create index if not exists customer_reports_due_idx on waytara.customer_reports (next_run_at) where enabled and schedule_kind <> 'none';

create table if not exists waytara.customer_report_runs (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references waytara.customer_reports(id) on delete cascade,
  customer_id uuid not null references waytara.customers(id) on delete cascade,
  trigger     text not null check (trigger in ('schedule', 'send_now')),
  status      text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  recipients  text[] not null default '{}',
  file_names  text[] not null default '{}',
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists customer_report_runs_report_idx on waytara.customer_report_runs (report_id, started_at desc);
create index if not exists customer_report_runs_customer_idx on waytara.customer_report_runs (customer_id, started_at desc);

create or replace function waytara.touch_customer_report()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_reports_touch on waytara.customer_reports;
create trigger customer_reports_touch before update on waytara.customer_reports
  for each row execute function waytara.touch_customer_report();

alter table waytara.customer_reports enable row level security;
alter table waytara.customer_report_runs enable row level security;

drop policy if exists customer_reports_own on waytara.customer_reports;
create policy customer_reports_own on waytara.customer_reports
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

drop policy if exists customer_report_runs_read_own on waytara.customer_report_runs;
create policy customer_report_runs_read_own on waytara.customer_report_runs
  for select to authenticated
  using (customer_id = (select auth.uid()));

grant select, insert, update, delete on waytara.customer_reports to authenticated;
grant select on waytara.customer_report_runs to authenticated;
grant all on waytara.customer_reports, waytara.customer_report_runs to service_role;

-- Live: the dashboard shows a report being sent (and its result) as it happens.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['customer_reports', 'customer_report_runs'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'waytara' and tablename = t) then
        execute format('alter publication supabase_realtime add table waytara.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- The scheduled job: every minute, ask the app which reports are due (it claims them, generates, and e-mails).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'run-scheduled-reports';
    perform cron.schedule('run-scheduled-reports', '* * * * *', $job$select waytara.invoke_cron_route('/api/cron/run-scheduled-reports')$job$);
  end if;
end $$;
