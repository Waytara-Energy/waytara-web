-- Turns the device catalog (device_types) into a real stock/inventory
-- table: brand/model/specs alongside serial number, quantity, unit of
-- measure, purchase price and supplier — one table an admin can use to
-- both define what a device model *is* and track how many of it exist,
-- rather than a bare 4-column catalog with no price or spec fields at
-- all. Renamed to `stock` since that's what it now represents; every
-- dependent table (device_type_instruments.device_type_id,
-- devices.device_type_id) keeps working unchanged — Postgres carries FK
-- constraints across a table rename automatically, so only the referenced
-- table's shape changes, not the relationship itself.
--
-- `code` is dropped — every place in the app that matched on it
-- (`d.deviceType?.code === "solar_inverter"`, `"ev_charger"`, etc.) now
-- matches on `category` instead, backfilled below with the exact same
-- values `code` used to hold, so this is a rename of the matching field,
-- not a loss of the capability. `description` is dropped as a dedicated
-- column too — its content is preserved by folding it into the new
-- `technical_specs` jsonb column (under a "description" key) rather than
-- discarded, since that column exists for exactly this kind of open-ended
-- product detail.
alter table waytara.device_types rename to stock;

alter table waytara.stock
  add column category text,
  add column brand text,
  add column model text,
  add column model_number text,
  add column serial_number text,
  add column status text not null default 'active',
  add column power_capacity_value numeric,
  add column power_capacity_unit text,
  add column size_value numeric,
  add column size_unit text,
  add column technical_specs jsonb,
  add column warranty_info jsonb,
  add column quantity integer not null default 0,
  add column pack_size integer,
  add column primary_uom text,
  add column purchase_price_amount numeric(12,2),
  add column unit_price numeric(12,2),
  add column purchase_date date,
  add column supplier text,
  add column po_reference text;

update waytara.stock set category = code, technical_specs = case when description is not null then jsonb_build_object('description', description) else null end;

alter table waytara.stock alter column category set not null;

alter table waytara.stock drop column code;
alter table waytara.stock drop column description;

-- Policy names follow the table's new identity — same admin-write /
-- staff-read / customer-read shape as before (policies stay attached
-- across the rename by OID, but keeping stale "device_types_*" names on a
-- table called `stock` would just confuse the next person reading pg
-- policies).
drop policy if exists "device_types_staff_select" on waytara.stock;
create policy "stock_staff_select" on waytara.stock
  for select
  using (waytara.is_staff());

drop policy if exists "device_types_customer_select" on waytara.stock;
create policy "stock_customer_select" on waytara.stock
  for select
  using (true);

drop policy if exists "device_types_admin_write" on waytara.stock;
create policy "stock_admin_write" on waytara.stock
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());
