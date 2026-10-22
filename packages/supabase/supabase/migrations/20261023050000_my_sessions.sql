-- A person's own sign-ins ("devices"), so they can see where they are signed in and sign one of them out. Supabase keeps these in
-- auth.sessions, which the apps cannot read; these two functions expose only the caller's own rows. The current session is the one named in
-- the caller's access token (the session_id claim). Signing out all other devices, or all, uses Supabase's own signOut scopes (others,
-- global), so only the single-session case needs a function.
--
-- Deleting a session row also removes its refresh tokens, so that device cannot renew; its current access token stops being accepted by
-- the auth service at once (the apps check the user with the auth service on each page load).

create or replace function waytara.my_sessions()
returns table (id uuid, created_at timestamptz, last_active timestamptz, user_agent text, ip text, is_current boolean)
language sql
stable
security definer
set search_path = waytara, auth, pg_temp
as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at, s.updated_at, s.created_at) as last_active,
         s.user_agent,
         host(s.ip) as ip,
         s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid as is_current
    from auth.sessions s
   where s.user_id = auth.uid()
     and (s.not_after is null or s.not_after > now())
   order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc
$$;

create or replace function waytara.revoke_my_session(p_id uuid)
returns void
language plpgsql
security definer
set search_path = waytara, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from auth.sessions where id = p_id and user_id = auth.uid();
end;
$$;

revoke all on function waytara.my_sessions() from public, anon;
revoke all on function waytara.revoke_my_session(uuid) from public, anon;
grant execute on function waytara.my_sessions() to authenticated;
grant execute on function waytara.revoke_my_session(uuid) to authenticated;

-- To undo: drop function waytara.my_sessions(); drop function waytara.revoke_my_session(uuid);
