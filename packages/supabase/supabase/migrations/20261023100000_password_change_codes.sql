-- Changing the password needs a one-time code sent to the account's e-mail (Application Settings > Security). Same shape as email_change_codes:
-- the code is stored hashed, expires, allows a few wrong tries, and only the server (service role) touches the table: row-level security is on
-- with no policy, and the table is closed to the app roles.
create table if not exists waytara.password_change_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table waytara.password_change_codes enable row level security;
revoke all on waytara.password_change_codes from anon, authenticated;

-- To undo: drop table waytara.password_change_codes;
