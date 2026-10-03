-- equipment_metrics has no foreign key to equipment_templates, so every
-- `equipment_templates!inner(...)` embedded-resource select the app makes
-- (instrument-catalog-data.ts, device-catalog-data.ts, the device detail
-- page's updateInstrumentSetting action) fails at the PostgREST layer with
-- "could not find the relation between equipment_metrics and
-- equipment_templates" — PostgREST only knows how to embed across a real
-- FK, and the original schema migration never added one. Composite (not
-- just key_name) because equipment_templates' own uniqueness is
-- (device_category, key_name), not key_name alone — the same key_name can
-- exist once for solar and once for ev.

alter table waytara.equipment_metrics
  add constraint equipment_metrics_template_fkey
  foreign key (device_category, key_name)
  references waytara.equipment_templates (device_category, key_name);

create index equipment_metrics_template_idx on waytara.equipment_metrics (device_category, key_name);
