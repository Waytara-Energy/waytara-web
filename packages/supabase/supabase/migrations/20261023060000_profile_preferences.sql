-- Application Settings (customer app): what a person chooses about their own screens and their own sign-in, kept on their profile, and the
-- one-time codes that prove a new e-mail address is theirs.
--
-- ui_preferences:       { overview_cards: [4 card ids], overview_background: {...} } (see apps/web/src/lib/overview-prefs.ts)
-- security_preferences: { idle_minutes: number | null, idle_scope: "device" | "all" } (see apps/web/src/lib/session-policy.ts)
-- Both are updatable by the person themselves (the column grant below; the row policy profiles_self_update already limits it to their row)
-- and capped in size, so a profile row cannot be used to store arbitrary amounts of data.

alter table waytara.profiles
  add column if not exists ui_preferences jsonb not null default '{}'::jsonb,
  add column if not exists security_preferences jsonb not null default '{}'::jsonb;

alter table waytara.profiles drop constraint if exists profiles_preferences_small;
alter table waytara.profiles add constraint profiles_preferences_small
  check (pg_column_size(ui_preferences) < 8192 and pg_column_size(security_preferences) < 2048);

grant update (ui_preferences, security_preferences) on waytara.profiles to authenticated;

-- A pending e-mail change: the code is stored hashed, expires, and allows a few wrong tries. Only the server (service role) touches it:
-- row-level security is on with no policy, and the table is closed to the app roles.
create table if not exists waytara.email_change_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  new_email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table waytara.email_change_codes enable row level security;
revoke all on waytara.email_change_codes from anon, authenticated;

-- To undo: drop table waytara.email_change_codes;
--          alter table waytara.profiles drop constraint profiles_preferences_small, drop column ui_preferences, drop column security_preferences;
