-- Equipment schema redesign, part 1 of 2 (structural): renames every
-- device/instrument table to the equipment_* naming convention, and
-- creates the two new tables the redesign needs — equipment_templates
-- (one row per label, merging what instrument_catalog + the "device
-- templates" concept used to be) and equipment_metrics (the per-DEVICE
-- register/field map, replacing device_parameter_map's per-STOCK scope
-- and absorbing device_feature_flags' per-installation category toggle
-- via its own show_for_user column).
--
-- Deliberately NOT dropped here: instrument_catalog, device_parameter_map,
-- device_feature_flags, setting_presets. Those stay live until
-- equipment_templates is seeded from the two label workbooks and
-- equipment_metrics is populated for every existing device (separate data
-- migration scripts, not SQL) and the application code that reads them
-- (Phase 2) is updated — dropping them is a later, separate migration,
-- same "additive first, remove once verified" discipline as every prior
-- schema change this project has made.
--
-- Table/column renames are safe for views, RLS policies and foreign keys
-- (Postgres tracks those as parsed dependencies, not literal text) but
-- NOT for plpgsql function bodies, which resolve relation names by text
-- at each call. Checked every plpgsql function in the migration history
-- for references to a renamed table — only waytara.update_device_site
-- touches waytara.devices, so it's recreated at the bottom of this file
-- with the new name.

-- ============================================================
-- Renames
-- ============================================================

alter table waytara.stock rename to equipment_inventory;

alter table waytara.devices rename to equipment;
alter table waytara.equipment rename column stock_device_id to stock_id;

alter table waytara.device_readings rename to equipment_telemetry;
alter table waytara.equipment_telemetry rename column device_id to equipment_id;
alter table waytara.equipment_telemetry rename column instrument_key to key_name;

alter table waytara.device_settings rename to equipment_configs;
alter table waytara.equipment_configs rename column device_id to equipment_id;
alter table waytara.equipment_configs rename column setting_key to key_name;
alter table waytara.equipment_configs drop column if exists applied_preset_key;

alter table waytara.charging_sessions rename to ev_sessions;
alter table waytara.ev_sessions rename column device_id to equipment_id;

alter table waytara.instrument_enum_values rename to equipment_enum;

-- ============================================================
-- equipment_templates — global, one row per label, seeded from the two
-- label workbooks (not from the old instrument_catalog — the key-naming
-- convention changed, e.g. energy_management_mode -> energy_priority_mode,
-- tou_slot1_start_time -> time_of_use_slot1_start_time). category/
-- dashboard_section/group_name route each label to the right page and
-- card; the ten boolean columns are the two workbooks' own applicability
-- checkmarks, direct copies.
-- ============================================================

create table waytara.equipment_templates (
  id                uuid primary key default gen_random_uuid(),
  category          text not null,
  dashboard_section text not null,
  group_name        text,
  device_category   text not null check (device_category in ('solar', 'ev')),
  key_name          text not null,
  display_name      text not null,
  unit              text,
  direction         text not null check (direction in ('read', 'write', 'command')),
  value_kind        text,
  hybrid_1p_on_grid   boolean not null default false,
  hybrid_1p_off_grid  boolean not null default false,
  hybrid_3p_on_grid   boolean not null default false,
  hybrid_3p_off_grid  boolean not null default false,
  string_1p_on_grid   boolean not null default false,
  string_3p_on_grid   boolean not null default false,
  micro_1p_on_grid    boolean not null default false,
  ev_slow_ac          boolean not null default false,
  ev_fast_ac           boolean not null default false,
  ev_dc                boolean not null default false,
  notes             text,
  unique (device_category, key_name)
);

create index equipment_templates_device_category_idx on waytara.equipment_templates (device_category);
create index equipment_templates_dashboard_section_idx on waytara.equipment_templates (dashboard_section);

alter table waytara.equipment_templates enable row level security;

create policy "equipment_templates_read_all" on waytara.equipment_templates
  for select
  using (auth.uid() is not null);

create policy "equipment_templates_staff_write" on waytara.equipment_templates
  for all
  using (waytara.is_site_engineer_or_admin())
  with check (waytara.is_site_engineer_or_admin());

-- ============================================================
-- equipment_metrics — per-DEVICE (not per-model) register/field map. Each
-- physical installation gets its own independent copy of rows, seeded by
-- cloning an equipment_templates variant or an existing similar device's
-- rows at onboarding time, then freely edited afterward without affecting
-- anyone else's device. show_for_user is the entire replacement for
-- device_feature_flags: a category is simply absent from a device's
-- dashboard when every one of its rows has show_for_user = false.
-- category/device_category/direction are denormalized from the template
-- row at clone time so dashboard reads never need to join back to
-- equipment_templates just to know what page/card something belongs on.
-- ============================================================

create table waytara.equipment_metrics (
  id               uuid primary key default gen_random_uuid(),
  equipment_id     uuid not null references waytara.equipment(id) on delete cascade,
  key_name         text not null,
  category         text not null,
  device_category  text not null check (device_category in ('solar', 'ev')),
  direction        text not null check (direction in ('read', 'write', 'command')),
  address          jsonb,
  decode           jsonb,
  enum_ref         text,
  valid_min        numeric,
  valid_max        numeric,
  cadence_seconds  int,
  show_for_user    boolean not null default true,
  is_verified      boolean not null default false,
  notes            text,
  unique (equipment_id, key_name)
);

create index equipment_metrics_equipment_id_idx on waytara.equipment_metrics (equipment_id);
create index equipment_metrics_equipment_category_idx on waytara.equipment_metrics (equipment_id, category) where show_for_user;

alter table waytara.equipment_metrics enable row level security;

create policy "equipment_metrics_owner_read" on waytara.equipment_metrics
  for select
  using (
    exists (
      select 1 from waytara.equipment e
      join waytara.sites s on s.id = e.site_id
      where e.id = equipment_metrics.equipment_id and s.customer_id = auth.uid()
    )
  );

create policy "equipment_metrics_staff_all" on waytara.equipment_metrics
  for all
  using (waytara.is_site_engineer_or_admin())
  with check (waytara.is_site_engineer_or_admin());

-- ============================================================
-- update_device_site: recreated against the renamed equipment table.
-- Same signature, same behavior, only waytara.devices -> waytara.equipment
-- inside the body. See 20260916000000's version for the original
-- comment/reasoning this function follows.
-- ============================================================

drop function if exists waytara.update_device_site(uuid, text, waytara.property_type, waytara.power_source_category, jsonb, waytara.power_package, numeric, numeric);

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
  from waytara.equipment e
  join waytara.sites s on s.id = e.site_id
  where e.id = p_device_id;

  if v_customer_id is null or v_customer_id != auth.uid() then
    raise exception 'Not authorized for this device.';
  end if;

  select count(*) into v_sibling_count
  from waytara.equipment
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

    update waytara.equipment set site_id = v_target_site_id where id = p_device_id;
  end if;

  return v_target_site_id;
end;
$function$;

grant execute on function waytara.update_device_site(uuid, text, waytara.property_type, waytara.power_source_category, jsonb, waytara.power_package, numeric, numeric) to authenticated;
