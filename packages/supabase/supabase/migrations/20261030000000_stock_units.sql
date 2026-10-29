-- Stock the way an equipment business runs it: a CATALOG of models, and under each model the physical stock, tracked unit by unit.
--
--   equipment_inventory   the MODEL (what the product is: brand, specs, warranty, manual, data sheet). It no longer stands for one unit.
--                         `tracking` says how its stock is counted: 'serial' (every unit has its own serial number: inverters, EV chargers,
--                         batteries, meters, ESP32 hubs) or 'lot' (a batch with an id and a quantity that is drawn down: panels, cable, MCBs).
--   stock_receipts        one delivery: supplier, purchase order (reference and the file), date, cost, how many came in.
--   stock_units           one serial-numbered unit, or one lot. Its status follows it through its life:
--                         in_stock -> reserved (held for a customer) -> installed (at a customer's site), and out of the way as
--                         repair / damaged / returned / retired; a lot that has been drawn down to nothing is used_up.
--   stock_movements       the history: every receipt, reservation, installation and status change, with who and when.
--
-- Staff can see what is in stock (they pick a unit when they set a customer up); only admins change stock directly. The customer-visible model
-- row no longer carries purchase details (supplier, PO, cost): those moved to receipts, which customers cannot read.
--
-- Existing stock is carried over: models that were entered twice (one row per serial number) become one model with several units, and the devices
-- already at customers keep working (equipment.stock_id still points at the model; equipment.stock_unit_id now says which unit it is).

-- 1. the model ----------------------------------------------------------------------------------------------------------------------------------

alter table waytara.equipment_inventory
  add column if not exists tracking text not null default 'lot' check (tracking in ('serial', 'lot')),
  add column if not exists reorder_level integer not null default 0 check (reorder_level >= 0);

comment on column waytara.equipment_inventory.tracking is 'serial: every unit has its own serial number. lot: a batch with an id and a quantity.';
comment on column waytara.equipment_inventory.reorder_level is 'Stock at or below this many is flagged low.';
comment on column waytara.equipment_inventory.quantity is 'How many are in stock: kept in step with stock_units (the available units of the model).';

-- 2. receipts, units, movements -----------------------------------------------------------------------------------------------------------------

create table if not exists waytara.stock_receipts (
  id                       uuid primary key default gen_random_uuid(),
  model_id                 uuid not null references waytara.equipment_inventory (id) on delete restrict,
  received_on              date not null default current_date,
  supplier                 text,
  po_reference             text,
  unit_cost                numeric(12, 2),
  quantity                 integer not null check (quantity > 0),
  po_document_path         text,
  po_document_name         text,
  po_document_type         text,
  po_document_size         integer,
  po_document_uploaded_at  timestamptz,
  notes                    text,
  received_by              uuid references waytara.profiles (id) on delete set null,
  created_at               timestamptz not null default now()
);
create index if not exists stock_receipts_model_idx on waytara.stock_receipts (model_id, received_on desc);

create table if not exists waytara.stock_units (
  id            uuid primary key default gen_random_uuid(),
  model_id      uuid not null references waytara.equipment_inventory (id) on delete restrict,
  serial_number text not null check (btrim(serial_number) <> ''),
  -- a serialised unit is 1; a lot is how many came in the batch
  quantity      integer not null default 1 check (quantity >= 1),
  -- a lot is drawn down; a serialised unit keeps 1 for its whole life
  remaining     integer not null default 1 check (remaining >= 0),
  status        text not null default 'in_stock'
                  check (status in ('in_stock', 'reserved', 'installed', 'used_up', 'repair', 'damaged', 'returned', 'retired')),
  receipt_id    uuid references waytara.stock_receipts (id) on delete set null,
  location      text,
  notes         text,
  customer_id   uuid references waytara.profiles (id) on delete set null,
  site_id       uuid references waytara.sites (id) on delete set null,
  reserved_at   timestamptz,
  installed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (remaining <= quantity)
);
-- a serial number belongs to one unit (a lot's id likewise), whatever the capitals or spaces
create unique index if not exists stock_units_serial_key on waytara.stock_units (lower(btrim(serial_number)));
create index if not exists stock_units_model_idx on waytara.stock_units (model_id, status);
create index if not exists stock_units_customer_idx on waytara.stock_units (customer_id) where customer_id is not null;

drop trigger if exists stock_units_updated_at on waytara.stock_units;
create trigger stock_units_updated_at before update on waytara.stock_units for each row execute function waytara.set_updated_at();

create table if not exists waytara.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  model_id     uuid not null references waytara.equipment_inventory (id) on delete cascade,
  unit_id      uuid references waytara.stock_units (id) on delete set null,
  kind         text not null check (kind in ('received', 'reserved', 'released', 'installed', 'status', 'removed')),
  quantity     integer not null default 1,
  from_status  text,
  to_status    text,
  customer_id  uuid references waytara.profiles (id) on delete set null,
  site_id      uuid references waytara.sites (id) on delete set null,
  note         text,
  actor        uuid references waytara.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists stock_movements_model_idx on waytara.stock_movements (model_id, created_at desc);
create index if not exists stock_movements_unit_idx on waytara.stock_movements (unit_id, created_at desc) where unit_id is not null;

alter table waytara.equipment add column if not exists stock_unit_id uuid references waytara.stock_units (id) on delete set null;
create index if not exists equipment_stock_unit_idx on waytara.equipment (stock_unit_id) where stock_unit_id is not null;
comment on column waytara.equipment.stock_unit_id is 'The stock unit (serial number) or lot this equipment is.';

-- 3. the model's stock count follows its units --------------------------------------------------------------------------------------------------

create or replace function waytara.sync_model_stock(p_model uuid) returns void
language sql security definer set search_path = waytara, pg_temp as $$
  update waytara.equipment_inventory m
     set quantity = coalesce((select sum(u.remaining) from waytara.stock_units u where u.model_id = m.id and u.status = 'in_stock'), 0)
   where m.id = p_model;
$$;

create or replace function waytara.stock_units_after_change() returns trigger
language plpgsql security definer set search_path = waytara, pg_temp as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform waytara.sync_model_stock(old.model_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform waytara.sync_model_stock(new.model_id); end if;
  return null;
end $$;

drop trigger if exists stock_units_sync on waytara.stock_units;
create trigger stock_units_sync after insert or update or delete on waytara.stock_units for each row execute function waytara.stock_units_after_change();

-- 4. carry the existing stock over ---------------------------------------------------------------------------------------------------------------
-- Done once. A model entered once per serial number becomes one model; each old row that held stock becomes a receipt and a unit (or a lot).

do $$
begin
  if exists (select 1 from waytara.stock_units) or exists (select 1 from waytara.stock_receipts) then
    return;  -- already carried over
  end if;

  -- how each model's stock is counted
  update waytara.equipment_inventory
     set tracking = case when category in ('solar_inverter', 'ev_charger', 'Batteries', 'Metering & Monitoring') then 'serial' else 'lot' end;

  -- every old row, the model that stays for it, and what is already in use from it (before anything is repointed)
  create temp table _stock_rows on commit drop as
  with ranked as (
    select i.id,
           first_value(i.id) over (
             partition by lower(btrim(i.name)), i.category, lower(coalesce(i.brand, '')), lower(coalesce(i.model, '')), lower(coalesce(i.model_number, ''))
             order by (select count(*) from waytara.equipment e where e.stock_id = i.id) desc, i.created_at, i.id
           ) as keep_id
      from waytara.equipment_inventory i)
  select r.id as old_id, r.keep_id, keep.tracking,
         coalesce((select sum(e.quantity) from waytara.equipment e where e.stock_id = r.id and e.retired_at is null), 0)::integer as in_use,
         gen_random_uuid() as receipt_id, gen_random_uuid() as unit_id
    from ranked r join waytara.equipment_inventory keep on keep.id = r.keep_id;

  -- the old rows that hold stock: a serial model's row that has a serial number; a lot model's row with stock, or with some already in use
  create temp table _stock_lines on commit drop as
  select s.*, i.quantity as old_quantity, i.status::text as old_status,
         coalesce(nullif(btrim(i.serial_number), ''), 'LOT-' || upper(left(replace(i.id::text, '-', ''), 8))) as unit_serial,
         i.created_at as old_created
    from _stock_rows s join waytara.equipment_inventory i on i.id = s.old_id
   where (s.tracking = 'serial' and nullif(btrim(i.serial_number), '') is not null)
      or (s.tracking = 'lot' and (i.quantity > 0 or s.in_use > 0));

  -- which devices already use a line: a lot's devices all point at it; a serial unit is the first device that used it
  create temp table _stock_device_links on commit drop as
  select distinct on (case when l.tracking = 'serial' then l.unit_id else e.id end)
         e.id as equipment_id, l.unit_id, l.tracking, s.customer_id, e.site_id, coalesce(e.installed_at, e.created_at) as installed_at
    from _stock_lines l
    join waytara.equipment e on e.stock_id = l.old_id and e.retired_at is null
    join waytara.sites s on s.id = e.site_id
   order by case when l.tracking = 'serial' then l.unit_id else e.id end, e.created_at;

  insert into waytara.stock_receipts (id, model_id, received_on, supplier, po_reference, unit_cost, quantity,
                                      po_document_path, po_document_name, po_document_type, po_document_size, po_document_uploaded_at, notes)
  select l.receipt_id, l.keep_id, coalesce(i.purchase_date, i.created_at::date), i.supplier, i.po_reference,
         coalesce(i.purchase_price_amount, i.unit_price),
         case when l.tracking = 'serial' then 1 else greatest(1, l.old_quantity + l.in_use) end,
         i.po_document_path, i.po_document_name, i.po_document_type, i.po_document_size, i.po_document_uploaded_at,
         'Carried over from the earlier stock list.'
    from _stock_lines l join waytara.equipment_inventory i on i.id = l.old_id;

  insert into waytara.stock_units (id, model_id, serial_number, quantity, remaining, status, receipt_id, created_at)
  select l.unit_id, l.keep_id, l.unit_serial,
         case when l.tracking = 'serial' then 1 else greatest(1, l.old_quantity + l.in_use) end,
         case when l.tracking = 'serial' then 1 else greatest(0, l.old_quantity) end,
         case when l.tracking = 'serial' then (case when l.old_status in ('damaged', 'returned') then l.old_status else 'in_stock' end) when l.old_quantity > 0 then 'in_stock' else 'used_up' end,
         l.receipt_id, l.old_created
    from _stock_lines l;


  -- link the devices that use a line (before they are repointed: a lot's devices all point at its old row)
  update waytara.equipment e set stock_unit_id = k.unit_id from _stock_device_links k where e.id = k.equipment_id and k.tracking = 'serial';
  update waytara.equipment e set stock_unit_id = l.unit_id
    from _stock_lines l where l.tracking = 'lot' and e.stock_id = l.old_id and e.retired_at is null and e.stock_unit_id is null;

  -- devices that pointed at a duplicate now point at the model that stays
  update waytara.equipment e set stock_id = r.keep_id from _stock_rows r where e.stock_id = r.old_id and r.old_id <> r.keep_id;

  -- a serial unit that a customer's device uses is installed there
  update waytara.stock_units u
     set status = 'installed', customer_id = k.customer_id, site_id = k.site_id, installed_at = k.installed_at
    from _stock_device_links k where k.unit_id = u.id and k.tracking = 'serial' and k.customer_id is not null;

  insert into waytara.stock_movements (model_id, unit_id, kind, quantity, to_status, note, created_at)
  select u.model_id, u.id, 'received', u.quantity, 'in_stock', 'Carried over from the earlier stock list.', u.created_at from waytara.stock_units u;
  insert into waytara.stock_movements (model_id, unit_id, kind, quantity, from_status, to_status, customer_id, site_id, note)
  select u.model_id, u.id, 'installed', 1, 'in_stock', 'installed', u.customer_id, u.site_id, 'Already installed when the stock list was carried over.'
    from waytara.stock_units u where u.status = 'installed';

  -- the duplicates are gone once nothing points at them; purchase details leave the customer-visible model row
  delete from waytara.equipment_inventory i using _stock_rows r where i.id = r.old_id and r.old_id <> r.keep_id;
  update waytara.equipment_inventory
     set serial_number = null, supplier = null, po_reference = null, purchase_date = null, purchase_price_amount = null,
         po_document_path = null, po_document_name = null, po_document_type = null, po_document_size = null, po_document_uploaded_at = null;

  perform waytara.sync_model_stock(id) from waytara.equipment_inventory;
end $$;

-- a category for the ESP32 hub
insert into waytara.stock_categories (name) values ('Gateways & Hubs') on conflict do nothing;

-- 5. who can see and change it -------------------------------------------------------------------------------------------------------------------

alter table waytara.stock_receipts enable row level security;
alter table waytara.stock_units enable row level security;
alter table waytara.stock_movements enable row level security;
revoke all on waytara.stock_receipts, waytara.stock_units, waytara.stock_movements from public, anon, authenticated;
grant select on waytara.stock_units to authenticated;
grant select, insert, update, delete on waytara.stock_receipts to authenticated;
grant insert, update, delete on waytara.stock_units to authenticated;
grant select on waytara.stock_movements to authenticated;

drop policy if exists stock_units_staff_select on waytara.stock_units;
drop policy if exists stock_units_admin_write on waytara.stock_units;
create policy stock_units_staff_select on waytara.stock_units for select to authenticated using ((select waytara.is_staff()));
create policy stock_units_admin_write on waytara.stock_units for all to authenticated using ((select waytara.is_admin())) with check ((select waytara.is_admin()));

drop policy if exists stock_receipts_admin on waytara.stock_receipts;
create policy stock_receipts_admin on waytara.stock_receipts for all to authenticated using ((select waytara.is_admin())) with check ((select waytara.is_admin()));

drop policy if exists stock_movements_admin_select on waytara.stock_movements;
create policy stock_movements_admin_select on waytara.stock_movements for select to authenticated using ((select waytara.is_admin()));

-- 6. the steps ----------------------------------------------------------------------------------------------------------------------------------

-- A delivery arrives. A serial model takes a list of serial numbers (one unit each); a lot model takes a quantity and a lot id.
create or replace function waytara.receive_stock(
  p_model uuid, p_serials text[], p_quantity integer, p_supplier text, p_po_reference text, p_received_on date,
  p_unit_cost numeric, p_location text, p_notes text, p_po jsonb default null)
returns uuid
language plpgsql security definer set search_path = waytara, pg_temp as $$
declare
  v_tracking text;
  v_serials text[];
  v_dupes text[];
  v_receipt uuid := gen_random_uuid();
  v_count integer;
  v_lot text;
  v_unit uuid;
begin
  if not waytara.is_admin() then raise exception 'only an admin can receive stock' using errcode = '42501'; end if;
  select tracking into v_tracking from waytara.equipment_inventory where id = p_model for update;
  if not found then raise exception 'model not found' using errcode = '22023'; end if;

  if v_tracking = 'serial' then
    select coalesce(array_agg(distinct btrim(s)), '{}') into v_serials from unnest(coalesce(p_serials, '{}')) s where btrim(s) <> '';
    v_count := coalesce(array_length(v_serials, 1), 0);
    if v_count = 0 then raise exception 'enter at least one serial number' using errcode = '22023'; end if;
    -- two spellings of one serial in the same list
    if (select count(*) from (select distinct lower(s) from unnest(v_serials) s) d) <> v_count then
      raise exception 'the list has the same serial number more than once' using errcode = '22023';
    end if;
    select array_agg(u.serial_number) into v_dupes from waytara.stock_units u where lower(btrim(u.serial_number)) in (select lower(s) from unnest(v_serials) s);
    if v_dupes is not null then
      raise exception 'already in stock: %', array_to_string(v_dupes, ', ') using errcode = '23505';
    end if;
  else
    v_count := coalesce(p_quantity, 0);
    if v_count < 1 then raise exception 'quantity must be at least 1' using errcode = '22023'; end if;
    v_lot := nullif(btrim(coalesce(p_serials[1], '')), '');
    if v_lot is null then v_lot := 'LOT-' || to_char(coalesce(p_received_on, current_date), 'YYMMDD') || '-' || upper(substr(replace(v_receipt::text, '-', ''), 1, 4)); end if;
    if exists (select 1 from waytara.stock_units where lower(btrim(serial_number)) = lower(v_lot)) then
      raise exception 'the lot id % is already used', v_lot using errcode = '23505';
    end if;
  end if;

  insert into waytara.stock_receipts (id, model_id, received_on, supplier, po_reference, unit_cost, quantity, notes, received_by,
                                      po_document_path, po_document_name, po_document_type, po_document_size, po_document_uploaded_at)
  values (v_receipt, p_model, coalesce(p_received_on, current_date), nullif(btrim(p_supplier), ''), nullif(btrim(p_po_reference), ''), p_unit_cost, v_count,
          nullif(btrim(p_notes), ''), auth.uid(),
          p_po ->> 'path', p_po ->> 'name', p_po ->> 'type', (p_po ->> 'size')::integer, case when p_po is null then null else now() end);

  if v_tracking = 'serial' then
    for v_lot in select unnest(v_serials) loop
      insert into waytara.stock_units (model_id, serial_number, quantity, remaining, receipt_id, location)
      values (p_model, v_lot, 1, 1, v_receipt, nullif(btrim(p_location), '')) returning id into v_unit;
      insert into waytara.stock_movements (model_id, unit_id, kind, quantity, to_status, actor, note)
      values (p_model, v_unit, 'received', 1, 'in_stock', auth.uid(), nullif(btrim(p_po_reference), ''));
    end loop;
  else
    insert into waytara.stock_units (model_id, serial_number, quantity, remaining, receipt_id, location)
    values (p_model, v_lot, v_count, v_count, v_receipt, nullif(btrim(p_location), '')) returning id into v_unit;
    insert into waytara.stock_movements (model_id, unit_id, kind, quantity, to_status, actor, note)
    values (p_model, v_unit, 'received', v_count, 'in_stock', auth.uid(), nullif(btrim(p_po_reference), ''));
  end if;
  return v_receipt;
end $$;

-- Hold a unit for a customer (and optionally one of their sites) so it is not given to anyone else.
create or replace function waytara.reserve_unit(p_unit uuid, p_customer uuid, p_site uuid default null) returns void
language plpgsql security definer set search_path = waytara, pg_temp as $$
declare u record;
begin
  if not waytara.is_staff() then raise exception 'only staff can reserve stock' using errcode = '42501'; end if;
  select * into u from waytara.stock_units where id = p_unit for update;
  if not found then raise exception 'unit not found' using errcode = '22023'; end if;
  if u.quantity <> 1 then raise exception 'a lot is drawn down when it is installed, not reserved' using errcode = '22023'; end if;
  if u.status <> 'in_stock' then raise exception 'this unit is % and cannot be reserved', replace(u.status, '_', ' ') using errcode = '22023'; end if;
  if not exists (select 1 from waytara.profiles where id = p_customer) then raise exception 'customer not found' using errcode = '22023'; end if;
  if p_site is not null and not exists (select 1 from waytara.sites where id = p_site and customer_id = p_customer) then
    raise exception 'that site does not belong to this customer' using errcode = '22023';
  end if;
  update waytara.stock_units set status = 'reserved', customer_id = p_customer, site_id = p_site, reserved_at = now() where id = p_unit;
  insert into waytara.stock_movements (model_id, unit_id, kind, to_status, from_status, customer_id, site_id, actor)
  values (u.model_id, p_unit, 'reserved', 'reserved', 'in_stock', p_customer, p_site, auth.uid());
end $$;

create or replace function waytara.release_unit(p_unit uuid) returns void
language plpgsql security definer set search_path = waytara, pg_temp as $$
declare u record;
begin
  if not waytara.is_staff() then raise exception 'only staff can release stock' using errcode = '42501'; end if;
  select * into u from waytara.stock_units where id = p_unit for update;
  if not found then raise exception 'unit not found' using errcode = '22023'; end if;
  if u.status <> 'reserved' then raise exception 'this unit is not reserved' using errcode = '22023'; end if;
  update waytara.stock_units set status = 'in_stock', customer_id = null, site_id = null, reserved_at = null where id = p_unit;
  insert into waytara.stock_movements (model_id, unit_id, kind, from_status, to_status, customer_id, actor)
  values (u.model_id, p_unit, 'released', 'reserved', 'in_stock', u.customer_id, auth.uid());
end $$;

-- Move a unit between the states that are not "at a customer": in stock, repair, damaged, returned, retired.
create or replace function waytara.set_unit_status(p_unit uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = waytara, pg_temp as $$
declare u record;
begin
  if not waytara.is_admin() then raise exception 'only an admin can change a unit''s status' using errcode = '42501'; end if;
  if p_status not in ('in_stock', 'repair', 'damaged', 'returned', 'retired') then raise exception 'choose a status: in stock, repair, damaged, returned or retired' using errcode = '22023'; end if;
  select * into u from waytara.stock_units where id = p_unit for update;
  if not found then raise exception 'unit not found' using errcode = '22023'; end if;
  if u.status in ('reserved', 'installed') then raise exception 'this unit is % for a customer; release or remove it from the site first', u.status using errcode = '22023'; end if;
  if u.status = 'used_up' then raise exception 'this lot is used up' using errcode = '22023'; end if;
  if u.status = p_status then return; end if;
  update waytara.stock_units set status = p_status where id = p_unit;
  insert into waytara.stock_movements (model_id, unit_id, kind, quantity, from_status, to_status, note, actor)
  values (u.model_id, p_unit, 'status', u.remaining, u.status, p_status, nullif(btrim(p_note), ''), auth.uid());
end $$;

-- A device being set up at a customer's site takes this unit: it is installed there and the device is linked to its serial number.
create or replace function waytara.install_unit(p_unit uuid, p_equipment uuid) returns void
language plpgsql security definer set search_path = waytara, pg_temp as $$
declare u record; e record; v_customer uuid;
begin
  if not waytara.is_staff() then raise exception 'only staff can install stock' using errcode = '42501'; end if;
  select * into u from waytara.stock_units where id = p_unit for update;
  if not found then raise exception 'unit not found' using errcode = '22023'; end if;
  select eq.id, eq.site_id, eq.stock_id, s.customer_id into e from waytara.equipment eq join waytara.sites s on s.id = eq.site_id where eq.id = p_equipment;
  if not found then raise exception 'device not found' using errcode = '22023'; end if;
  if u.model_id <> e.stock_id then raise exception 'that serial number is for a different model' using errcode = '22023'; end if;
  if u.quantity <> 1 then raise exception 'pick a serial-numbered unit' using errcode = '22023'; end if;
  v_customer := e.customer_id;
  if u.status = 'reserved' and u.customer_id is distinct from v_customer then
    raise exception 'this unit is reserved for another customer' using errcode = '22023';
  end if;
  if u.status not in ('in_stock', 'reserved') then raise exception 'this unit is % and cannot be installed', replace(u.status, '_', ' ') using errcode = '22023'; end if;
  update waytara.stock_units
     set status = 'installed', customer_id = v_customer, site_id = e.site_id, installed_at = now()
   where id = p_unit;
  update waytara.equipment set stock_unit_id = p_unit where id = p_equipment;
  insert into waytara.stock_movements (model_id, unit_id, kind, from_status, to_status, customer_id, site_id, actor)
  values (u.model_id, p_unit, 'installed', u.status, 'installed', v_customer, e.site_id, auth.uid());
end $$;

-- Allocate equipment under a monitored device (panels, a battery, meters...). A serial model takes the chosen unit; a lot model is drawn
-- from the oldest lots first. Replaces the earlier version, which only reduced a number.
drop function if exists waytara.assign_child_equipment(uuid, uuid, integer, text);
create or replace function waytara.assign_child_equipment(p_parent uuid, p_stock uuid, p_quantity integer default 1, p_label text default null, p_unit uuid default null)
returns uuid
language plpgsql security definer set search_path = waytara, pg_temp as $$
declare
  v_site uuid;
  v_customer uuid;
  v_category text;
  v_tracking text;
  v_need integer := p_quantity;
  v_id uuid;
  v_first uuid;
  u record;
  v_take integer;
begin
  if not waytara.is_staff() then raise exception 'only staff can allocate equipment' using errcode = '42501'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'quantity must be at least 1' using errcode = '22023'; end if;
  select e.site_id, s.customer_id into v_site, v_customer from waytara.equipment e join waytara.sites s on s.id = e.site_id where e.id = p_parent;
  if not found then raise exception 'parent device not found' using errcode = '22023'; end if;
  select category, tracking into v_category, v_tracking from waytara.equipment_inventory where id = p_stock for update;
  if not found then raise exception 'stock item not found' using errcode = '22023'; end if;
  if waytara.is_monitored_category(v_category) then
    raise exception 'inverters and chargers are added as devices, not as child equipment' using errcode = '22023';
  end if;

  if v_tracking = 'serial' then
    if p_unit is null then raise exception 'pick the serial number' using errcode = '22023'; end if;
    if p_quantity <> 1 then raise exception 'a serial-numbered item is added one at a time' using errcode = '22023'; end if;
    select * into u from waytara.stock_units where id = p_unit and model_id = p_stock for update;
    if not found then raise exception 'that serial number is not in stock for this item' using errcode = '22023'; end if;
    if u.status = 'reserved' and u.customer_id is distinct from v_customer then raise exception 'this unit is reserved for another customer' using errcode = '22023'; end if;
    if u.status not in ('in_stock', 'reserved') then raise exception 'this unit is % and cannot be installed', replace(u.status, '_', ' ') using errcode = '22023'; end if;
    insert into waytara.equipment (site_id, stock_id, stock_unit_id, label, device_status, parent_id, quantity)
    values (v_site, p_stock, p_unit, nullif(trim(p_label), ''), 'active', p_parent, 1) returning id into v_id;
    update waytara.stock_units set status = 'installed', customer_id = v_customer, site_id = v_site, installed_at = now() where id = p_unit;
    insert into waytara.stock_movements (model_id, unit_id, kind, from_status, to_status, customer_id, site_id, actor)
    values (p_stock, p_unit, 'installed', u.status, 'installed', v_customer, v_site, auth.uid());
    return v_id;
  end if;

  if (select coalesce(sum(remaining), 0) from waytara.stock_units where model_id = p_stock and status = 'in_stock') < p_quantity then
    raise exception 'only % in stock', (select coalesce(sum(remaining), 0) from waytara.stock_units where model_id = p_stock and status = 'in_stock') using errcode = '22023';
  end if;
  for u in select * from waytara.stock_units where model_id = p_stock and status = 'in_stock' and remaining > 0 order by created_at, id for update loop
    exit when v_need <= 0;
    v_take := least(u.remaining, v_need);
    insert into waytara.equipment (site_id, stock_id, stock_unit_id, label, device_status, parent_id, quantity)
    values (v_site, p_stock, u.id, nullif(trim(p_label), ''), 'active', p_parent, v_take) returning id into v_id;
    v_first := coalesce(v_first, v_id);
    update waytara.stock_units
       set remaining = remaining - v_take, status = case when remaining - v_take = 0 then 'used_up' else status end
     where id = u.id;
    insert into waytara.stock_movements (model_id, unit_id, kind, quantity, from_status, to_status, customer_id, site_id, actor)
    values (p_stock, u.id, 'installed', v_take, 'in_stock', case when u.remaining - v_take = 0 then 'used_up' else 'in_stock' end, v_customer, v_site, auth.uid());
    v_need := v_need - v_take;
  end loop;
  return v_first;
end $$;

revoke all on function waytara.receive_stock(uuid, text[], integer, text, text, date, numeric, text, text, jsonb) from public, anon;
revoke all on function waytara.reserve_unit(uuid, uuid, uuid) from public, anon;
revoke all on function waytara.release_unit(uuid) from public, anon;
revoke all on function waytara.set_unit_status(uuid, text, text) from public, anon;
revoke all on function waytara.install_unit(uuid, uuid) from public, anon;
revoke all on function waytara.assign_child_equipment(uuid, uuid, integer, text, uuid) from public, anon;
revoke all on function waytara.sync_model_stock(uuid) from public, anon, authenticated;
grant execute on function waytara.receive_stock(uuid, text[], integer, text, text, date, numeric, text, text, jsonb) to authenticated;
grant execute on function waytara.reserve_unit(uuid, uuid, uuid) to authenticated;
grant execute on function waytara.release_unit(uuid) to authenticated;
grant execute on function waytara.set_unit_status(uuid, text, text) to authenticated;
grant execute on function waytara.install_unit(uuid, uuid) to authenticated;
grant execute on function waytara.assign_child_equipment(uuid, uuid, integer, text, uuid) to authenticated, service_role;
