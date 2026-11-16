-- WayTara Partner Network: the call-first onboarding flow. Three small loosenings of existing checks, nothing else (no new table, no new column, no data changed):
--
--  1. partner_item_checks.subject may also be 'screening': the checklist the admin ticks on the screening call (phone reached, e-mail confirmed, licence held and so
--     on) is kept in the same table as the other checks, one row an item, with who ticked it and when.
--  2. partner_item_checks.key is checked by shape instead of against a fixed list. The list of items is in the code (partner-verification.ts), which is the only
--     thing that writes here and checks every key before it does; a fixed list in the database had to be changed with every new item.
--  3. partner_documents.kind likewise: the kinds of document each kind of partner is asked for (GST certificate, PAN, contractor tie-up, vendor registration and so
--     on) are in the code (partner-onboarding.ts), and the server checks every kind before it records a file.
--
-- Who can read and write stays exactly as it was: admins only on both tables; applicants and partners go through the website's server.

alter table waytara.partner_item_checks drop constraint if exists partner_item_checks_subject_valid;
alter table waytara.partner_item_checks
  add constraint partner_item_checks_subject_valid check (subject in ('partner', 'screening') or subject ~ '^member:[A-Za-z0-9_-]{1,40}$');

alter table waytara.partner_item_checks drop constraint if exists partner_item_checks_key_valid;
alter table waytara.partner_item_checks
  add constraint partner_item_checks_key_valid check (key ~ '^[a-z][a-z0-9_]{1,39}$');

alter table waytara.partner_documents drop constraint if exists partner_documents_kind_valid;
alter table waytara.partner_documents
  add constraint partner_documents_kind_valid check (kind ~ '^[a-z][a-z0-9_]{1,39}$');

comment on table waytara.partner_item_checks is 'Verification of one item of a partner application: the partner (subject partner), the screening call (subject screening) or one team member (subject member:<id>).';
