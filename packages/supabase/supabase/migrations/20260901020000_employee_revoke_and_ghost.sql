-- Task: revoke/restore/permanently-delete an employee's access, matching
-- how GitHub/Vercel/Supabase itself handle "remove from org" (revoke
-- access, keep every historical record intact under the real name) vs.
-- true account deletion (rare — GitHub falls back to its own `ghost`
-- placeholder account rather than erasing history).
--
-- profiles.id IS auth.users.id (profiles_id_fkey ... ON DELETE CASCADE,
-- and profiles.id is profiles' own primary key) — a primary key can't be
-- set to null, so there is no way to delete the auth user and keep the
-- profiles row. The only way to get a real, trackable "ghost" is to never
-- delete the row at all: ban sign-in permanently instead, and let the
-- admin choose what name the row carries afterward. Every leads.assigned_
-- to / quotations.employee_id / audit_log.actor_id / etc. reference stays
-- pointing at this same row either way — nothing nulls out for this path.
--
-- deactivated_at: set for BOTH a plain revoke and a permanent delete —
-- either way sign-in is blocked. getCurrentProfile() treats a deactivated
-- profile as "no session" everywhere in both apps, in addition to the
-- real block being the Supabase Auth ban itself (auth.admin.
-- updateUserById ban_duration), which is what actually prevents a new
-- sign-in/session-refresh at the identity-provider level.
--
-- deleted_at: set only for the irreversible permanent-delete path — the
-- UI won't offer "Restore access" once this is set, even though nothing
-- stops an admin from clearing it directly in the database if truly
-- needed.

alter table waytara.profiles
  add column if not exists deactivated_at timestamptz,
  add column if not exists deleted_at timestamptz;
