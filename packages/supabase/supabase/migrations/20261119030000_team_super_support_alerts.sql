-- A super user also works with the owner's SUPPORT TICKETS and ALERT RULES.
--
-- Support: every customer-facing support function and read rule decided "is this my ticket" with `ticket.customer_id = the caller`. They now also accept a caller who is a
-- super user of the ticket's customer (is_super_of_as), and nothing else about them changes: the functions below are the live ones with that one test widened. A super user
-- opens tickets for the owner who made them one (the ticket belongs to the site's owner, so the owner sees it too), can read and answer the owner's tickets, close, reopen
-- and rate them, and open their files (the file rules go through support_can_access). The e-mails about a ticket still go to the ticket's customer, the owner.
--
-- Alert rules: a super user may read and manage the owner's alert rules (for the owner's own sites only), by one additive rule next to the owner's.
--
-- Safe to apply on its own: nobody is a super user until the owner makes them one, and the existing rules for customers, staff and admins are untouched.

-- is the caller (or p_user) an active super user of this owner?
create or replace function waytara.is_super_of_as(p_user uuid, p_owner uuid)
returns boolean
language sql stable security definer set search_path = waytara, pg_temp
as $$
  select exists (
    select 1 from waytara.team_members m
    join waytara.profiles u on u.id = m.user_id and u.deactivated_at is null and u.deleted_at is null
    join waytara.profiles o on o.id = m.owner_id and o.deactivated_at is null and o.deleted_at is null
    where m.user_id = p_user and m.owner_id = p_owner and m.role = 'super' and m.status = 'active'
  )
$$;
-- only the database's own functions and the backend ask about someone else; a signed-in person asks about themselves through is_super_of
revoke all on function waytara.is_super_of_as(uuid, uuid) from public, anon, authenticated;
grant execute on function waytara.is_super_of_as(uuid, uuid) to service_role;

create or replace function waytara.is_super_of(p_owner uuid)
returns boolean
language sql stable security definer set search_path = waytara, pg_temp
as $$ select waytara.is_super_of_as((select auth.uid()), p_owner) $$;
revoke all on function waytara.is_super_of(uuid) from public, anon;
grant execute on function waytara.is_super_of(uuid) to authenticated, service_role;

-- the support functions (the live ones, with the ticket test widened)
CREATE OR REPLACE FUNCTION waytara.support_can_access_as(p_user uuid, p_ticket uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'waytara', 'pg_temp'
AS $function$
  select p_user is not null and (
    exists (select 1 from waytara.support_tickets t join waytara.profiles me on me.id = p_user
            where t.id = p_ticket and (t.customer_id = p_user or waytara.is_super_of_as(p_user, t.customer_id)) and me.deactivated_at is null and me.deleted_at is null)
    or waytara.support_staff_can_access_as(p_user, p_ticket)
  )
$function$;

CREATE OR REPLACE FUNCTION waytara.support_customer_close(p_ticket uuid, p_rating smallint DEFAULT NULL::smallint, p_comment text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'waytara', 'pg_temp'
AS $function$
declare
  v_me uuid := (select auth.uid());
  v_name text;
  t waytara.support_tickets;
  v_msg uuid;
  v_comment text := nullif(left(btrim(coalesce(p_comment, '')), 1000), '');
  v_payload jsonb;
begin
  select * into t from waytara.support_tickets where id = p_ticket for update;
  if not found or not (t.customer_id = v_me or waytara.is_super_of_as(v_me, t.customer_id)) then raise exception 'No such ticket' using errcode = 'P0002'; end if;
  if p_rating is not null and p_rating not between 1 and 5 then raise exception 'A rating is 1 to 5' using errcode = '22023'; end if;
  if t.status = 'closed' then return; end if;
  v_name := waytara._support_name(v_me);

  update waytara.support_tickets
     set status = 'closed', closed_at = now(), closed_by = 'customer', resolved_at = coalesce(resolved_at, now()), updated_at = now(),
         rating = coalesce(p_rating, rating), rating_comment = case when p_rating is not null then v_comment else rating_comment end,
         rated_at = case when p_rating is not null then now() else rated_at end
   where id = p_ticket;
  v_msg := waytara._support_event(p_ticket, 'closed', v_name || ' closed this ticket' || case when p_rating is not null then ' and rated it ' || p_rating || ' out of 5' else '' end);
  v_payload := jsonb_build_object('ticket_no', t.ticket_no, 'subject', t.subject, 'actor_name', v_name, 'rating', p_rating, 'comment', v_comment);
  perform waytara._support_enqueue_staff(p_ticket, 'closed_by_customer', v_payload, 'close:' || v_msg);
end;
$function$;

CREATE OR REPLACE FUNCTION waytara.support_customer_reopen(p_ticket uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'waytara', 'pg_temp'
AS $function$
declare
  v_me uuid := (select auth.uid());
  v_name text;
  t waytara.support_tickets;
  v_msg uuid;
begin
  select * into t from waytara.support_tickets where id = p_ticket for update;
  if not found or not (t.customer_id = v_me or waytara.is_super_of_as(v_me, t.customer_id)) then raise exception 'No such ticket' using errcode = 'P0002'; end if;
  if t.status <> 'resolved' then raise exception 'Only a resolved ticket can be reopened' using errcode = '22023'; end if;
  v_name := waytara._support_name(v_me);
  update waytara.support_tickets
     set status = case when assigned_to is null then 'open' else 'in_progress' end, resolved_at = null, updated_at = now(), unread_staff = unread_staff + 1
   where id = p_ticket;
  v_msg := waytara._support_event(p_ticket, 'reopened', v_name || ' reopened this ticket: the issue is not resolved yet');
  perform waytara._support_enqueue_staff(p_ticket, 'reopened_by_customer', jsonb_build_object('ticket_no', t.ticket_no, 'subject', t.subject, 'actor_name', v_name), 'reopen:' || v_msg);
end;
$function$;

CREATE OR REPLACE FUNCTION waytara.support_rate(p_ticket uuid, p_rating smallint, p_comment text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'waytara', 'pg_temp'
AS $function$
declare
  v_me uuid := (select auth.uid());
  t waytara.support_tickets;
  v_comment text := nullif(left(btrim(coalesce(p_comment, '')), 1000), '');
begin
  select * into t from waytara.support_tickets where id = p_ticket for update;
  if not found or not (t.customer_id = v_me or waytara.is_super_of_as(v_me, t.customer_id)) then raise exception 'No such ticket' using errcode = 'P0002'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'A rating is 1 to 5' using errcode = '22023'; end if;
  if t.status <> 'closed' then raise exception 'Close the ticket before rating it' using errcode = '22023'; end if;
  if t.rating is not null then raise exception 'This ticket is already rated' using errcode = '22023'; end if;
  update waytara.support_tickets set rating = p_rating, rating_comment = v_comment, rated_at = now(), updated_at = now() where id = p_ticket;
  if t.assigned_to is not null then
    perform waytara._support_enqueue(p_ticket, t.assigned_to, 'staff', 'rated',
      jsonb_build_object('ticket_no', t.ticket_no, 'subject', t.subject, 'actor_name', waytara._support_name(v_me), 'rating', p_rating, 'comment', v_comment), 'rate:' || p_ticket || ':' || t.assigned_to);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION waytara.support_mark_read(p_ticket uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'waytara', 'pg_temp'
AS $function$
declare
  v_me uuid := (select auth.uid());
  t waytara.support_tickets;
begin
  select * into t from waytara.support_tickets where id = p_ticket;
  if not found then return; end if;
  if (t.customer_id = v_me or waytara.is_super_of_as(v_me, t.customer_id)) then
    if t.unread_customer > 0 or t.customer_last_read_at is null or t.customer_last_read_at < coalesce(t.last_message_at, t.created_at) then
      update waytara.support_tickets set customer_last_read_at = now(), unread_customer = 0 where id = p_ticket;
    end if;
  elsif waytara.support_staff_can_access_as(v_me, p_ticket) then
    if t.unread_staff > 0 or t.staff_last_read_at is null or t.staff_last_read_at < coalesce(t.last_message_at, t.created_at) then
      update waytara.support_tickets set staff_last_read_at = now(), staff_last_read_name = waytara._support_name(v_me), unread_staff = 0 where id = p_ticket;
    end if;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION waytara.support_send_message(p_ticket uuid, p_body text, p_internal boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'waytara', 'pg_temp'
AS $function$
declare
  v_me uuid := (select auth.uid());
  v_role text;
  v_name text;
  v_body text := btrim(coalesce(p_body, ''));
  v_internal boolean := coalesce(p_internal, false);
  t waytara.support_tickets;
  v_msg uuid;
  v_is_customer boolean;
  v_payload jsonb;
begin
  select role::text, waytara._support_name(id) into v_role, v_name from waytara.profiles where id = v_me and deactivated_at is null and deleted_at is null;
  if v_role is null then raise exception 'Please sign in again' using errcode = '42501'; end if;
  select * into t from waytara.support_tickets where id = p_ticket for update;
  if not found then raise exception 'No such ticket' using errcode = 'P0002'; end if;
  if v_body = '' or char_length(v_body) > 5000 then raise exception 'Write a message of up to 5000 characters' using errcode = '22023'; end if;

  v_is_customer := (t.customer_id = v_me or waytara.is_super_of_as(v_me, t.customer_id));
  if v_is_customer then
    v_internal := false;
    if t.status = 'closed' then raise exception 'This ticket is closed. Open a new one if you still need help.' using errcode = '22023'; end if;
  elsif not waytara.support_staff_can_access_as(v_me, p_ticket) then
    raise exception 'You cannot write in this ticket' using errcode = '42501';
  end if;

  insert into waytara.support_messages (ticket_id, sender_id, sender_role, sender_name, body, internal)
  values (p_ticket, v_me, case when v_is_customer then 'customer' else v_role end, v_name, v_body, v_internal)
  returning id into v_msg;

  v_payload := jsonb_build_object('ticket_no', t.ticket_no, 'subject', t.subject, 'actor_name', v_name, 'actor_role', case when v_is_customer then 'customer' else v_role end, 'preview', waytara._support_preview(v_body), 'message_id', v_msg);

  if v_is_customer then
    update waytara.support_tickets
       set updated_at = now(), last_message_at = now(), last_message_role = 'customer', last_message_preview = waytara._support_preview(v_body),
           unread_staff = unread_staff + 1, customer_last_read_at = now(), unread_customer = 0,
           status = case when status = 'resolved' then (case when assigned_to is null then 'open' else 'in_progress' end) else status end,
           resolved_at = case when status = 'resolved' then null else resolved_at end
     where id = p_ticket;
    if t.status = 'resolved' then
      perform waytara._support_event(p_ticket, 'reopened', v_name || ' replied, so the ticket is open again');
    end if;
    perform waytara._support_enqueue_staff(p_ticket, 'customer_reply', v_payload, 'msg:' || v_msg, interval '45 seconds');
  elsif v_internal then
    update waytara.support_tickets set updated_at = now(), staff_last_read_at = now(), staff_last_read_name = v_name where id = p_ticket;
  else
    if t.status = 'closed' then
      update waytara.support_tickets set status = 'in_progress', closed_at = null, closed_by = null, resolved_at = null where id = p_ticket;
    end if;
    -- answering a ticket nobody had takes it (the customer's e-mail of the reply already names who is answering)
    if t.assigned_to is null then
      perform waytara._support_assign(p_ticket, v_me, v_me, false);
    end if;
    update waytara.support_tickets
       set updated_at = now(), last_message_at = now(), last_message_role = v_role, last_message_preview = waytara._support_preview(v_body),
           unread_customer = unread_customer + 1, unread_staff = 0, staff_last_read_at = now(), staff_last_read_name = v_name,
           status = case when status in ('open', 'resolved') then 'in_progress' else status end,
           resolved_at = case when status = 'resolved' then null else resolved_at end
     where id = p_ticket;
    perform waytara._support_enqueue(p_ticket, t.customer_id, 'customer', 'staff_reply', v_payload || jsonb_build_object('assignee_name', v_name), 'msg:' || v_msg || ':' || t.customer_id, interval '45 seconds');
  end if;
  return v_msg;
end;
$function$;

CREATE OR REPLACE FUNCTION waytara.support_create_ticket(p_site uuid, p_equipment uuid, p_category text, p_subject text, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'waytara', 'pg_temp'
AS $function$
declare
  v_me uuid := (select auth.uid());
  v_role text;
  v_name text;
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_site uuid := p_site;
  v_customer uuid;
  v_site_name text;
  t waytara.support_tickets;
  v_msg uuid;
  r record;
  v_payload jsonb;
begin
  select role::text, waytara._support_name(id) into v_role, v_name from waytara.profiles where id = v_me and deactivated_at is null and deleted_at is null;
  if v_role is distinct from 'customer' then raise exception 'Only a customer can open a ticket' using errcode = '42501'; end if;
  if v_subject = '' or char_length(v_subject) > 140 then raise exception 'Give the ticket a subject of up to 140 characters' using errcode = '22023'; end if;
  if v_body = '' or char_length(v_body) > 5000 then raise exception 'Write a message of up to 5000 characters' using errcode = '22023'; end if;
  if v_site is null then
    select s.id into v_site from waytara.sites s where s.customer_id = v_me or waytara.is_super_of_as(v_me, s.customer_id) order by (s.customer_id = v_me) desc, s.created_at limit 1;
  end if;
  if v_site is not null and not exists (select 1 from waytara.sites s where s.id = v_site and (s.customer_id = v_me or waytara.is_super_of_as(v_me, s.customer_id))) then
    raise exception 'That site is not yours' using errcode = '42501';
  end if;
  if p_equipment is not null and not exists (select 1 from waytara.equipment e where e.id = p_equipment and e.site_id = v_site) then
    raise exception 'That device is not at this site' using errcode = '22023';
  end if;
  -- the ticket belongs to the account that owns the site (a super user opens it for the owner who made them one); with no site it is the caller's own
  select customer_id into v_customer from waytara.sites where id = v_site;
  v_customer := coalesce(v_customer, v_me);
  if (select count(*) from waytara.support_tickets where customer_id = v_customer and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many tickets in the last hour. Add to one you already have, or try again later.' using errcode = '54000';
  end if;
  select name into v_site_name from waytara.sites where id = v_site;

  insert into waytara.support_tickets (customer_id, site_id, equipment_id, category, subject, status, last_message_at, last_message_preview, last_message_role, unread_staff, customer_last_read_at)
  values (v_customer, v_site, p_equipment, case when p_category in ('device', 'installation', 'billing', 'account', 'other') then p_category else 'other' end,
          v_subject, 'open', now(), waytara._support_preview(v_body), 'customer', 1, now())
  returning * into t;

  insert into waytara.support_messages (ticket_id, sender_id, sender_role, sender_name, body)
  values (t.id, v_me, 'customer', v_name, v_body) returning id into v_msg;

  v_payload := jsonb_build_object('ticket_no', t.ticket_no, 'subject', t.subject, 'site_name', v_site_name, 'customer_name', v_name, 'preview', waytara._support_preview(v_body), 'category', t.category);
  perform waytara._support_enqueue(t.id, v_me, 'customer', 'ticket_received', v_payload, 'received:' || t.id);
  for r in select staff_id from waytara._support_pool(t.id) loop
    perform waytara._support_enqueue(t.id, r.staff_id, 'staff', 'new_ticket', v_payload, 'new:' || t.id || ':' || r.staff_id);
  end loop;

  return jsonb_build_object('ticket_id', t.id, 'message_id', v_msg, 'ticket_no', t.ticket_no);
end;
$function$;

-- the read rules
drop policy if exists support_tickets_read on waytara.support_tickets;
create policy support_tickets_read on waytara.support_tickets for select to authenticated
  using (customer_id = (select auth.uid()) or waytara.is_super_of(customer_id) or waytara.support_staff_can_access(id));

drop policy if exists support_messages_read on waytara.support_messages;
create policy support_messages_read on waytara.support_messages for select to authenticated
  using (
    waytara.support_staff_can_access(ticket_id)
    or (not internal and exists (select 1 from waytara.support_tickets st where st.id = support_messages.ticket_id and (st.customer_id = (select auth.uid()) or waytara.is_super_of(st.customer_id))))
  );

drop policy if exists support_attachments_read on waytara.support_attachments;
create policy support_attachments_read on waytara.support_attachments for select to authenticated
  using (
    waytara.support_staff_can_access(ticket_id)
    or exists (
      select 1 from waytara.support_messages m join waytara.support_tickets st on st.id = m.ticket_id
      where m.id = support_attachments.message_id and not m.internal and (st.customer_id = (select auth.uid()) or waytara.is_super_of(st.customer_id))
    )
  );

-- does this site belong to this account? Asked by the alert rule rule below, whose check must not depend on which sites the asker happens to see (a super user sees only the
-- sites that hold a device, and a site with none is still the owner's).
create or replace function waytara.site_belongs_to(p_site uuid, p_owner uuid)
returns boolean
language sql stable security definer set search_path = waytara, pg_temp
as $$ select exists (select 1 from waytara.sites s where s.id = p_site and s.customer_id = p_owner) $$;
revoke all on function waytara.site_belongs_to(uuid, uuid) from public, anon;
grant execute on function waytara.site_belongs_to(uuid, uuid) to authenticated, service_role;

-- alert rules: a super user manages the owner's, for the owner's own sites only
drop policy if exists alert_rules_super_all on waytara.alert_rules;
create policy alert_rules_super_all on waytara.alert_rules for all to authenticated
  using (waytara.is_super_of(customer_id))
  with check (waytara.is_super_of(customer_id) and (site_id is null or waytara.site_belongs_to(site_id, customer_id)));

-- Rollback: drop policy alert_rules_super_all; restore the three read policies and the eight support functions from the migrations that created them
-- (20261023* support v2); drop function is_super_of(uuid), is_super_of_as(uuid, uuid), site_belongs_to(uuid, uuid).
