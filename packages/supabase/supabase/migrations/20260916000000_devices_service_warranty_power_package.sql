-- devices: rename its stock FK for clarity, drop the free-typed device_uid
-- in favor of the linked stock item's own serial/model number, replace the
-- freeform warranty_info jsonb with real date columns (auto-calculated at
-- install time from the stock item's warranty_info, but plain editable
-- columns afterward — not generated columns, since "still editable" rules
-- those out), and add installation/service tracking + updated_at.
alter table waytara.devices rename column device_type_id to stock_device_id;
alter table waytara.devices rename column status to device_status;
alter table waytara.devices drop column device_uid;
alter table waytara.devices drop column warranty_info;

alter table waytara.devices
  add column installation_id uuid references waytara.installations(id),
  add column warranty_start_date date,
  add column warranty_end_date date,
  add column updated_at timestamptz not null default now();

create or replace function waytara.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists devices_set_updated_at on waytara.devices;
create trigger devices_set_updated_at
  before update on waytara.devices
  for each row
  execute function waytara.set_updated_at();

-- Service tracking: a plan template (admin-defined, per device category —
-- "like other companies do" for solar inverters vs. EV chargers) that a
-- contract instantiates for one device. Individual visits are NOT a third
-- parallel table — they're rows in the existing maintenance_tickets table
-- (tagged via service_contract_id below), so "who requested it and when,
-- who performed it, when it's due, when it finished" all come for free
-- from columns that table already has (customer_id/created_at,
-- employee_id, scheduled_date, completed_at) instead of being duplicated.
create table waytara.service_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  device_category text not null,
  duration_months int not null,
  total_services_included int not null,
  free_services_count int not null default 0,
  price_amount numeric(12,2),
  per_extra_service_price_amount numeric(12,2),
  covered_items jsonb,
  paid_extras jsonb,
  created_at timestamptz not null default now()
);

alter table waytara.service_plans enable row level security;

create policy "service_plans_staff_select" on waytara.service_plans
  for select
  using (waytara.is_staff());

create policy "service_plans_admin_write" on waytara.service_plans
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());

create table waytara.service_contracts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references waytara.devices(id),
  service_plan_id uuid references waytara.service_plans(id),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

alter table waytara.service_contracts enable row level security;

create policy "service_contracts_staff_select" on waytara.service_contracts
  for select
  using (waytara.is_staff());

create policy "service_contracts_customer_select" on waytara.service_contracts
  for select
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      where d.id = service_contracts.device_id and s.customer_id = auth.uid()
    )
  );

create policy "service_contracts_admin_write" on waytara.service_contracts
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());

-- Added now that service_contracts exists — devices.service_id points at
-- a device's currently-active contract; renewing means inserting a new
-- service_contracts row and repointing this, so past contracts stay as
-- real history instead of being overwritten.
alter table waytara.devices
  add column service_id uuid references waytara.service_contracts(id);

-- A "service visit" is a maintenance_tickets row with type =
-- 'scheduled_service' and service_contract_id set — reusing all the
-- scheduling/assignment/status machinery that table already has rather
-- than duplicating it. is_chargeable/charge_amount stay null for every
-- ordinary (non-service) ticket.
alter table waytara.maintenance_tickets
  add column service_contract_id uuid references waytara.service_contracts(id),
  add column is_chargeable boolean,
  add column charge_amount numeric(12,2);

-- sites: power_package (what equipment exists — drives the energy-flow
-- diagram's Solar/Battery/EV wires) and lat/long (customer-settable via
-- browser geolocation from the Site Setting tab). power_source_category
-- (already on this table) separately drives the diagram's Grid wire.
create type waytara.power_package as enum (
  'solar_inverter',
  'solar_battery_inverter',
  'inverter_battery',
  'solar_inverter_ev',
  'solar_battery_inverter_ev',
  'inverter_battery_ev',
  'ev_charger_only'
);

alter table waytara.sites
  add column power_package waytara.power_package,
  add column latitude numeric(9,6),
  add column longitude numeric(9,6);

-- update_device_site (20260911000000) needs the 3 new site fields threaded
-- through both its "update in place" and "split into a new site" branches
-- — it's the only path customer edits to site details are allowed to take
-- (see that migration's own comment for why: protects sibling devices
-- sharing a site from having their details silently overwritten). Old
-- 5-arg signature is dropped explicitly rather than left as a stale
-- overload.
drop function if exists waytara.update_device_site(uuid, text, waytara.property_type, waytara.power_source_category, jsonb);

create or replace function waytara.update_device_site(
  p_device_id uuid,
  p_name text,
  p_property_type waytara.property_type,
  p_power_source_category waytara.power_source_category,
  p_address jsonb,
  p_power_package waytara.power_package default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'waytara', 'public', 'pg_temp'
as $function$
declare
  v_customer_id uuid;
  v_site_id uuid;
  v_sibling_count int;
  v_target_site_id uuid;
begin
  select s.customer_id, s.id
    into v_customer_id, v_site_id
  from waytara.devices d
  join waytara.sites s on s.id = d.site_id
  where d.id = p_device_id;

  if v_customer_id is null or v_customer_id != auth.uid() then
    raise exception 'Not authorized for this device.';
  end if;

  select count(*) into v_sibling_count
  from waytara.devices
  where site_id = v_site_id and id != p_device_id;

  if v_sibling_count = 0 then
    update waytara.sites
    set name = p_name,
        property_type = p_property_type,
        power_source_category = p_power_source_category,
        address = p_address,
        power_package = p_power_package,
        latitude = p_latitude,
        longitude = p_longitude
    where id = v_site_id;

    v_target_site_id := v_site_id;
  else
    insert into waytara.sites (customer_id, name, property_type, power_source_category, address, power_package, latitude, longitude)
    values (v_customer_id, p_name, p_property_type, p_power_source_category, p_address, p_power_package, p_latitude, p_longitude)
    returning id into v_target_site_id;

    update waytara.devices set site_id = v_target_site_id where id = p_device_id;
  end if;

  return v_target_site_id;
end;
$function$;

grant execute on function waytara.update_device_site(uuid, text, waytara.property_type, waytara.power_source_category, jsonb, waytara.power_package, numeric, numeric) to authenticated;
