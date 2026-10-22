-- Recording a customer's subscription. Nothing created a subscriptions row until now (the customer's Billing & Plan page showed "No
-- subscription record yet" for everyone), and the table is read-only for everybody, admins included. An admin records one through this
-- function; changing its state (cancel, or mark payment due) goes through the second one. Both check that the caller is an admin, so they
-- are safe to expose, and the table stays closed to direct writes.
--
-- A renewal is a new row: the customer's page shows the latest, and the older ones stay as the history.

create or replace function waytara.record_subscription(
  p_customer uuid,
  p_plan uuid,
  p_status waytara.subscription_status default 'active',
  p_start timestamptz default now(),
  p_end timestamptz default null,
  p_ref text default null
) returns uuid
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
declare
  v_id uuid;
begin
  if not waytara.is_admin() then
    raise exception 'Only an admin can record a subscription.' using errcode = '42501';
  end if;
  if not exists (select 1 from waytara.customers where id = p_customer) then
    raise exception 'That customer does not exist.' using errcode = '22023';
  end if;
  if not exists (select 1 from waytara.plans where id = p_plan) then
    raise exception 'That plan does not exist.' using errcode = '22023';
  end if;
  if p_end is not null and p_start is not null and p_end <= p_start then
    raise exception 'The period must end after it starts.' using errcode = '22023';
  end if;

  insert into waytara.subscriptions (customer_id, plan_id, status, current_period_start, current_period_end, payment_gateway_ref)
  values (p_customer, p_plan, p_status, p_start, p_end, nullif(btrim(p_ref), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function waytara.set_subscription_status(p_id uuid, p_status waytara.subscription_status)
returns void
language plpgsql
security definer
set search_path = waytara, pg_temp
as $$
begin
  if not waytara.is_admin() then
    raise exception 'Only an admin can change a subscription.' using errcode = '42501';
  end if;
  update waytara.subscriptions set status = p_status where id = p_id;
  if not found then
    raise exception 'That subscription does not exist.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function waytara.record_subscription(uuid, uuid, waytara.subscription_status, timestamptz, timestamptz, text) from public, anon;
revoke all on function waytara.set_subscription_status(uuid, waytara.subscription_status) from public, anon;
grant execute on function waytara.record_subscription(uuid, uuid, waytara.subscription_status, timestamptz, timestamptz, text) to authenticated;
grant execute on function waytara.set_subscription_status(uuid, waytara.subscription_status) to authenticated;

-- To undo: drop function waytara.record_subscription(uuid, uuid, waytara.subscription_status, timestamptz, timestamptz, text);
--          drop function waytara.set_subscription_status(uuid, waytara.subscription_status);
