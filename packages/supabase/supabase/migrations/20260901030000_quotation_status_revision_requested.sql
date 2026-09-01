-- Onboarding pipeline redesign: the public quote-response page (customer
-- facing, apps/web) needs a "Re-quote" action distinct from a hard
-- rejection, so an employee building the next quotation can see "customer
-- wants changes" rather than having to infer that from a rejection message.
--
-- Adding an enum value must be its own migration/transaction — Postgres
-- won't let a freshly-added enum value be used (e.g. in a check constraint
-- or a row insert) within the same transaction that added it.
alter type waytara.quotation_status add value if not exists 'revision_requested';
