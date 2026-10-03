-- Production security hardening (Phase 1).
--
--  1. Functions: nothing in the waytara schema should be callable by the
--     anonymous (logged-out) role or by PUBLIC. RLS helpers still need to be
--     executable by `authenticated` (policies evaluate them as the caller)
--     and `service_role`.
--  2. Storage: quotation PDFs are customer pricing documents — the bucket
--     becomes private; the app hands out short-lived signed URLs instead.
--  3. Lead form (the only anonymous write): DB-level guardrails so a bad
--     client can't insert privileged state or oversized payloads, plus a
--     Postgres-backed rate limiter that works across serverless instances.
--  4. Scheduling: pg_cron + pg_net call the app's cron routes with a bearer
--     secret held in Supabase Vault (never in git).

-- ============================================================
-- 1. Function execute privileges
-- ============================================================
revoke execute on all functions in schema waytara from public, anon;
grant  execute on all functions in schema waytara to authenticated, service_role;

-- Future functions in this schema start locked down too.
alter default privileges in schema waytara revoke execute on functions from public, anon;

-- ============================================================
-- 2. Quotation PDFs: private bucket
-- ============================================================
update storage.buckets set public = false where id = 'quotation-pdfs';

-- pdf_url used to hold a public URL; it now holds the object path inside
-- the private bucket (e.g. '<quotation id>.pdf'). Normalise the one legacy
-- value if it is a full URL.
update waytara.quotations
set pdf_url = regexp_replace(pdf_url, '^.*/quotation-pdfs/', '')
where pdf_url like 'http%quotation-pdfs/%';

comment on column waytara.quotations.pdf_url is
  'Object path inside the PRIVATE storage bucket quotation-pdfs (not a URL). Serve via a signed URL.';

-- ============================================================
-- 3a. Lead form guardrails
-- ============================================================
alter table waytara.leads
  drop constraint if exists leads_field_lengths,
  add  constraint leads_field_lengths check (
    char_length(full_name) between 1 and 200
    and char_length(email) <= 320
    and (phone is null or char_length(phone) <= 32)
    and (message is null or char_length(message) <= 5000)
    and (source is null or char_length(source) <= 64)
  );

-- Anonymous/authenticated visitors may only create a plain 'new', unassigned
-- lead — never a pre-assigned or pre-converted one.
drop policy if exists leads_public_insert on waytara.leads;
create policy leads_public_insert on waytara.leads
  for insert to anon, authenticated
  with check (status = 'new' and assigned_to is null and accepted_at is null);

-- ============================================================
-- 3b. Postgres-backed rate limiter
-- ============================================================
create table if not exists waytara.rate_limit_events (
  id         bigint generated always as identity primary key,
  bucket     text        not null,
  key_hash   text        not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_lookup_idx
  on waytara.rate_limit_events (bucket, key_hash, created_at desc);

alter table waytara.rate_limit_events enable row level security;
-- No policies on purpose: only the SECURITY DEFINER function below (and
-- service_role) ever touch this table.
revoke all on waytara.rate_limit_events from anon, authenticated;

-- Atomically records a hit and reports whether the caller is still within
-- `p_max` hits per `p_window_seconds`. Returns true when the request is
-- ALLOWED. The key is hashed (sha256) so raw IPs are never stored.
create or replace function waytara.consume_rate_limit(
  p_bucket text,
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = waytara, public, pg_temp
as $$
declare
  v_hash  text := encode(extensions.digest(p_key, 'sha256'), 'hex');
  v_count int;
begin
  -- Serialise concurrent hits for the same key so the count below is exact.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || v_hash, 0));

  select count(*) into v_count
  from rate_limit_events
  where bucket = p_bucket
    and key_hash = v_hash
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into rate_limit_events (bucket, key_hash) values (p_bucket, v_hash);
  return true;
end;
$$;

revoke all on function waytara.consume_rate_limit(text, text, int, int) from public, anon, authenticated;
grant execute on function waytara.consume_rate_limit(text, text, int, int) to service_role;

-- ============================================================
-- 4. Scheduling via pg_cron + pg_net
-- ============================================================
create extension if not exists pg_net  with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Calls one of the app's cron routes. Reads two Vault secrets:
--   app_base_url  e.g. https://waytaraenergy.com
--   cron_secret   same value as CRON_SECRET in the Vercel project
-- If either is missing the call is skipped with a NOTICE, so applying this
-- migration before the secrets exist is harmless.
create or replace function waytara.invoke_cron_route(p_path text)
returns void
language plpgsql
security definer
set search_path = waytara, public, extensions, vault, pg_temp
as $$
declare
  v_base   text;
  v_secret text;
begin
  select decrypted_secret into v_base   from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';

  if v_base is null or v_secret is null then
    raise notice 'invoke_cron_route(%): vault secrets app_base_url / cron_secret not set — skipped', p_path;
    return;
  end if;

  perform net.http_get(
    url                  := rtrim(v_base, '/') || p_path,
    headers              := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 25000
  );
end;
$$;

revoke all on function waytara.invoke_cron_route(text) from public, anon, authenticated;

-- Idempotent (re)scheduling.
do $$
declare j text;
begin
  foreach j in array array['detect-alerts', 'detect-charging-sessions', 'purge-rate-limit-events'] loop
    perform cron.unschedule(j) from cron.job where jobname = j;
  end loop;
end $$;

select cron.schedule('detect-alerts',            '*/15 * * * *', $$select waytara.invoke_cron_route('/api/cron/detect-alerts')$$);
select cron.schedule('detect-charging-sessions', '*/2 * * * *',  $$select waytara.invoke_cron_route('/api/cron/detect-charging-sessions')$$);
select cron.schedule('purge-rate-limit-events',  '17 * * * *',   $$delete from waytara.rate_limit_events where created_at < now() - interval '1 day'$$);
