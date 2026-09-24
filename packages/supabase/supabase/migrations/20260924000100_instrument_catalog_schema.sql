-- Multi-vendor instrument catalog: replaces the single-model, hardcoded
-- register knowledge (device_parameters.modbus_register + the four
-- hand-maintained TS files it sits alongside: modbus-register-map.ts,
-- instrument-settings-catalog.ts, telemetry-catalog.ts, deye-fault-codes.ts,
-- ev-charger-catalog.ts) with one protocol-agnostic logical catalog plus a
-- per-model physical mapping, so a second inverter vendor — or an entirely
-- new device category later (HVAC, water heater, security, lighting) — is a
-- data change, not a code change.
--
-- device_parameters itself is NOT dropped here. This migration is additive
-- only: the new tables get created and RLS'd, but the existing table and
-- its data stay put until the seed migration (populating instrument_catalog
-- + device_parameter_map from the register-map source docs) has been run
-- and verified against the live Deye device. Dropping device_parameters is
-- a deliberately separate, later migration.

-- ============================================================
-- Small reusable helper — every new table below gates writes the same way
-- ============================================================

create or replace function waytara.is_site_engineer_or_admin()
returns boolean
language sql
stable
security definer
set search_path = waytara, public
as $function$
  select exists (
    select 1 from waytara.profiles
    where id = auth.uid() and role in ('admin', 'site_engineer')
  );
$function$;

-- ============================================================
-- Logical parameter catalog — protocol-agnostic, shared across every
-- vendor/model. Global reference data (no customer/site scoping): what
-- register 184 means on a Deye model is not a secret, so read access is
-- any authenticated user; only staff can define/edit entries.
-- ============================================================

create table waytara.instrument_catalog (
  instrument_key   text primary key,
  name             text not null,
  category         text not null,
  device_category  text not null,
  unit             text,
  description      text,
  value_kind       text not null check (value_kind in ('numeric', 'enum', 'boolean', 'text', 'timestamp')),
  direction        text not null check (direction in ('read', 'write')),
  min_role         waytara.user_role not null default 'customer',
  regulated        boolean not null default false,
  cadence_seconds  int,
  enum_ref         text,
  valid_min        numeric,
  valid_max        numeric
);

create index instrument_catalog_device_category_direction_idx
  on waytara.instrument_catalog (device_category, direction);

alter table waytara.instrument_catalog enable row level security;

drop policy if exists "instrument_catalog_read_all" on waytara.instrument_catalog;
create policy "instrument_catalog_read_all" on waytara.instrument_catalog
  for select
  using (auth.uid() is not null);

drop policy if exists "instrument_catalog_staff_write" on waytara.instrument_catalog;
create policy "instrument_catalog_staff_write" on waytara.instrument_catalog
  for all
  using (waytara.is_site_engineer_or_admin())
  with check (waytara.is_site_engineer_or_admin());

-- ============================================================
-- Enum code -> label lookups. `code` is text (not int) so an OCPP string
-- enum and a Modbus integer enum both fit without two separate tables.
-- ============================================================

create table waytara.instrument_enum_values (
  enum_ref text not null,
  code     text not null,
  label    text not null,
  notes    text,
  primary key (enum_ref, code)
);

alter table waytara.instrument_enum_values enable row level security;

drop policy if exists "instrument_enum_values_read_all" on waytara.instrument_enum_values;
create policy "instrument_enum_values_read_all" on waytara.instrument_enum_values
  for select
  using (auth.uid() is not null);

drop policy if exists "instrument_enum_values_staff_write" on waytara.instrument_enum_values;
create policy "instrument_enum_values_staff_write" on waytara.instrument_enum_values
  for all
  using (waytara.is_site_engineer_or_admin())
  with check (waytara.is_site_engineer_or_admin());

-- ============================================================
-- Physical mapping — one row per (model, instrument_key). This is what
-- grows per new vendor/protocol; onboarding a new inverter brand is
-- entirely rows here, nothing else. Scoped to `stock` (the device MODEL),
-- not to any customer's specific device, so read access is any
-- authenticated user (needed by the dashboard to interpret readings for
-- any device type) — same reasoning as instrument_catalog above.
-- ============================================================

create table waytara.device_parameter_map (
  id             uuid primary key default gen_random_uuid(),
  stock_id       uuid not null references waytara.stock(id) on delete cascade,
  instrument_key text not null references waytara.instrument_catalog(instrument_key) on delete cascade,
  protocol       text not null,
  address        jsonb not null,
  decode         jsonb,
  is_required    boolean not null default false,
  is_enabled     boolean not null default true,
  verified       boolean not null default false,
  notes          text,
  unique (stock_id, instrument_key)
);

create index device_parameter_map_stock_id_idx on waytara.device_parameter_map (stock_id);

alter table waytara.device_parameter_map enable row level security;

drop policy if exists "device_parameter_map_read_all" on waytara.device_parameter_map;
create policy "device_parameter_map_read_all" on waytara.device_parameter_map
  for select
  using (auth.uid() is not null);

drop policy if exists "device_parameter_map_staff_write" on waytara.device_parameter_map;
create policy "device_parameter_map_staff_write" on waytara.device_parameter_map
  for all
  using (waytara.is_site_engineer_or_admin())
  with check (waytara.is_site_engineer_or_admin());

-- ============================================================
-- Named settings bundles (TOU presets today — "Efficient", "Advanced" —
-- any future named bundle later). Reference data, same read/write shape as
-- the catalog tables above.
-- ============================================================

create table waytara.setting_presets (
  id              uuid primary key default gen_random_uuid(),
  key             text unique not null,
  name            text not null,
  description     text not null,
  device_category text not null,
  values          jsonb not null,
  is_active       boolean not null default true
);

alter table waytara.setting_presets enable row level security;

drop policy if exists "setting_presets_read_all" on waytara.setting_presets;
create policy "setting_presets_read_all" on waytara.setting_presets
  for select
  using (auth.uid() is not null);

drop policy if exists "setting_presets_staff_write" on waytara.setting_presets;
create policy "setting_presets_staff_write" on waytara.setting_presets
  for all
  using (waytara.is_site_engineer_or_admin())
  with check (waytara.is_site_engineer_or_admin());

-- ============================================================
-- Per-INSTALLATION category toggle — does this specific physical device
-- actually have this category active (e.g. no generator connected at this
-- site), separate from whether the MODEL supports it
-- (device_parameter_map.is_enabled). Absence of a row = enabled, so the
-- common case (everything present) costs nothing.
--
-- Unlike the catalog tables above, this IS per-device data — scoped the
-- same way device_settings already is (devices -> sites -> customer_id).
-- Customers can read their own device's flags (the dashboard needs this to
-- decide what to render/fetch) but cannot write them — that's an
-- installer/admin action during site setup, not a customer self-service one.
-- ============================================================

create table waytara.device_feature_flags (
  device_id  uuid not null references waytara.devices(id) on delete cascade,
  category   text not null,
  is_enabled boolean not null default true,
  updated_by uuid references waytara.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (device_id, category)
);

alter table waytara.device_feature_flags enable row level security;

drop policy if exists "device_feature_flags_owner_read" on waytara.device_feature_flags;
create policy "device_feature_flags_owner_read" on waytara.device_feature_flags
  for select
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      where d.id = device_feature_flags.device_id and s.customer_id = auth.uid()
    )
  );

drop policy if exists "device_feature_flags_staff_read" on waytara.device_feature_flags;
create policy "device_feature_flags_staff_read" on waytara.device_feature_flags
  for select
  using (waytara.is_site_engineer_or_admin());

drop policy if exists "device_feature_flags_staff_write" on waytara.device_feature_flags;
create policy "device_feature_flags_staff_write" on waytara.device_feature_flags
  for all
  using (waytara.is_site_engineer_or_admin())
  with check (waytara.is_site_engineer_or_admin());

-- ============================================================
-- device_settings additions — full change-log columns. The table's shape
-- and append-only nature are unchanged; this just makes "what changed from
-- what, when, by whom" queryable without a self-join to find the prior row.
-- ============================================================

alter table waytara.device_settings add column if not exists previous_value text;
alter table waytara.device_settings add column if not exists applied_preset_key text references waytara.setting_presets(key);
