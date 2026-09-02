-- Dashboard redesign Phase 5: Support module — a customer can open a
-- ticket and chat with the employee assigned to their account (or admin).
-- Mirrors maintenance_tickets' proven three-way RLS shape exactly (see
-- 20260831190000_customer_dashboard_policies.sql): customer sees/creates
-- their own, admin sees all, employee sees a ticket only if
-- customer_onboarding.employee_id = auth.uid() for that ticket's customer
-- — "the employee assigned to this customer", not a per-ticket assignment,
-- same as every other staff-visibility policy in this schema.
--
-- customer_id references customers(id) directly (not profiles(id)) with
-- `on delete cascade` from the start — maintenance_tickets got this wrong
-- initially and needed a follow-up fix (20260901010000) once a customer
-- delete/ghost was attempted live; no reason to repeat that mistake here.

create table if not exists waytara.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references waytara.customers(id) on delete cascade,
  subject text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table waytara.support_tickets
  add constraint support_tickets_status_check
    check (status in ('open', 'in_progress', 'resolved', 'closed'));

-- sender_id is SET NULL (not cascade) — a message shouldn't disappear just
-- because the employee who wrote it was later revoked/ghosted (see
-- employee-revoke-and-ghost, 20260901020000); the message body and
-- sender_role still tell the story without the profile link.
create table if not exists waytara.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references waytara.support_tickets(id) on delete cascade,
  sender_id uuid references waytara.profiles(id) on delete set null,
  sender_role text not null,
  body text not null,
  attachment_path text,
  created_at timestamptz not null default now()
);

alter table waytara.support_messages
  add constraint support_messages_sender_role_check
    check (sender_role in ('customer', 'employee', 'admin'));

alter table waytara.support_tickets enable row level security;
alter table waytara.support_messages enable row level security;

-- support_tickets: customer own (select/insert/update — update covers the
-- customer marking their own ticket resolved, same "row ownership only,
-- app layer trusted" shape as onboarding_customer_update_own), admin all,
-- employee assigned. Employee additionally gets an UPDATE policy (to
-- change ticket status) — a gap maintenance_tickets doesn't have to worry
-- about since nothing there lets an employee change ticket state.

drop policy if exists "support_tickets_customer_own_select" on waytara.support_tickets;
create policy "support_tickets_customer_own_select" on waytara.support_tickets
  for select
  using (customer_id = auth.uid());

drop policy if exists "support_tickets_customer_own_insert" on waytara.support_tickets;
create policy "support_tickets_customer_own_insert" on waytara.support_tickets
  for insert
  with check (customer_id = auth.uid());

drop policy if exists "support_tickets_customer_own_update" on waytara.support_tickets;
create policy "support_tickets_customer_own_update" on waytara.support_tickets
  for update
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

drop policy if exists "support_tickets_admin_all" on waytara.support_tickets;
create policy "support_tickets_admin_all" on waytara.support_tickets
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());

drop policy if exists "support_tickets_employee_assigned_select" on waytara.support_tickets;
create policy "support_tickets_employee_assigned_select" on waytara.support_tickets
  for select
  using (
    exists (
      select 1 from waytara.customer_onboarding co
      where co.customer_id = support_tickets.customer_id and co.employee_id = auth.uid()
    )
  );

drop policy if exists "support_tickets_employee_assigned_update" on waytara.support_tickets;
create policy "support_tickets_employee_assigned_update" on waytara.support_tickets
  for update
  using (
    exists (
      select 1 from waytara.customer_onboarding co
      where co.customer_id = support_tickets.customer_id and co.employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from waytara.customer_onboarding co
      where co.customer_id = support_tickets.customer_id and co.employee_id = auth.uid()
    )
  );

-- support_messages: no UPDATE/DELETE anywhere — an immutable chat log,
-- same as this app's other message-like data. Scoped through the parent
-- ticket's customer_id/assignment, and INSERT additionally requires
-- writing messages as yourself (sender_id = auth.uid()) so one party can't
-- post into the thread pretending to be another.

drop policy if exists "support_messages_customer_select" on waytara.support_messages;
create policy "support_messages_customer_select" on waytara.support_messages
  for select
  using (
    exists (
      select 1 from waytara.support_tickets st
      where st.id = support_messages.ticket_id and st.customer_id = auth.uid()
    )
  );

drop policy if exists "support_messages_customer_insert" on waytara.support_messages;
create policy "support_messages_customer_insert" on waytara.support_messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from waytara.support_tickets st
      where st.id = support_messages.ticket_id and st.customer_id = auth.uid()
    )
  );

drop policy if exists "support_messages_admin_all" on waytara.support_messages;
create policy "support_messages_admin_all" on waytara.support_messages
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());

drop policy if exists "support_messages_employee_assigned_select" on waytara.support_messages;
create policy "support_messages_employee_assigned_select" on waytara.support_messages
  for select
  using (
    exists (
      select 1 from waytara.support_tickets st
      join waytara.customer_onboarding co on co.customer_id = st.customer_id
      where st.id = support_messages.ticket_id and co.employee_id = auth.uid()
    )
  );

drop policy if exists "support_messages_employee_assigned_insert" on waytara.support_messages;
create policy "support_messages_employee_assigned_insert" on waytara.support_messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from waytara.support_tickets st
      join waytara.customer_onboarding co on co.customer_id = st.customer_id
      where st.id = support_messages.ticket_id and co.employee_id = auth.uid()
    )
  );

-- Storage: support-attachments is private (unlike quotation-pdfs' public
-- bucket) — a support conversation's attachments aren't meant to be
-- guessable/public by URL. Objects are addressed as `<ticket_id>/<file>`,
-- so ownership is checked by resolving the first path segment back to a
-- support_tickets row the caller can see, via storage.foldername(name).
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

drop policy if exists "support_attachments_customer_select" on storage.objects;
create policy "support_attachments_customer_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and exists (
      select 1 from waytara.support_tickets st
      where st.id::text = (storage.foldername(name))[1] and st.customer_id = auth.uid()
    )
  );

drop policy if exists "support_attachments_customer_insert" on storage.objects;
create policy "support_attachments_customer_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'support-attachments'
    and exists (
      select 1 from waytara.support_tickets st
      where st.id::text = (storage.foldername(name))[1] and st.customer_id = auth.uid()
    )
  );

drop policy if exists "support_attachments_employee_select" on storage.objects;
create policy "support_attachments_employee_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and exists (
      select 1 from waytara.support_tickets st
      join waytara.customer_onboarding co on co.customer_id = st.customer_id
      where st.id::text = (storage.foldername(name))[1] and co.employee_id = auth.uid()
    )
  );

drop policy if exists "support_attachments_employee_insert" on storage.objects;
create policy "support_attachments_employee_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'support-attachments'
    and exists (
      select 1 from waytara.support_tickets st
      join waytara.customer_onboarding co on co.customer_id = st.customer_id
      where st.id::text = (storage.foldername(name))[1] and co.employee_id = auth.uid()
    )
  );

drop policy if exists "support_attachments_admin_select" on storage.objects;
create policy "support_attachments_admin_select" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'support-attachments' and waytara.is_admin());

drop policy if exists "support_attachments_admin_insert" on storage.objects;
create policy "support_attachments_admin_insert" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'support-attachments' and waytara.is_admin());
