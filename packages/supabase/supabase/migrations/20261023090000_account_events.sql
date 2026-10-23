-- A person's own account activity (Application Settings > Security): sign-ins, sign-outs, a changed password or e-mail, two-factor changes, with the
-- device, the place and the time. Written by the server (service role) whenever one of those happens, whatever the person's e-mail settings;
-- the person can only read their own rows. Old rows are pruned by the writer (90 days).

create table if not exists waytara.account_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references waytara.profiles (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  device text check (device is null or char_length(device) <= 120),
  place text check (place is null or char_length(place) <= 160),
  ip text check (ip is null or char_length(ip) <= 64),
  created_at timestamptz not null default now()
);

create index if not exists account_events_by_person on waytara.account_events (customer_id, created_at desc);

alter table waytara.account_events enable row level security;

drop policy if exists "account_events_owner_select" on waytara.account_events;
create policy "account_events_owner_select" on waytara.account_events for select to authenticated using (customer_id = auth.uid());

revoke all on waytara.account_events from anon, authenticated;
grant select on waytara.account_events to authenticated;

-- To undo: drop table waytara.account_events;
