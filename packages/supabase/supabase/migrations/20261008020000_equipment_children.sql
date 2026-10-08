-- Parent and child equipment. A customer's installation is more than one device: an inverter that reports readings, and
-- the panels, battery, meters and so on that belong to it. Only the inverter (or an EV charger) is a MONITORED DEVICE:
-- it has a register map, readings, alerts, and appears on the customer's dashboard. Everything else is CHILD EQUIPMENT: it
-- is allocated to the customer under one inverter, has no readings and is never shown as a device - the dashboard reads
-- it for what it knows (panel size for yield per kWp, battery size for cycles and health, warranty dates).
--
--   parent_id   the monitored device this equipment belongs to (same site, one level deep)
--   quantity    how many units this row stands for (12 panels = one row with quantity 12)
--   retired_at  when it was taken out (kept for history, e.g. a replaced battery)
--
-- waytara.assign_child_equipment() is the one way staff allocate child equipment: it checks the rules, takes the units
-- off the stock count and creates the row in one step.

alter table waytara.equipment add column if not exists parent_id uuid references waytara.equipment (id) on delete set null;
alter table waytara.equipment add column if not exists quantity integer not null default 1 check (quantity > 0);
alter table waytara.equipment add column if not exists retired_at timestamptz;
comment on column waytara.equipment.parent_id is 'The monitored device this equipment belongs to; null for a monitored device itself.';
comment on column waytara.equipment.quantity is 'How many units this row stands for (panels are one row with a quantity).';
comment on column waytara.equipment.retired_at is 'When this equipment was taken out; it stays on record.';
create index if not exists equipment_parent_idx on waytara.equipment (parent_id) where parent_id is not null;

-- Stock categories that are devices with readings; every other category is child equipment.
create or replace function waytara.is_monitored_category(p_category text)
returns boolean language sql immutable as $$ select coalesce(p_category in ('solar_inverter', 'ev_charger'), false) $$;

create or replace function waytara.check_equipment_parent()
returns trigger
language plpgsql
as $$
declare
  p record;
  v_category text;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'equipment cannot be its own parent' using errcode = '23514';
  end if;
  select e.site_id, e.parent_id, i.category into p
    from waytara.equipment e join waytara.equipment_inventory i on i.id = e.stock_id
   where e.id = new.parent_id;
  if not found then
    raise exception 'parent equipment not found' using errcode = '23503';
  end if;
  if p.site_id <> new.site_id then
    raise exception 'child equipment must be at the same site as its parent' using errcode = '23514';
  end if;
  if p.parent_id is not null then
    raise exception 'a child cannot have children (one level only)' using errcode = '23514';
  end if;
  if not waytara.is_monitored_category(p.category) then
    raise exception 'the parent must be a monitored device (inverter or charger)' using errcode = '23514';
  end if;
  select category into v_category from waytara.equipment_inventory where id = new.stock_id;
  if waytara.is_monitored_category(v_category) then
    raise exception 'a monitored device cannot be a child' using errcode = '23514';
  end if;
  if exists (select 1 from waytara.equipment where parent_id = new.id) then
    raise exception 'this equipment already has children, so it cannot become one' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists equipment_parent_check on waytara.equipment;
create trigger equipment_parent_check
  before insert or update of parent_id, site_id, stock_id on waytara.equipment
  for each row execute function waytara.check_equipment_parent();

-- Allocate p_quantity units of a stock item to the customer under the monitored device p_parent.
create or replace function waytara.assign_child_equipment(p_parent uuid, p_stock uuid, p_quantity integer default 1, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_site uuid;
  v_available integer;
  v_category text;
  v_id uuid;
begin
  if not waytara.is_staff() then
    raise exception 'only staff can allocate equipment' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be at least 1' using errcode = '22023';
  end if;
  select site_id into v_site from waytara.equipment where id = p_parent;
  if not found then
    raise exception 'parent device not found' using errcode = '22023';
  end if;
  select quantity, category into v_available, v_category from waytara.equipment_inventory where id = p_stock for update;
  if not found then
    raise exception 'stock item not found' using errcode = '22023';
  end if;
  if waytara.is_monitored_category(v_category) then
    raise exception 'inverters and chargers are added as devices, not as child equipment' using errcode = '22023';
  end if;
  if v_available < p_quantity then
    raise exception 'only % in stock', v_available using errcode = '22023';
  end if;

  insert into waytara.equipment (site_id, stock_id, label, device_status, parent_id, quantity)
  values (v_site, p_stock, nullif(trim(p_label), ''), 'active', p_parent, p_quantity)
  returning id into v_id;

  update waytara.equipment_inventory
     set quantity = quantity - p_quantity,
         status = case when quantity - p_quantity = 0 then 'allocated' else status end
   where id = p_stock;
  return v_id;
end;
$$;

revoke all on function waytara.assign_child_equipment(uuid, uuid, integer, text) from public, anon;
grant execute on function waytara.assign_child_equipment(uuid, uuid, integer, text) to authenticated, service_role;
