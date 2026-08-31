-- Task 9.6: Application Settings needs somewhere to store notification
-- preferences — no column existed for it. Small, additive, defaults to
-- "everything on" so existing rows don't silently go quiet.

alter table waytara.profiles
  add column if not exists notification_preferences jsonb not null default '{"email_alerts": true, "email_maintenance_updates": true}'::jsonb;

-- Already covered by the profiles_self_update policy/column-grant from
-- 20260831190000 (full_name, phone, avatar_url) — add this column to that
-- same grant so self-update can touch it too.
grant update (notification_preferences) on waytara.profiles to authenticated;
