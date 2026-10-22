-- Support v2: who sees a ticket, taking and handing over, the thread lines, the e-mails queued, status, rating, "seen" and files.
-- Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public, waytara;

select plan(69);

-- ---- people: a customer with a site, its installer and employee, an admin, an employee of nowhere, another customer -------------------

insert into auth.users (id, instance_id, aud, role, email) values
  ('c1000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust@test.local'),
  ('c2000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.local'),
  ('a0000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('e1000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp@test.local'),
  ('e2000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eng@test.local'),
  ('e3000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'away@test.local');
insert into waytara.profiles (id, email, role, full_name) values
  ('c1000000-0000-0000-0000-0000000000d1', 'cust@test.local', 'customer', 'Chitra Customer'),
  ('c2000000-0000-0000-0000-0000000000d1', 'other@test.local', 'customer', 'Other Customer'),
  ('a0000000-0000-0000-0000-0000000000d1', 'admin@test.local', 'admin', 'Asha Admin'),
  ('e1000000-0000-0000-0000-0000000000d1', 'emp@test.local', 'employee', 'Emil Employee'),
  ('e2000000-0000-0000-0000-0000000000d1', 'eng@test.local', 'site_engineer', 'Ivan Installer'),
  ('e3000000-0000-0000-0000-0000000000d1', 'away@test.local', 'employee', 'Nora Elsewhere');
insert into waytara.customers (id) values ('c1000000-0000-0000-0000-0000000000d1'), ('c2000000-0000-0000-0000-0000000000d1');
insert into waytara.sites (id, customer_id, name, property_type, power_source_category) values
  ('51000000-0000-0000-0000-0000000000d1', 'c1000000-0000-0000-0000-0000000000d1', 'Villa', 'residential_independent_villas', 'hybrid'),
  ('52000000-0000-0000-0000-0000000000d1', 'c2000000-0000-0000-0000-0000000000d1', 'Other villa', 'residential_independent_villas', 'hybrid');
insert into waytara.site_staff (site_id, staff_id) values
  ('51000000-0000-0000-0000-0000000000d1', 'e1000000-0000-0000-0000-0000000000d1'),
  ('51000000-0000-0000-0000-0000000000d1', 'e2000000-0000-0000-0000-0000000000d1');

-- how many admins exist (the live database has real ones besides the test admin); counted now, before the role changes
select set_config('test.admins', (select count(*)::int from waytara.profiles where role = 'admin' and deactivated_at is null and deleted_at is null)::text, true);

create or replace function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end;
$$;
create or replace function pg_temp.back() returns void language plpgsql as $$ begin execute 'reset role'; end; $$;
create or replace function pg_temp.mail(p_ticket uuid, p_kind text) returns int language sql as $$
  select count(*)::int from waytara.support_notifications where ticket_id = p_ticket and kind = p_kind
$$;

-- ---- the customer opens a ticket --------------------------------------------------------------------------------------------------------

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select set_config('test.t1', (waytara.support_create_ticket('51000000-0000-0000-0000-0000000000d1', null, 'device', 'Inverter beeps', 'It beeps every evening.') ->> 'ticket_id'), true);
select set_config('test.t2', (waytara.support_create_ticket('51000000-0000-0000-0000-0000000000d1', null, 'billing', 'Second ticket', 'A question.') ->> 'ticket_id'), true);
select is((select status from waytara.support_tickets where id = current_setting('test.t1')::uuid), 'open', 'a new ticket is open');
select is((select assigned_to from waytara.support_tickets where id = current_setting('test.t1')::uuid), null, 'and nobody has it yet');
select is((select customer_name || ' / ' || site_name from waytara.support_tickets where id = current_setting('test.t1')::uuid), 'Chitra Customer / Villa', 'the ticket carries the customer''s and the site''s name for the team''s lists');
select is((select count(*)::int from waytara.support_messages where ticket_id = current_setting('test.t1')::uuid), 1, 'with its first message');
select throws_ok($$select waytara.support_create_ticket('52000000-0000-0000-0000-0000000000d1', null, 'other', 'Not mine', 'x')$$, '42501', null, 'a customer cannot open a ticket on somebody else''s site');
select throws_ok($$select waytara.support_create_ticket(null, null, 'other', '   ', 'x')$$, '22023', null, 'a ticket needs a subject');
select throws_ok($$update waytara.support_tickets set assigned_to = 'c1000000-0000-0000-0000-0000000000d1', rating = 5, status = 'closed' where id = current_setting('test.t1')::uuid$$, '42501', null, 'a customer cannot write a ticket directly (no assigning, rating or closing by hand)');
select throws_ok($$insert into waytara.support_messages (ticket_id, sender_id, sender_role, body) values (current_setting('test.t1')::uuid, 'c1000000-0000-0000-0000-0000000000d1', 'customer', 'sneaky')$$, '42501', null, 'nor a message');
select pg_temp.back();

select is(pg_temp.mail(current_setting('test.t1')::uuid, 'new_ticket'), current_setting('test.admins')::int + 2, 'every admin, and the employee and the installer of the site, are told of the new ticket');
select is(pg_temp.mail(current_setting('test.t1')::uuid, 'ticket_received'), 1, 'and the customer gets a confirmation');

-- ---- who sees it ---------------------------------------------------------------------------------------------------------------------------

select pg_temp.as_user('e1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_tickets where id = current_setting('test.t1')::uuid), 1, 'an employee of the site sees it');
select pg_temp.as_user('e2000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_tickets where id = current_setting('test.t1')::uuid), 1, 'so does the site''s installer (site engineer)');
select pg_temp.as_user('e3000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_tickets where id = current_setting('test.t1')::uuid), 0, 'an employee of another site does not');
select pg_temp.as_user('c2000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_tickets where id = current_setting('test.t1')::uuid), 0, 'nor does another customer');
select pg_temp.as_user('a0000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_tickets where id = current_setting('test.t1')::uuid), 1, 'an admin sees every ticket');

-- ---- taking it, handing it over ------------------------------------------------------------------------------------------------------------

select pg_temp.as_user('e3000000-0000-0000-0000-0000000000d1');
select throws_ok($$select waytara.support_take(current_setting('test.t1')::uuid)$$, '42501', null, 'someone with no access to the site cannot take it');
select pg_temp.as_user('e1000000-0000-0000-0000-0000000000d1');
select lives_ok($$select waytara.support_take(current_setting('test.t1')::uuid)$$, 'an employee of the site takes it');
select is((select assigned_name || ' / ' || status from waytara.support_tickets where id = current_setting('test.t1')::uuid), 'Emil Employee / in_progress', 'it is theirs and in progress');
select is((select body from waytara.support_messages where ticket_id = current_setting('test.t1')::uuid and event = 'taken'), 'Emil Employee took this ticket', 'the thread says so');
select pg_temp.back();
select is(pg_temp.mail(current_setting('test.t1')::uuid, 'taken'), 1, 'and the customer is e-mailed that someone took it');

select pg_temp.as_user('e1000000-0000-0000-0000-0000000000d1');
select throws_ok($$select waytara.support_assign(current_setting('test.t1')::uuid, 'e3000000-0000-0000-0000-0000000000d1')$$, '22023', null, 'it cannot be handed to someone who cannot work on it');
select lives_ok($$select waytara.support_assign(current_setting('test.t1')::uuid, 'e2000000-0000-0000-0000-0000000000d1')$$, 'it is handed to the installer');
select pg_temp.back();
select is((select assigned_name from waytara.support_tickets where id = current_setting('test.t1')::uuid), 'Ivan Installer', 'the installer has it now');
select is(pg_temp.mail(current_setting('test.t1')::uuid, 'reassigned'), 1, 'the customer is told it was reassigned');
select is(pg_temp.mail(current_setting('test.t1')::uuid, 'assigned_to_you'), 1, 'the installer is told it is theirs');
select is(pg_temp.mail(current_setting('test.t1')::uuid, 'unassigned_from_you'), 0, 'the one who handed it over does not get an e-mail about their own action');

-- ---- the conversation -------------------------------------------------------------------------------------------------------------------------

select pg_temp.as_user('e2000000-0000-0000-0000-0000000000d1');
select set_config('test.pub', waytara.support_send_message(current_setting('test.t1')::uuid, 'We will visit tomorrow.', false)::text, true);
select set_config('test.note', waytara.support_send_message(current_setting('test.t1')::uuid, 'Check the earth cable first.', true)::text, true);
select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_messages where ticket_id = current_setting('test.t1')::uuid and internal), 0, 'the customer never sees an internal note');
select is((select unread_customer from waytara.support_tickets where id = current_setting('test.t1')::uuid), 1, 'the customer has one unread message (the note and the thread lines do not count)');
select lives_ok($$select waytara.support_mark_read(current_setting('test.t1')::uuid)$$, 'the customer reads the thread');
select is((select unread_customer from waytara.support_tickets where id = current_setting('test.t1')::uuid), 0, 'nothing is unread now');
select ok((select customer_last_read_at is not null and customer_last_read_at >= last_message_at from waytara.support_tickets where id = current_setting('test.t1')::uuid), 'and the staff side can tell the reply was seen');
select pg_temp.back();
select is(pg_temp.mail(current_setting('test.t1')::uuid, 'staff_reply'), 1, 'the customer has an e-mail for the reply (sent only if still unseen after a short wait)');
select ok((select due_at > now() + interval '30 seconds' from waytara.support_notifications where ticket_id = current_setting('test.t1')::uuid and kind = 'staff_reply'), 'which waits about 45 seconds');

select pg_temp.as_user('e2000000-0000-0000-0000-0000000000d1');
select is((select unread_staff from waytara.support_tickets where id = current_setting('test.t1')::uuid), 0, 'a reply from staff leaves nothing unread for staff');
select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select lives_ok($$select waytara.support_send_message(current_setting('test.t1')::uuid, 'Thank you!', false)$$, 'the customer answers');
select pg_temp.back();
select is((select unread_staff from waytara.support_tickets where id = current_setting('test.t1')::uuid), 1, 'staff have one unread');
select is((select count(*)::int from waytara.support_notifications where ticket_id = current_setting('test.t1')::uuid and kind = 'customer_reply' and recipient_id = 'e2000000-0000-0000-0000-0000000000d1'), 1, 'only the person handling it is told of the customer''s reply');
select is((select count(*)::int from waytara.support_notifications where ticket_id = current_setting('test.t1')::uuid and kind = 'customer_reply'), 1, 'and nobody else');

-- ---- files ----------------------------------------------------------------------------------------------------------------------------------

select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select throws_ok($$select waytara.support_attach(current_setting('test.pub')::uuid, jsonb_build_array(jsonb_build_object('path', 'x/y.png', 'name', 'y.png', 'size', 10)))$$, '42501', null, 'a customer cannot add files to a message that is not theirs');
select pg_temp.as_user('e2000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select waytara.support_attach(current_setting('test.pub')::uuid, jsonb_build_array(jsonb_build_object('path', 'other/y.png', 'name', 'y.png', 'size', 10)))$$), '22023', null, 'a file must be in the ticket''s own folder');
select is(waytara.support_attach(current_setting('test.pub')::uuid, jsonb_build_array(jsonb_build_object('path', current_setting('test.t1') || '/a.png', 'name', 'a.png', 'size', 1000, 'mime', 'image/png'))), 1, 'a file in the ticket''s folder is added');
select throws_ok(format($$select waytara.support_attach(current_setting('test.pub')::uuid, jsonb_build_array(jsonb_build_object('path', %L, 'name', 'big.mp4', 'size', 20000000)))$$, current_setting('test.t1') || '/big.mp4'), '22023', null, 'a file over 10 MB is refused');
select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_attachments where ticket_id = current_setting('test.t1')::uuid), 1, 'the customer sees the file of the public message');

-- the files of an internal note live in their own folder, which the customer cannot read
select pg_temp.as_user('e2000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select waytara.support_attach(current_setting('test.note')::uuid, jsonb_build_array(jsonb_build_object('path', %L, 'name', 'n.png', 'size', 10)))$$, current_setting('test.t1') || '/n.png'), '22023', null, 'the file of an internal note must be in the internal folder');
select is(waytara.support_attach(current_setting('test.note')::uuid, jsonb_build_array(jsonb_build_object('path', current_setting('test.t1') || '/internal/n.png', 'name', 'n.png', 'size', 10))), 1, 'and one in the internal folder is added');
select throws_ok(format($$select waytara.support_attach(current_setting('test.pub')::uuid, jsonb_build_array(jsonb_build_object('path', %L, 'name', 'n.png', 'size', 10)))$$, current_setting('test.t1') || '/internal/p.png'), '22023', null, 'a public message cannot put its file in the internal folder');
select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_attachments where ticket_id = current_setting('test.t1')::uuid), 1, 'the customer still sees only the file of the public message');

-- and the storage rules agree: three stored files, one of them in the internal folder
select pg_temp.back();
insert into storage.objects (bucket_id, name) values
  ('support-attachments', current_setting('test.t1') || '/a.png'),
  ('support-attachments', current_setting('test.t1') || '/internal/n.png'),
  ('support-attachments', current_setting('test.t2') || '/other.png');
select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from storage.objects where bucket_id = 'support-attachments' and name like current_setting('test.t1') || '/%'), 1, 'the customer can list the files of their ticket but not the internal folder');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('support-attachments', %L)$$, current_setting('test.t1') || '/customer-upload.png'), 'the customer can upload a file into their own ticket''s folder');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('support-attachments', %L)$$, current_setting('test.t1') || '/internal/sneaky.png'), '42501', null, 'but not into the internal folder');
select pg_temp.as_user('c2000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('support-attachments', %L)$$, current_setting('test.t1') || '/intruder.png'), '42501', null, 'another customer cannot upload into it');
select is((select count(*)::int from storage.objects where bucket_id = 'support-attachments' and name like current_setting('test.t1') || '/%'), 0, 'another customer sees none of them');
select pg_temp.as_user('e1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from storage.objects where bucket_id = 'support-attachments' and name like current_setting('test.t1') || '/%'), 3, 'the site''s team sees all of them, the internal folder too');

-- ---- resolving, reopening, closing, rating ----------------------------------------------------------------------------------------------

select pg_temp.as_user('e2000000-0000-0000-0000-0000000000d1');
select lives_ok($$select waytara.support_set_status(current_setting('test.t1')::uuid, 'resolved')$$, 'the installer marks it resolved');
select pg_temp.back();
select is(pg_temp.mail(current_setting('test.t1')::uuid, 'resolved'), 1, 'the customer is e-mailed that it is resolved');
select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select lives_ok($$select waytara.support_customer_reopen(current_setting('test.t1')::uuid)$$, 'the customer says it is not solved: reopen');
select is((select status from waytara.support_tickets where id = current_setting('test.t1')::uuid), 'in_progress', 'it is in progress again, with the same person');
select throws_ok($$select waytara.support_customer_reopen(current_setting('test.t1')::uuid)$$, '22023', null, 'only a resolved ticket can be reopened');
select lives_ok($$select waytara.support_customer_close(current_setting('test.t1')::uuid, 5::smallint, 'Quick and kind')$$, 'the customer closes it with a rating');
select is((select status || ' ' || rating::text from waytara.support_tickets where id = current_setting('test.t1')::uuid), 'closed 5', 'closed, rated 5');
select throws_ok($$select waytara.support_send_message(current_setting('test.t1')::uuid, 'more', false)$$, '22023', null, 'a closed ticket takes no more messages from the customer');
select throws_ok($$select waytara.support_rate(current_setting('test.t1')::uuid, 4::smallint, null)$$, '22023', null, 'and cannot be rated twice');
select pg_temp.back();
select is((select count(*)::int from waytara.support_notifications where ticket_id = current_setting('test.t1')::uuid and kind = 'closed_by_customer' and recipient_id = 'e2000000-0000-0000-0000-0000000000d1'), 1, 'the person who handled it is told it was closed and how it was rated');

-- ---- a ticket staff close, and a rating afterwards; a message from staff on an unassigned ticket takes it --------------------------------------

select pg_temp.as_user('a0000000-0000-0000-0000-0000000000d1');
select lives_ok($$select waytara.support_send_message(current_setting('test.t2')::uuid, 'Hello, Asha here.', false)$$, 'an admin answers a ticket nobody had');
select is((select assigned_name from waytara.support_tickets where id = current_setting('test.t2')::uuid), 'Asha Admin', 'and so takes it');
select lives_ok($$select waytara.support_set_status(current_setting('test.t2')::uuid, 'closed')$$, 'and closes it');
select pg_temp.as_user('c1000000-0000-0000-0000-0000000000d1');
select lives_ok($$select waytara.support_rate(current_setting('test.t2')::uuid, 3::smallint, 'ok')$$, 'the customer rates a ticket staff closed');
select is((select count(*)::int from waytara.support_assignees(current_setting('test.t1')::uuid)), 0, 'a customer is given no list of staff');
select pg_temp.as_user('e1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from waytara.support_assignees(current_setting('test.t1')::uuid)), current_setting('test.admins')::int + 2, 'the list to hand a ticket to holds the admin, the employee and the installer of its site');

select * from finish();
rollback;
