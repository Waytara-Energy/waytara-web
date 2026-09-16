-- Task: constrain `stock.status` (free text since the device_types -> stock
-- rename) to a real inventory lifecycle instead of an arbitrary string —
-- every row currently in the table is already 'in_stock', so this is a
-- plain type change with no data to remap.
create type waytara.stock_status as enum ('in_stock', 'allocated', 'installed', 'damaged', 'returned');

alter table waytara.stock alter column status drop default;
alter table waytara.stock
  alter column status type waytara.stock_status
  using status::waytara.stock_status;
alter table waytara.stock alter column status set default 'in_stock';
