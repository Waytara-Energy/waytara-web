-- Phase 9 cleanup: the five tables the equipment_templates/equipment_metrics
-- schema (20260929000000_equipment_schema_rename.sql onward) fully
-- superseded. Confirmed zero remaining code references anywhere in
-- apps/web or apps/admin (grepped for real `.from("...")` queries, not
-- just doc comments) and no inbound FK left standing except
-- device_parameter_map -> instrument_catalog, which is dropped in the
-- same statement below.
drop table if exists waytara.device_parameter_map;
drop table if exists waytara.instrument_catalog;
drop table if exists waytara.device_feature_flags;
drop table if exists waytara.setting_presets;
drop table if exists waytara.instrument_enum_values;
