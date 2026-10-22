-- Application Settings: a customer can keep a billing address apart from their own address, and give a GST number when bills need one.
-- (customers.address and customers.billing_email already exist and are already updatable by the customer.) The shape of an address is
-- { line1, line2, city, state, pincode } (see apps/web/src/lib/address.ts); the checks only cap the size and the GST number's format.

alter table waytara.customers
  add column if not exists billing_address jsonb,
  add column if not exists gstin text;

alter table waytara.customers drop constraint if exists customers_address_small;
alter table waytara.customers add constraint customers_address_small
  check ((address is null or pg_column_size(address) < 4096) and (billing_address is null or pg_column_size(billing_address) < 4096));

alter table waytara.customers drop constraint if exists customers_gstin_format;
alter table waytara.customers add constraint customers_gstin_format
  check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');

grant update (billing_address, gstin) on waytara.customers to authenticated;

-- To undo: alter table waytara.customers drop constraint customers_address_small, drop constraint customers_gstin_format,
--          drop column billing_address, drop column gstin;
