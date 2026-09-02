-- Phase 5 of the device-centric dashboard: Instrument Settings gains a
-- "Site Setting" tab that edits the selected device's site (name, property
-- type, power source category, address) and the device's own display
-- label. Neither `sites` nor `devices` had any customer-facing UPDATE
-- policy before this (confirmed the same way Task 9's audit did — only
-- admin/employee-assigned policies existed on both).
--
-- sites: column-restricted via REVOKE+GRANT, same tool used for
-- profiles_self_update/customers_self_update — `customer_id` is also
-- covered by the `with check`, so a customer can't reassign a site to
-- someone else even without the grant, but `id`/`created_at` have no
-- reason to ever be customer-writable, so they're left out of the grant
-- too rather than relying on the UI alone to not send them.
--
-- devices: same tool, but the grant is narrower still — `label` only.
-- `site_id`/`device_type_id`/`status`/`warranty_info` all stay
-- staff/admin-only; a customer relabeling "Inverter #2" to "Rooftop
-- Inverter" should never be able to reassign it to a different site or
-- flip its status as a side effect.

revoke update on waytara.sites from authenticated;
grant update (name, property_type, power_source_category, address) on waytara.sites to authenticated;

drop policy if exists "sites_customer_update_own" on waytara.sites;
create policy "sites_customer_update_own" on waytara.sites
  for update
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

revoke update on waytara.devices from authenticated;
grant update (label) on waytara.devices to authenticated;

drop policy if exists "devices_customer_update_own_label" on waytara.devices;
create policy "devices_customer_update_own_label" on waytara.devices
  for update
  using (
    exists (
      select 1 from waytara.sites s
      where s.id = devices.site_id and s.customer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from waytara.sites s
      where s.id = devices.site_id and s.customer_id = auth.uid()
    )
  );
