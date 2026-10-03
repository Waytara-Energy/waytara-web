-- equipment_templates was seeded without a `source` column (simplified
-- out of the original column list), but recovering real register
-- addresses for each label needs to know whether it's backed by a real
-- register at all — a label whose source is Calculated/Weather service/
-- Platform correctly gets no equipment_metrics row, only Source: Inverter
-- (solar) / charger-reported (EV) rows do. Small additive patch, not a
-- rename or drop.

alter table waytara.equipment_templates add column if not exists source text;
