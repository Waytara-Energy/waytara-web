-- Support v2, part 3: the files of an internal note live in their own folder (<ticket id>/internal/...), which only staff can read, so a customer
-- cannot list or open them even though they can read the other files of their ticket.

-- a policy runs as the signed-in role, which may not call the *_as helpers: these two wrappers (the caller's own id) are what the rules use
create or replace function waytara.support_can_access(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = waytara, pg_temp
as $$
  select waytara.support_can_access_as((select auth.uid()), p_ticket)
$$;
revoke all on function waytara.support_can_access(uuid) from public, anon;
grant execute on function waytara.support_can_access(uuid) to authenticated, service_role;

drop policy if exists "support_files_select" on storage.objects;
create policy "support_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and waytara.support_can_access(waytara.support_object_ticket(name))
    and (
      split_part(name, '/', 2) <> 'internal'
      or waytara.support_staff_can_access(waytara.support_object_ticket(name))
    )
  );

-- only staff may put files in the internal folder
drop policy if exists "support_files_insert" on storage.objects;
create policy "support_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and waytara.support_can_access(waytara.support_object_ticket(name))
    and (
      split_part(name, '/', 2) <> 'internal'
      or waytara.support_staff_can_access(waytara.support_object_ticket(name))
    )
  );

-- a message's files must be in the folder that matches the message: the ticket's own, or its internal folder for an internal note
create or replace function waytara.support_attach(p_message uuid, p_files jsonb)
returns integer
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_me uuid := (select auth.uid());
  m waytara.support_messages;
  f jsonb;
  v_have integer;
  v_added integer := 0;
  v_pattern text;
begin
  select * into m from waytara.support_messages where id = p_message;
  if not found or m.sender_id is distinct from v_me then raise exception 'You can only add files to your own message' using errcode = '42501'; end if;
  if m.created_at < now() - interval '15 minutes' then raise exception 'Files can be added to a message for 15 minutes' using errcode = '22023'; end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array' then raise exception 'No files' using errcode = '22023'; end if;
  select count(*) into v_have from waytara.support_attachments where message_id = p_message;
  if v_have + jsonb_array_length(p_files) > 5 then raise exception 'A message can carry up to 5 files' using errcode = '22023'; end if;

  v_pattern := '^' || m.ticket_id::text || case when m.internal then '/internal/' else '/' end || '[^/]{1,200}$';
  for f in select * from jsonb_array_elements(p_files) loop
    if coalesce(f ->> 'path', '') !~ v_pattern then raise exception 'A file is not in the right folder of this ticket' using errcode = '22023'; end if;
    if coalesce((f ->> 'size')::bigint, -1) not between 0 and 10485760 then raise exception 'A file is larger than 10 MB' using errcode = '22023'; end if;
    insert into waytara.support_attachments (message_id, ticket_id, path, file_name, size_bytes, mime_type)
    values (p_message, m.ticket_id, f ->> 'path', left(coalesce(nullif(f ->> 'name', ''), 'file'), 200), (f ->> 'size')::bigint, nullif(f ->> 'mime', ''))
    on conflict (path) do nothing;
    v_added := v_added + 1;
  end loop;
  return v_added;
end;
$$;

-- To undo: restore support_files_select / support_files_insert and support_attach from 20261023010000_support_v2.sql.
