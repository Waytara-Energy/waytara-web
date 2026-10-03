-- Storage buckets and storage.objects policies, exported from production for local testing.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('avatars','avatars',true,null,null) on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('customer-kyc','customer-kyc',false,null,null) on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('device-catalog','device-catalog',true,null,null) on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('maintenance-media','maintenance-media',false,null,null) on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('quotation-pdfs','quotation-pdfs',true,null,null) on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('site-documents','site-documents',false,null,null) on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('support-attachments','support-attachments',false,null,null) on conflict (id) do nothing;
create policy "avatars_owner_delete" on storage.objects as PERMISSIVE for delete to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "avatars_owner_update" on storage.objects as PERMISSIVE for update to authenticated using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "avatars_owner_write" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "customer_kyc_admin_delete" on storage.objects as PERMISSIVE for delete to authenticated using (((bucket_id = 'customer-kyc'::text) AND waytara.is_admin()));
create policy "customer_kyc_owner_read" on storage.objects as PERMISSIVE for select to authenticated using (((bucket_id = 'customer-kyc'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR waytara.is_admin())));
create policy "customer_kyc_owner_write" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'customer-kyc'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "device_catalog_admin_delete" on storage.objects as PERMISSIVE for delete to authenticated using (((bucket_id = 'device-catalog'::text) AND waytara.is_admin()));
create policy "device_catalog_admin_update" on storage.objects as PERMISSIVE for update to authenticated using (((bucket_id = 'device-catalog'::text) AND waytara.is_admin()));
create policy "device_catalog_admin_write" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'device-catalog'::text) AND waytara.is_admin()));
create policy "maintenance_media_delete" on storage.objects as PERMISSIVE for delete to authenticated using (((bucket_id = 'maintenance-media'::text) AND waytara.is_admin()));
create policy "maintenance_media_read" on storage.objects as PERMISSIVE for select to authenticated using (((bucket_id = 'maintenance-media'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR waytara.is_admin() OR (EXISTS ( SELECT 1
   FROM waytara.customer_onboarding co
  WHERE (((co.customer_id)::text = (storage.foldername(objects.name))[1]) AND (co.employee_id = auth.uid())))))));
create policy "maintenance_media_write" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'maintenance-media'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR waytara.is_admin() OR (EXISTS ( SELECT 1
   FROM waytara.customer_onboarding co
  WHERE (((co.customer_id)::text = (storage.foldername(objects.name))[1]) AND (co.employee_id = auth.uid())))))));
create policy "quotation_pdfs_staff_delete" on storage.objects as PERMISSIVE for delete to authenticated using (((bucket_id = 'quotation-pdfs'::text) AND waytara.is_staff()));
create policy "quotation_pdfs_staff_insert" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'quotation-pdfs'::text) AND waytara.is_staff()));
create policy "quotation_pdfs_staff_select" on storage.objects as PERMISSIVE for select to authenticated using (((bucket_id = 'quotation-pdfs'::text) AND waytara.is_staff()));
create policy "quotation_pdfs_staff_update" on storage.objects as PERMISSIVE for update to authenticated using (((bucket_id = 'quotation-pdfs'::text) AND waytara.is_staff())) with check (((bucket_id = 'quotation-pdfs'::text) AND waytara.is_staff()));
create policy "quotation_pdfs_staff_write" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'quotation-pdfs'::text) AND waytara.is_staff()));
create policy "site_docs_delete" on storage.objects as PERMISSIVE for delete to authenticated using (((bucket_id = 'site-documents'::text) AND waytara.is_admin()));
create policy "site_docs_read" on storage.objects as PERMISSIVE for select to authenticated using (((bucket_id = 'site-documents'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR waytara.is_admin() OR (EXISTS ( SELECT 1
   FROM waytara.customer_onboarding co
  WHERE (((co.customer_id)::text = (storage.foldername(objects.name))[1]) AND (co.employee_id = auth.uid())))))));
create policy "site_docs_write" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'site-documents'::text) AND (waytara.is_admin() OR (EXISTS ( SELECT 1
   FROM waytara.customer_onboarding co
  WHERE (((co.customer_id)::text = (storage.foldername(objects.name))[1]) AND (co.employee_id = auth.uid())))))));
create policy "support_attachments_admin_insert" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'support-attachments'::text) AND waytara.is_admin()));
create policy "support_attachments_admin_select" on storage.objects as PERMISSIVE for select to authenticated using (((bucket_id = 'support-attachments'::text) AND waytara.is_admin()));
create policy "support_attachments_customer_insert" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'support-attachments'::text) AND (EXISTS ( SELECT 1
   FROM waytara.support_tickets st
  WHERE (((st.id)::text = (storage.foldername(objects.name))[1]) AND (st.customer_id = auth.uid()))))));
create policy "support_attachments_customer_select" on storage.objects as PERMISSIVE for select to authenticated using (((bucket_id = 'support-attachments'::text) AND (EXISTS ( SELECT 1
   FROM waytara.support_tickets st
  WHERE (((st.id)::text = (storage.foldername(objects.name))[1]) AND (st.customer_id = auth.uid()))))));
create policy "support_attachments_employee_insert" on storage.objects as PERMISSIVE for insert to authenticated with check (((bucket_id = 'support-attachments'::text) AND (EXISTS ( SELECT 1
   FROM (waytara.support_tickets st
     JOIN waytara.customer_onboarding co ON ((co.customer_id = st.customer_id)))
  WHERE (((st.id)::text = (storage.foldername(objects.name))[1]) AND (co.employee_id = auth.uid()))))));
create policy "support_attachments_employee_select" on storage.objects as PERMISSIVE for select to authenticated using (((bucket_id = 'support-attachments'::text) AND (EXISTS ( SELECT 1
   FROM (waytara.support_tickets st
     JOIN waytara.customer_onboarding co ON ((co.customer_id = st.customer_id)))
  WHERE (((st.id)::text = (storage.foldername(objects.name))[1]) AND (co.employee_id = auth.uid()))))));
