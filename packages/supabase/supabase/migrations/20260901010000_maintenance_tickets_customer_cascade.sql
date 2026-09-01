-- Follow-up to 20260901000000: maintenance_tickets.customer_id references
-- waytara.customers(id) directly, not profiles(id) — a separate FK path
-- from the one already fixed (maintenance_tickets.site_id already
-- cascades via sites -> customers). Missed this one because it doesn't
-- show up in a query scoped to "FKs referencing profiles" — it's scoped
-- to customers instead.
--
-- Confirmed live: even though a maintenance_tickets row would ALSO be
-- removed via the site_id cascade path, Postgres still independently
-- enforces every direct FK constraint on the row being deleted. This one
-- being NO ACTION blocked the customer delete outright
-- (AuthRetryableFetchError / "Database error deleting user") regardless
-- of the other path. Every direct FK needs its own correct action —
-- cascading through one path doesn't satisfy another.

alter table waytara.maintenance_tickets
  drop constraint maintenance_tickets_customer_id_fkey,
  add constraint maintenance_tickets_customer_id_fkey
    foreign key (customer_id) references waytara.customers(id) on delete cascade;
