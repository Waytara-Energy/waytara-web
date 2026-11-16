-- WayTara Partner Network: the tracking link. Every application gets a private link (e-mailed to the applicant) that opens a status page. The link is a long random
-- code of which only the HASH is stored here, so it cannot be read back, guessed or forged, and it can be replaced (the old one then stops working) or left to expire.
-- The team can also leave a short note that the applicant sees on that page.
--
-- Additive. Nothing is dropped, rewritten or backfilled: applications made before this have no link (an admin can send one), and no note.

alter table waytara.partner_applications
  add column if not exists access_token_hash text,
  add column if not exists access_expires_at timestamptz,
  add column if not exists status_message text,
  add column if not exists status_message_at timestamptz;

-- One link, one application. A partial index, so applications without a link do not collide on null.
create unique index if not exists partner_applications_access_token_key on waytara.partner_applications (access_token_hash) where access_token_hash is not null;

alter table waytara.partner_applications
  add constraint partner_applications_status_message_length check (status_message is null or char_length(status_message) <= 600);

comment on column waytara.partner_applications.access_token_hash is 'SHA-256 (hex) of the tracking link code e-mailed to the applicant. The code itself is never stored.';
comment on column waytara.partner_applications.access_expires_at is 'When the tracking link stops working. Null means no link.';
comment on column waytara.partner_applications.status_message is 'A short note from the team, shown to the applicant on the tracking page.';
comment on column waytara.partner_applications.status_message_at is 'When the note was last saved.';

-- The public (anon) insert may not write the note: it is the team''s to write. The rest of the rule is unchanged.
drop policy if exists partner_applications_public_insert on waytara.partner_applications;
create policy partner_applications_public_insert on waytara.partner_applications
  for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null and reviewed_by is null and reviewed_at is null and status_message is null and status_message_at is null);
