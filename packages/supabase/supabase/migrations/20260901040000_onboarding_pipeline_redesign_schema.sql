-- Onboarding pipeline redesign — schema foundation. See the approved plan
-- for the full pipeline; this migration only adds what every later phase
-- needs to exist first.

-- quotations: GST-aware, detailed pricing, and a public access token so a
-- customer can view/respond to their own quote without an account (the
-- same anon-token pattern already used for employee_invites/
-- customer_onboarding.invite_token). subtotal_amount/gst_rate/gst_amount
-- are new; total_amount already existed and becomes the grand total
-- (subtotal + gst) going forward rather than a bare hardware sum.
alter table waytara.quotations
  add column if not exists subtotal_amount numeric,
  add column if not exists gst_rate numeric not null default 18,
  add column if not exists gst_amount numeric,
  add column if not exists access_token uuid not null default gen_random_uuid(),
  add column if not exists customer_message text;

alter table waytara.quotations
  add constraint quotations_access_token_key unique (access_token);

-- leads: the employee's explicit "I'm working this" marker, distinct from
-- merely being assigned (admin action) — see Phase 2.
alter table waytara.leads
  add column if not exists accepted_at timestamptz;

-- customer_onboarding: installation time slot, paired with the existing
-- install_scheduled_at date. Plain text + check constraint rather than a
-- new enum type — a fixed short list, low-friction to add/change later
-- without an enum migration.
alter table waytara.customer_onboarding
  add column if not exists install_time_slot text;

alter table waytara.customer_onboarding
  add constraint customer_onboarding_install_time_slot_check
    check (install_time_slot is null or install_time_slot in ('morning', 'afternoon', 'evening'));

-- payments: how a balance payment was actually collected at installation
-- (Phase 9) — UPI (simulated for now) or cash, collected in person.
alter table waytara.payments
  add column if not exists method text;

alter table waytara.payments
  add constraint payments_method_check
    check (method is null or method in ('upi', 'cash', 'simulated'));

-- New table: per-device equipment readiness (Phase 7). "Data testing" is
-- deliberately NOT a column here — it's already proven by the existing
-- send-test-signal -> devices.status='active' flow (Task 8.5), so this
-- table only needs the three checks that flow doesn't cover.
create table if not exists waytara.equipment_checks (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique references waytara.devices(id) on delete cascade,
  availability boolean not null default false,
  quality boolean not null default false,
  power_connect boolean not null default false,
  checked_by uuid references waytara.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table waytara.equipment_checks enable row level security;

-- Same three-way shape as test_sessions' own policies (owner has no direct
-- need to read/write this — it's purely an employee/admin prep checklist).
drop policy if exists "equipment_checks_admin_all" on waytara.equipment_checks;
create policy "equipment_checks_admin_all" on waytara.equipment_checks
  for all
  using (waytara.is_admin())
  with check (waytara.is_admin());

drop policy if exists "equipment_checks_employee_assigned" on waytara.equipment_checks;
create policy "equipment_checks_employee_assigned" on waytara.equipment_checks
  for all
  using (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = equipment_checks.device_id and co.employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from waytara.devices d
      join waytara.sites s on s.id = d.site_id
      join waytara.customer_onboarding co on co.customer_id = s.customer_id
      where d.id = equipment_checks.device_id and co.employee_id = auth.uid()
    )
  );

-- payments: customer-scoped INSERT was missing entirely (only admin and
-- employee-own-quotation could ever insert one) — Phase 5's self-service
-- first-payment step needs the customer to be able to write their own.
drop policy if exists "payments_customer_insert_own" on waytara.payments;
create policy "payments_customer_insert_own" on waytara.payments
  for insert
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from waytara.customer_onboarding co
      where co.quotation_id = payments.quotation_id and co.customer_id = auth.uid()
    )
  );
