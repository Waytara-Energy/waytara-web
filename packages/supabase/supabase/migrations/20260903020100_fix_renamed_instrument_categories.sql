-- The rename in the previous migration only touched instrument_key/
-- instrument_name/modbus_register, leaving each row's pre-existing
-- `category` value stale (e.g. inverter_power_w — renamed from
-- ac_output_power_w — kept category='solar' instead of the new 'inverter'
-- grouping used for its sibling new rows). Purely a grouping-metadata
-- cleanup, no functional/register impact.

UPDATE waytara.device_type_instruments dti
SET category = v.new_category
FROM (VALUES
  ('inverter_power_w', 'inverter'),
  ('inverter_dc_temp_c', 'inverter'),
  ('inverter_ac_temp_c', 'inverter'),
  ('grid_buy_energy_today_kwh', 'energy_today'),
  ('grid_sell_energy_today_kwh', 'energy_today'),
  ('load_energy_today_kwh', 'energy_today')
) AS v(instrument_key, new_category)
WHERE dti.instrument_key = v.instrument_key
  AND dti.device_type_id = 'ac398ad4-723c-487b-9d54-5912401de0d9';
