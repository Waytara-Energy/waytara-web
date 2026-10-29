-- A serial number identifies one physical unit, so two stock items cannot share one (ignoring upper/lower case and surrounding spaces).
-- Items without a serial number (bulk stock like cable or connectors) are not affected.
create unique index if not exists equipment_inventory_serial_number_key
  on waytara.equipment_inventory (lower(btrim(serial_number)))
  where serial_number is not null and btrim(serial_number) <> '';
