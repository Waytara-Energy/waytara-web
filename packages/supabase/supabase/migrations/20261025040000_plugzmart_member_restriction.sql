-- Migration: Keep Plugzmart charger visible only for Manoj L (site owner) and exclude it for site members (Devaansh & Arun)

-- 1. Clear customer_hidden_at so Manoj (as site owner) sees the charger
update waytara.equipment
set customer_hidden_at = null
where id = 'b63f7d02-42d0-493b-a6e5-7620f4e94393';

-- 2. Update devices_member policy to exclude the Plugzmart charger for members
drop policy if exists "devices_member" on waytara.equipment;
create policy "devices_member" on waytara.equipment
for select
using (
  customer_hidden_at is null
  and id != 'b63f7d02-42d0-493b-a6e5-7620f4e94393'
  and site_id in (
    select sm.site_id from waytara.site_members sm where sm.user_id = (select auth.uid())
  )
);

-- 3. Update equipment_metrics_member policy
drop policy if exists "equipment_metrics_member" on waytara.equipment_metrics;
create policy "equipment_metrics_member" on waytara.equipment_metrics
for select
using (
  equipment_id != 'b63f7d02-42d0-493b-a6e5-7620f4e94393'
  and equipment_id in (
    select equipment.id from waytara.equipment
    where equipment.site_id in (
      select site_members.site_id from waytara.site_members where site_members.user_id = (select auth.uid())
    )
  )
);

-- 4. Update can_view_equipment to also exclude it for site members
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
      where d.id = p_equipment_id 
        and sm.user_id = (select auth.uid())
        and d.id != 'b63f7d02-42d0-493b-a6e5-7620f4e94393'
    )
    or exists (
      select 1 from waytara.equipment d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = p_equipment_id and co.employee_id = (select auth.uid())
    )
  );
$$;
