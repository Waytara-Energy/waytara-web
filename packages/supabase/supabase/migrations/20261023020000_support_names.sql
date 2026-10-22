-- Support v2, part 2: a ticket carries the customer's name and the site's name, so the team's lists can show them without reading the customer's
-- profile (an employee cannot read another person's profile, by design). Filled when the ticket is opened; older tickets are filled now.

alter table waytara.support_tickets
  add column if not exists customer_name text,
  add column if not exists site_name text;

create or replace function waytara._support_fill_names()
returns trigger
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  if new.customer_name is null then
    select coalesce(nullif(btrim(full_name), ''), split_part(email, '@', 1)) into new.customer_name from waytara.profiles where id = new.customer_id;
  end if;
  if new.site_name is null and new.site_id is not null then
    select name into new.site_name from waytara.sites where id = new.site_id;
  end if;
  return new;
end;
$$;

drop trigger if exists support_tickets_fill_names on waytara.support_tickets;
create trigger support_tickets_fill_names before insert on waytara.support_tickets
  for each row execute function waytara._support_fill_names();

revoke all on function waytara._support_fill_names() from public, anon, authenticated;

update waytara.support_tickets t
   set customer_name = (select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) from waytara.profiles p where p.id = t.customer_id)
 where t.customer_name is null;
update waytara.support_tickets t
   set site_name = (select s.name from waytara.sites s where s.id = t.site_id)
 where t.site_name is null and t.site_id is not null;

-- To undo: drop trigger support_tickets_fill_names on waytara.support_tickets; drop function waytara._support_fill_names();
--          alter table waytara.support_tickets drop column customer_name, drop column site_name;
