-- Migration: Update can_view_equipment to include site_members and restore Waytara Office for Manoj
-- 1. Update can_view_equipment so request_live and private live realtime channels work for site_members
create or replace function waytara.can_view_equipment(p_equipment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select p_equipment_id is not null and (
    (select waytara.is_admin())
    or exists (
      select 1 from waytara.equipment d join waytara.sites s on s.id = d.site_id
      where d.id = p_equipment_id and s.customer_id = (select auth.uid())
    )
    or exists (
      select 1 from waytara.equipment d join waytara.site_members sm on sm.site_id = d.site_id
      where d.id = p_equipment_id and sm.user_id = (select auth.uid())
    )
    or exists (
      select 1 from waytara.equipment d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = p_equipment_id and co.employee_id = (select auth.uid())
    )
  );
$$;

revoke all on function waytara.can_view_equipment(uuid) from public, anon;
grant execute on function waytara.can_view_equipment(uuid) to authenticated, service_role;

-- 2. Restore Manoj as owner of Waytara Office
update waytara.sites
set customer_id = '7b3abc68-c970-49d7-86b9-5650e79da3e5'
where id = '9a3947a4-b37e-471c-b97c-141acedaa96d';

-- 3. Ensure Manoj profile has role 'customer' for standard customer portal access
update waytara.profiles
set role = 'customer'
where id = '7b3abc68-c970-49d7-86b9-5650e79da3e5';

-- 4. Add Manoj to site_members for Waytara Office (alongside Devaansh and Arun)
insert into waytara.site_members (site_id, user_id, role)
values ('9a3947a4-b37e-471c-b97c-141acedaa96d', '7b3abc68-c970-49d7-86b9-5650e79da3e5', 'owner')
on conflict (site_id, user_id) do nothing;
