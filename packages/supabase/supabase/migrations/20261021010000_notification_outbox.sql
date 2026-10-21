-- The queue behind the device-status e-mails, and the hub's health as the database sees it (task T2 of docs/GATEWAY_V3_TASKS.md).
--
-- One function, waytara.fleet_tick(), runs every 10 seconds (next migration). It decides what has to be said to whom and writes it
-- here; a sender (the dashboard app's mailer route) takes the due rows, sends them and marks them sent. Splitting "decide" from
-- "send" is what keeps the rules in one place and stops an e-mail going out twice: every event has a unique key.
--
--   notification_outbox   one row per event: a device went offline, is still offline, is back; or the hub went down / came back.
--   notification_state    when a customer was last sent a device-status e-mail (the sender keeps 10 minutes between them).
--   hub_health            one row: what the last calls to the hub said. Used to hold back customer e-mails while the hub itself is down.
--
-- Only the server side (the service role and the SECURITY DEFINER functions) touches these tables. No signed-in user can read them.

create table if not exists waytara.hub_health (
  id                    boolean primary key default true check (id),
  last_request_id       bigint,
  last_request_at       timestamptz,
  last_ok_at            timestamptz,
  consecutive_failures  integer not null default 0 check (consecutive_failures >= 0),
  hub_up                boolean not null default true,
  down_since            timestamptz,
  hub_uptime_s          numeric,
  boards_connected      integer,
  hub_version           text,
  updated_at            timestamptz not null default now()
);

comment on table waytara.hub_health is 'One row. What the hub answered to the 10-second call from fleet_tick(), and whether the hub counts as up.';
comment on column waytara.hub_health.last_request_id is 'The pg_net request id of the call made at the previous tick; its answer is read at the next one.';
comment on column waytara.hub_health.hub_up is 'False after 3 calls in a row got no good answer; true again with the first good answer.';

insert into waytara.hub_health (id) values (true) on conflict (id) do nothing;

create table if not exists waytara.notification_outbox (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  audience    text not null check (audience in ('customer', 'admin')),
  kind        text not null check (kind in ('offline', 'still_offline', 'back_online', 'hub_down', 'hub_back')),
  -- the person it is for (a customer's profile); null for an admin broadcast
  customer_id uuid references waytara.profiles(id) on delete cascade,
  device_id   uuid references waytara.equipment(id) on delete cascade,
  alert_id    uuid references waytara.alerts(id) on delete set null,
  -- one row per event: "offline:<alert id>", "reminder:<alert id>:<n>", "online:<alert id>", "hub_down:<since>" ...
  dedupe_key  text not null unique,
  due_at      timestamptz not null default now(),
  payload     jsonb not null default '{}'::jsonb,
  sent_at     timestamptz,
  attempts    integer not null default 0 check (attempts >= 0),
  last_error  text,
  check ((audience = 'customer') = (customer_id is not null))
);

comment on table waytara.notification_outbox is 'Device-status e-mails waiting to be sent (and the record of those sent). One row per event; dedupe_key makes sending twice impossible.';
comment on column waytara.notification_outbox.payload is 'What the mail needs: device label, site, reason, since, how long it was down, ...';

create index if not exists notification_outbox_due_idx on waytara.notification_outbox (due_at) where sent_at is null;
create index if not exists notification_outbox_customer_idx on waytara.notification_outbox (customer_id, created_at desc);

create table if not exists waytara.notification_state (
  customer_id           uuid primary key references waytara.profiles(id) on delete cascade,
  last_status_email_at  timestamptz
);

comment on table waytara.notification_state is 'When each customer was last sent a device-status e-mail: the sender waits 10 minutes between two of them.';

alter table waytara.hub_health enable row level security;
alter table waytara.notification_outbox enable row level security;
alter table waytara.notification_state enable row level security;

revoke all on waytara.hub_health, waytara.notification_outbox, waytara.notification_state from public, anon, authenticated;
grant select, insert, update, delete on waytara.hub_health, waytara.notification_outbox, waytara.notification_state to service_role;
grant usage on sequence waytara.notification_outbox_id_seq to service_role;

-- To undo (nothing else depends on these yet):
--   drop table waytara.notification_state, waytara.notification_outbox, waytara.hub_health;
