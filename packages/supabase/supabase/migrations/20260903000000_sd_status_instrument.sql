-- Maintenance gap-fill: the read-register manual's [92] "SD status" —
-- whether the inverter's onboard SD-card logging is working — was flagged
-- as missing from the telemetry catalog. Same pattern as Phase 7's
-- expansion: one more additive device_type_instruments row for
-- solar_inverter, no schema change. Values: 0=Healthy, 1=Fault, 2=Not
-- Present — decoded in telemetry-catalog.ts, not here.

insert into waytara.device_type_instruments (device_type_id, instrument_key, instrument_name, unit, category, is_required)
select id, instrument_key, instrument_name, unit, category, is_required
from waytara.device_types dt
cross join lateral (
  values
    ('sd_status', 'SD Card Logging Status', null, 'system', false)
) as instruments(instrument_key, instrument_name, unit, category, is_required)
where dt.code = 'solar_inverter'
on conflict (device_type_id, instrument_key) do nothing;
