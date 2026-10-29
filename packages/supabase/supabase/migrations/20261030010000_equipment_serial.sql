-- A device shows its serial number. Since stock became one row per unit (migration 20261030000000), the serial number is no longer on the model; it is on the
-- stock unit the device is. Customers and the dashboards read equipment rows, so the serial number is kept on the equipment row itself, in step with the unit.
-- A lot (panels, cable) has an id, not a serial number, so only a one-piece unit sets it.

alter table waytara.equipment add column if not exists serial_number text;
comment on column waytara.equipment.serial_number is 'The serial number of the stock unit this device is (kept in step with stock_units); empty for lots.';

create or replace function waytara.equipment_set_serial() returns trigger
language plpgsql security definer set search_path = waytara, pg_temp as $$
begin
  new.serial_number := (select u.serial_number from waytara.stock_units u where u.id = new.stock_unit_id and u.quantity = 1);
  return new;
end $$;

drop trigger if exists equipment_serial on waytara.equipment;
create trigger equipment_serial before insert or update of stock_unit_id on waytara.equipment for each row execute function waytara.equipment_set_serial();

create or replace function waytara.stock_unit_serial_changed() returns trigger
language plpgsql security definer set search_path = waytara, pg_temp as $$
begin
  update waytara.equipment set serial_number = case when new.quantity = 1 then new.serial_number end where stock_unit_id = new.id;
  return null;
end $$;

drop trigger if exists stock_units_serial on waytara.stock_units;
create trigger stock_units_serial after update of serial_number on waytara.stock_units for each row execute function waytara.stock_unit_serial_changed();

update waytara.equipment e set serial_number = u.serial_number from waytara.stock_units u where e.stock_unit_id = u.id and u.quantity = 1;
