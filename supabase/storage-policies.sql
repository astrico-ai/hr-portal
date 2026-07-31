-- ============================================================================
-- Lock the private 'documents' Storage bucket to allow-listed users.
-- Reuses the same is_allowed_user() gate as the tables, so only @astrico.ai
-- (and explicit extra emails) can view/upload documents. Signed links the app
-- generates work because the signed-in user passes this check.
-- ============================================================================
drop policy if exists documents_select on storage.objects;
drop policy if exists documents_insert on storage.objects;
drop policy if exists documents_update on storage.objects;
drop policy if exists documents_delete on storage.objects;

create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_allowed_user());

create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_allowed_user());

create policy documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_allowed_user())
  with check (bucket_id = 'documents' and public.is_allowed_user());

create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_allowed_user());
