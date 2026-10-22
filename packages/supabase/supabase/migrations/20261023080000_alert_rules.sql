-- Customer alerts: "tell me when the battery is below 20%". Two kinds of row in alert_rules: a custom alert the customer made (preset_id is null),
-- and a change to one of the ready-made alerts that live in the code (preset_id set: the customer switched it off, or moved its limit). A ready-made
-- alert nobody touched has no row; the evaluation job (/api/cron/evaluate-alert-rules, every 5 minutes) treats it as its default.
-- alert_rule_state remembers, per customer, rule and site, whether a rule is currently "tripped" and when it last fired, so one crossing is one
-- notice (not one every 5 minutes) and cooldowns hold. Only the server (service role) touches the state.

create table if not exists waytara.alert_rules (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references waytara.customers (id) on delete cascade,
  preset_id text,
  name text,
  metric text not null check (char_length(metric) between 1 and 40),
  op text not null check (op in ('above', 'below')),
  threshold numeric not null check (threshold between -1000000000 and 1000000000),
  site_id uuid references waytara.sites (id) on delete cascade,
  notify_email boolean not null default true,
  notify_app boolean not null default true,
  cooldown_minutes int not null default 60 check (cooldown_minutes between 5 and 10080),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alert_rules_name_short check (name is null or char_length(name) <= 80)
);

create unique index if not exists alert_rules_one_per_preset on waytara.alert_rules (customer_id, preset_id) where preset_id is not null;
create index if not exists alert_rules_by_customer on waytara.alert_rules (customer_id);

alter table waytara.alert_rules enable row level security;

drop policy if exists "alert_rules_owner_all" on waytara.alert_rules;
create policy "alert_rules_owner_all" on waytara.alert_rules for all to authenticated
  using (customer_id = auth.uid())
  with check (
    customer_id = auth.uid()
    and (site_id is null or exists (select 1 from waytara.sites s where s.id = site_id and s.customer_id = auth.uid()))
  );

revoke all on waytara.alert_rules from anon;
grant select, insert, update, delete on waytara.alert_rules to authenticated;

-- a customer cannot pile up an unbounded number of rows
create or replace function waytara._alert_rules_limit() returns trigger language plpgsql security definer set search_path = waytara, pg_temp as $$
begin
  if (select count(*) from waytara.alert_rules where customer_id = new.customer_id) >= 60 then
    raise exception 'That is the most alerts you can have. Delete one first.' using errcode = '54000';
  end if;
  return new;
end;
$$;
drop trigger if exists alert_rules_limit on waytara.alert_rules;
create trigger alert_rules_limit before insert on waytara.alert_rules for each row execute function waytara._alert_rules_limit();
revoke all on function waytara._alert_rules_limit() from public, anon, authenticated;

create or replace function waytara._alert_rules_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists alert_rules_touch on waytara.alert_rules;
create trigger alert_rules_touch before update on waytara.alert_rules for each row execute function waytara._alert_rules_touch();

create table if not exists waytara.alert_rule_state (
  customer_id uuid not null references waytara.customers (id) on delete cascade,
  rule_key text not null,
  site_id uuid not null references waytara.sites (id) on delete cascade,
  active boolean not null default false,
  last_fired_at timestamptz,
  last_value numeric,
  alert_id uuid,
  primary key (customer_id, rule_key, site_id)
);
alter table waytara.alert_rule_state enable row level security;
revoke all on waytara.alert_rule_state from anon, authenticated;

select cron.schedule('evaluate-alert-rules', '*/5 * * * *', $$select waytara.invoke_cron_route('/api/cron/evaluate-alert-rules')$$);

-- To undo: select cron.unschedule('evaluate-alert-rules'); drop table waytara.alert_rule_state; drop table waytara.alert_rules;
--          drop function waytara._alert_rules_limit(); drop function waytara._alert_rules_touch();
