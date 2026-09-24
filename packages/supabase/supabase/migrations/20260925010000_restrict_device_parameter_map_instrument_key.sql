-- device_parameter_map.instrument_key was originally FK'd to
-- instrument_catalog with `on delete cascade` — meaning deleting a shared
-- instrument definition silently deleted every model's own register
-- mapping for it too, with no error and no warning. Caught live: deleting
-- an unrelated test row through the admin's new Instrument Catalog editor
-- turned out to cascade-delete the real, in-use gen_power_w mapping for
-- the production Deye stock row (recovered by hand from the original seed
-- migration). `on delete restrict` (the actual intent — see
-- devices/catalog/actions.ts's deleteCatalogEntry comment) makes that
-- delete fail loudly instead, forcing an admin to remove the model's
-- mapping first if a key genuinely needs retiring.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'waytara.device_parameter_map'::regclass
      and confrelid = 'waytara.instrument_catalog'::regclass
      and contype = 'f'
  loop
    execute format('alter table waytara.device_parameter_map drop constraint %I', c.conname);
  end loop;
end $$;

alter table waytara.device_parameter_map
  add constraint device_parameter_map_instrument_key_fkey
  foreign key (instrument_key) references waytara.instrument_catalog(instrument_key) on delete restrict;
