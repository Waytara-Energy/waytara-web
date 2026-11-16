-- WayTara Partner Network: a fifth kind of partner (survey associate), and a record of when the applicant agreed to the Partner Terms and the Privacy Policy.
--
-- Additive. Nothing is dropped, rewritten or backfilled; the one check that lists the kinds is replaced by the same check with 'survey' added. Applications made
-- before this have no agreement time (the form did not ask for one).

alter table waytara.partner_applications drop constraint if exists partner_applications_type_valid;
alter table waytara.partner_applications
  add constraint partner_applications_type_valid check (partner_type is null or partner_type in ('contractor', 'solar', 'ev', 'technician', 'survey'));

alter table waytara.partner_applications add column if not exists terms_accepted_at timestamptz;

comment on column waytara.partner_applications.terms_accepted_at is 'When the applicant ticked the box agreeing to the Partner Terms and the Privacy Policy (set by the application form handler).';
