-- The EV charger catalog's telemetry parameters were 3 placeholder keys
-- (charging_power_kw, connector_status, session_energy_kwh) invented before
-- any real protocol was chosen for this device class. WayTara's EV chargers
-- actually speak OCPP 1.6J, so the telemetry a charger genuinely reports is
-- whatever it streams in MeterValues.req's meterValue.sampledValue array —
-- this migration replaces the placeholder rows with parameters that map
-- 1:1 onto that measurand list, so device_parameters (and the
-- device_readings.instrument_key values it documents) actually reflect
-- what the charger sends.
--
-- Two additions beyond the MeterValues measurand table itself:
--   - connector_status, re-scoped to OCPP's own StatusNotification.status
--     enum (0=Available, 1=Preparing, 2=Charging, 3=SuspendedEVSE,
--     4=Faulted) instead of the old undocumented 1/2 values — kept because
--     without it there's no way to tell charging state at all, and it's
--     literally one of the message types in the same OCPP spec.
--   - error_code, mirroring StatusNotification.errorCode (0=NoError,
--     non-zero=a specific fault) — the same active_fault_code pattern
--     already used for the solar inverter, applied here for the same
--     reason (fault visibility matters more than protocol purity).
--
-- Deliberately NOT modeled as device_parameters/device_readings rows: the
-- BootNotification identity fields (chargePointVendor, firmwareVersion,
-- iccid, imsi, …), Authorize's idTag, and Start/StopTransaction's reason
-- codes — device_readings.value is numeric only, and none of those are
-- periodic sampled telemetry to begin with (they're one-shot protocol
-- metadata/events, not a value a meter re-reports on an interval).
delete from waytara.device_parameters
where device_type_id in (select id from waytara.stock where category = 'ev_charger');

insert into waytara.device_parameters (device_type_id, parameter_key, parameter_name, unit, category, is_required)
select s.id, v.parameter_key, v.parameter_name, v.unit, v.category, v.is_required
from waytara.stock s
cross join lateral (
  values
    -- OCPP MeterValues measurands (meterValue.sampledValue)
    ('energy_active_import_register_kwh', 'Energy Import (Total)', 'kWh', 'ev', true),
    ('power_active_import_w', 'Charging Power', 'W', 'ev', true),
    ('power_offered_w', 'Power Offered', 'W', 'ev', true),
    ('current_import_a', 'Charging Current', 'A', 'ev', true),
    ('voltage_v', 'Line Voltage', 'V', 'ev', true),
    -- DC fast charging / ISO 15118 only — not required for an AC unit
    -- like this one, but still a legal measurand for the catalog.
    ('soc_pct', 'EV State of Charge', '%', 'ev', false),
    ('temperature_c', 'Connector Temperature', '°C', 'ev', false),
    -- StatusNotification, not MeterValues — see migration comment above.
    ('connector_status', 'Connector Status', null, 'ev', true),
    ('error_code', 'Error Code', null, 'ev', false)
) as v(parameter_key, parameter_name, unit, category, is_required)
where s.category = 'ev_charger'
on conflict (device_type_id, parameter_key) do nothing;
