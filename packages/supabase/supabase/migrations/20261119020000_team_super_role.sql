-- Super user: a team member the owner (or another super user) has given everything. They see every page and every device of the owner's account, current AND future
-- ones, may operate them all, and manage the scheduled reports and the team. (What a super user still cannot do is what is tied to the owner's own sign-in rather
-- than to the system: the owner's billing, support tickets and alert rules.)
--
-- Two things change, and nothing else:
--   1. team_members.role may also be 'super' (the check that listed the four roles is widened).
--   2. team_grants gives a super member every top-level device of the owner's sites at 'operate' (the children, such as the panels or the battery, follow their
--      parent as before), so a device added to the owner's site tomorrow is theirs too, with no list to keep up to date. Every other member is as before.
--      Their pages and the schedule switch are stored on the row (all of them), so the existing page and schedule rules apply unchanged.
-- Safe to apply on its own: it only adds access for a role no one has yet.

do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'waytara.team_members'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%viewer%' and pg_get_constraintdef(oid) like '%operator%'
  loop
    execute format('alter table waytara.team_members drop constraint %I', c);
  end loop;
end $$;

alter table waytara.team_members
  add constraint team_members_role_check check (role in ('viewer', 'operator', 'manager', 'custom', 'super'));

create or replace function waytara.team_grants(p_user uuid)
returns table (member_id uuid, owner_id uuid, equipment_id uuid, level text, pages text[], can_schedule boolean)
language sql stable security definer set search_path = waytara, pg_temp
as $$
  -- the devices the owner chose for the member
  select m.id, m.owner_id, d.equipment_id, d.level, m.pages, m.can_schedule
  from waytara.team_members m
  join waytara.team_member_devices d on d.member_id = m.id
  join waytara.profiles u on u.id = m.user_id and u.deactivated_at is null and u.deleted_at is null
  join waytara.profiles o on o.id = m.owner_id and o.deactivated_at is null and o.deleted_at is null
  where m.user_id = p_user and m.status = 'active' and m.role <> 'super'
  union all
  -- a super user: every top-level device of the owner's sites, to operate
  select m.id, m.owner_id, e.id, 'operate'::text, m.pages, m.can_schedule
  from waytara.team_members m
  join waytara.profiles u on u.id = m.user_id and u.deactivated_at is null and u.deleted_at is null
  join waytara.profiles o on o.id = m.owner_id and o.deactivated_at is null and o.deleted_at is null
  join waytara.sites s on s.customer_id = m.owner_id
  join waytara.equipment e on e.site_id = s.id and e.parent_id is null
  where m.user_id = p_user and m.status = 'active' and m.role = 'super'
$$;
revoke all on function waytara.team_grants(uuid) from public, anon, authenticated;

-- Rollback: restore team_grants from 20261119000000_team_members.sql, set any 'super' row to 'manager', and restore the four-role check.
