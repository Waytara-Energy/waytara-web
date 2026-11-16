-- WayTara Partner Network (Tamil Nadu): the /partner page now takes four kinds of partner (an electrical contractor, a solar installation partner, an EV
-- charging partner, a field technician), each with a short set of questions of its own, and gives every applicant a reference.
--
-- Additive: three new columns and a wider list of statuses. Nothing is dropped, rewritten or backfilled; applications made before this have no type,
-- no reference and no answers. The public rules (insert-only for visitors, read and update for admins) are unchanged.

alter table waytara.partner_applications
  -- contractor | solar | ev | technician (null for an application made before the network page)
  add column if not exists partner_type text,
  -- what the applicant quotes on the phone, WTP-YYMM-XXXXX
  add column if not exists reference text,
  -- the questions of their kind and what they answered, as [{ "q": "...", "a": "..." }], in the order of the form (so the admins need no list of questions)
  add column if not exists answers jsonb not null default '[]'::jsonb;

alter table waytara.partner_applications
  add constraint partner_applications_type_valid check (partner_type is null or partner_type in ('contractor', 'solar', 'ev', 'technician')),
  add constraint partner_applications_reference_format check (reference is null or reference ~ '^WTP-[0-9]{4}-[A-Z0-9]{5}$'),
  add constraint partner_applications_answers_valid check (
    jsonb_typeof(answers) = 'array'
    and jsonb_array_length(answers) <= 20
    and octet_length(answers::text) <= 8000
  );

create unique index if not exists partner_applications_reference_key on waytara.partner_applications (reference) where reference is not null;
create index if not exists partner_applications_type_idx on waytara.partner_applications (partner_type) where partner_type is not null;

-- The stages an application goes through: new, a screening call (in review), shortlisted (an onboarding invitation is sent), detailed onboarding, verification,
-- then approved or rejected. 'new', 'in_review', 'approved' and 'rejected' keep their meaning.
alter table waytara.partner_applications drop constraint if exists partner_applications_status_valid;
alter table waytara.partner_applications
  add constraint partner_applications_status_valid check (status in ('new', 'in_review', 'shortlisted', 'onboarding', 'verification', 'approved', 'rejected'));

comment on column waytara.partner_applications.partner_type is 'contractor, solar, ev or technician; null for an application made before the Partner Network page.';
comment on column waytara.partner_applications.reference is 'The reference the applicant is given: WTP-YYMM-XXXXX.';
comment on column waytara.partner_applications.answers is 'The questions of the applicant''s kind and their answers, [{q, a}], in the order of the form.';
