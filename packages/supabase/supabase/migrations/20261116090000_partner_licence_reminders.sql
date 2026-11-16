-- WayTara Partner Network: licence expiry reminders by e-mail. A daily job e-mails an approved partner when a licence is 60, 30 or 7 days from running out, and once when
-- it has. This table remembers which reminder was sent for which licence, so a partner is never sent the same one twice. A licence is told apart by its kind, number and
-- 'valid until' date, so after a renewal (a new date) the next cycle's reminders start afresh.
--
-- Written and read only by the website's server (its own key): no policy and no grant for the public or signed-in roles. Deleted with its application. Additive.

create table if not exists waytara.partner_licence_reminders (
  application_id uuid not null references waytara.partner_applications (id) on delete cascade,
  licence_key    text not null,
  threshold      smallint not null,
  sent_at        timestamptz not null default now(),
  primary key (application_id, licence_key, threshold),
  constraint partner_licence_reminders_threshold_valid check (threshold in (0, 7, 30, 60)),
  constraint partner_licence_reminders_key_length check (char_length(licence_key) <= 200)
);

alter table waytara.partner_licence_reminders enable row level security;
revoke all on waytara.partner_licence_reminders from anon, authenticated;
grant all on waytara.partner_licence_reminders to service_role;

comment on table waytara.partner_licence_reminders is 'Which licence expiry reminder (60, 30, 7 days, or 0 = expired) was e-mailed for which licence. Server-only: no policy for any login.';
