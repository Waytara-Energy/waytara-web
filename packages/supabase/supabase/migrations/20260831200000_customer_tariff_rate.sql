-- Task 10.3 (Analytics — cost savings/ROI) needs a ₹/kWh rate to convert
-- energy yield into money saved, and nothing in the schema carries one —
-- no tariff/rate column exists anywhere (grep confirmed). Adding it to
-- `customers` rather than `sites`: a single household-level rate is a
-- reasonable first pass (most residential customers are on one DISCOM
-- tariff regardless of how many sites they have), and it keeps the
-- Analytics query a single row lookup instead of a per-site join.
-- Default of 8.00 is a blended residential DISCOM average; customers can
-- correct it to their real slab rate via Billing & Plan going forward.
alter table waytara.customers
  add column if not exists tariff_rate_per_kwh numeric(10, 2) not null default 8.00;

-- Self-editable like address/billing_email — same column-restricted
-- REVOKE+GRANT pattern from 20260831190000, extended rather than
-- reopened wholesale (still can't touch plan_id/status/etc).
revoke update on waytara.customers from authenticated;
grant update (address, billing_email, tariff_rate_per_kwh) on waytara.customers to authenticated;
