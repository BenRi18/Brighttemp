-- =====================================================================
-- Compliance document storage.
--
-- This was documented but never runnable — the policies sat commented out
-- at the end of 0002_rls.sql because the bucket has to exist first.
-- Without it, every upload fails with "Bucket not found".
--
-- Path convention inside the bucket: {locum_id}/{doc_type}/{filename}
-- The policies key off the FIRST path segment, which is the locum's id.
-- =====================================================================

-- 1. The bucket. Private: files are only ever served through short-lived
--    signed URLs, never as public assets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compliance', 'compliance', false,
  10485760,  -- 10MB, matching features/compliance/schema.ts
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Policies. A locum may read and write only their own folder.
drop policy if exists compliance_read_own on storage.objects;
create policy compliance_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'compliance'
    and (storage.foldername(name))[1] = public.my_locum_id()::text
  );

drop policy if exists compliance_write_own on storage.objects;
create policy compliance_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'compliance'
    and (storage.foldername(name))[1] = public.my_locum_id()::text
  );

-- A locum replacing a rejected document overwrites their own file.
drop policy if exists compliance_update_own on storage.objects;
create policy compliance_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'compliance'
    and (storage.foldername(name))[1] = public.my_locum_id()::text
  );

-- Brighttemp staff who review documents can read every file in the bucket.
drop policy if exists compliance_admin on storage.objects;
create policy compliance_admin on storage.objects
  for all to authenticated
  using (
    bucket_id = 'compliance'
    and public.has_admin_role('super_admin', 'operations', 'compliance')
  );

-- =====================================================================
-- If this fails with "must be owner of table objects", your project does
-- not allow policy changes on storage.objects from SQL. Create the same
-- four policies in the dashboard under Storage → compliance → Policies.
-- =====================================================================
