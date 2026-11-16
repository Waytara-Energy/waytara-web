-- WayTara Partner Network: readable application references. The new form is WTP-YYMMDD-EC0001: the date it was made, a two-letter code for the kind of partner
-- (EC electrical contractor, SI solar installation, EV EV charging, FI field technician, SA survey associate) and a number that counts up on its own for each kind.
-- References already issued (WTP-YYMM-XXXXX) stay valid and unchanged; nothing is renumbered.
--
-- The counter is one row per kind, bumped in a single statement, so two applications at the same moment can never get the same number. Only the website's server (its
-- own key) may ask for a number: the public roles have no right to run it.

create table if not exists waytara.partner_reference_counters (
  kind text primary key,
  last_number integer not null default 0,
  constraint partner_reference_counters_kind_valid check (kind in ('EC', 'SI', 'EV', 'FI', 'SA'))
);

alter table waytara.partner_reference_counters enable row level security;
revoke all on waytara.partner_reference_counters from anon, authenticated;
grant all on waytara.partner_reference_counters to service_role;

create or replace function waytara.next_partner_reference(p_kind text, p_on date default (now() at time zone 'Asia/Kolkata')::date)
returns text
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  n integer;
begin
  if p_kind not in ('EC', 'SI', 'EV', 'FI', 'SA') then
    raise exception 'unknown partner kind %', p_kind;
  end if;
  insert into waytara.partner_reference_counters (kind, last_number) values (p_kind, 1)
    on conflict (kind) do update set last_number = waytara.partner_reference_counters.last_number + 1
    returning last_number into n;
  return 'WTP-' || to_char(p_on, 'YYMMDD') || '-' || p_kind || lpad(n::text, 4, '0');
end;
$$;

revoke all on function waytara.next_partner_reference(text, date) from public, anon, authenticated;
grant execute on function waytara.next_partner_reference(text, date) to service_role;

-- The reference check now accepts both forms.
alter table waytara.partner_applications drop constraint if exists partner_applications_reference_format;
alter table waytara.partner_applications
  add constraint partner_applications_reference_format
  check (reference is null or reference ~ '^WTP-[0-9]{4}-[A-Z0-9]{5}$' or reference ~ '^WTP-[0-9]{6}-(EC|SI|EV|FI|SA)[0-9]{4,}$');
