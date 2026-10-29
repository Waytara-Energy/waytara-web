-- The categories of the stock catalog become a list of their own, so an admin can add one before any item uses it and remove one that nothing uses.
--
-- Until now a category existed only as the text on stock items, so it could neither be added on its own nor removed. This table holds the names
-- (seeded from the ones in use today). A category that still has stock items cannot be removed, and neither can solar_inverter or ev_charger:
-- the database and the dashboards look for those two names exactly.

create table if not exists waytara.stock_categories (
  name        text primary key check (length(btrim(name)) > 0),
  created_at  timestamptz not null default now()
);

comment on table waytara.stock_categories is 'The categories offered when adding or editing a stock item. See migration 20261029040000.';

insert into waytara.stock_categories (name)
select distinct category from waytara.equipment_inventory where category is not null and btrim(category) <> ''
on conflict do nothing;

create or replace function waytara.stock_category_guard() returns trigger
language plpgsql security definer set search_path = waytara, pg_temp as $$
begin
  if old.name in ('solar_inverter', 'ev_charger') then
    raise exception 'The category % is used by the system and cannot be removed.', old.name using errcode = 'P0001';
  end if;
  if exists (select 1 from waytara.equipment_inventory where category = old.name) then
    raise exception 'The category % still has stock items. Move them to another category first.', old.name using errcode = 'P0001';
  end if;
  return old;
end $$;

drop trigger if exists stock_category_guard on waytara.stock_categories;
create trigger stock_category_guard before delete on waytara.stock_categories for each row execute function waytara.stock_category_guard();

alter table waytara.stock_categories enable row level security;
revoke all on waytara.stock_categories from public, anon, authenticated;
grant select, insert, delete on waytara.stock_categories to authenticated;

drop policy if exists stock_categories_admin_select on waytara.stock_categories;
drop policy if exists stock_categories_admin_insert on waytara.stock_categories;
drop policy if exists stock_categories_admin_delete on waytara.stock_categories;
create policy stock_categories_admin_select on waytara.stock_categories for select to authenticated using ((select waytara.is_admin()));
create policy stock_categories_admin_insert on waytara.stock_categories for insert to authenticated with check ((select waytara.is_admin()));
create policy stock_categories_admin_delete on waytara.stock_categories for delete to authenticated using ((select waytara.is_admin()));
