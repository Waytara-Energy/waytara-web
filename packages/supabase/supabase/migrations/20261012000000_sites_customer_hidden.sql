-- A site can be hidden from its customer's dashboard without deleting anything: the site, its devices and all their readings stay
-- (and stay visible to staff in the admin app); the customer's site list, device icons and pages simply leave it out. Clear the
-- column to show it again.
alter table waytara.sites add column if not exists customer_hidden_at timestamptz;

comment on column waytara.sites.customer_hidden_at is
  'When set, the customer dashboard leaves this site (and its devices) out. Nothing is deleted; clear it to show the site again.';
