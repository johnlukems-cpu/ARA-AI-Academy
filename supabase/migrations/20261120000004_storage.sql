-- ARA AI Academy – Storage buckets and policies

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-assets', 'public-assets', true, 5242880,
   array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('course-resources', 'course-resources', false, 52428800,
   array['application/pdf', 'application/zip', 'image/png', 'image/jpeg', 'text/plain', 'text/csv',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'video/mp4']),
  ('payment-proofs', 'payment-proofs', false, 10485760,
   array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('assignment-files', 'assignment-files', false, 20971520,
   array['application/pdf', 'application/zip', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- public-assets: readable by everyone (bucket is public); admins manage branding/course images;
-- users manage their own avatar under avatars/<uid>/
create policy "public assets admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());
create policy "avatar own write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-assets' and (storage.foldername(name))[1] = 'avatars'
              and (storage.foldername(name))[2] = auth.uid()::text);
create policy "avatar own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-assets' and (storage.foldername(name))[1] = 'avatars'
         and (storage.foldername(name))[2] = auth.uid()::text);
create policy "avatar own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-assets' and (storage.foldername(name))[1] = 'avatars'
         and (storage.foldername(name))[2] = auth.uid()::text);

-- course-resources: admins only (students get signed URLs from the server after an access check)
create policy "course resources admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'course-resources' and public.is_admin())
  with check (bucket_id = 'course-resources' and public.is_admin());

-- payment-proofs & assignment-files: own folder <uid>/..., admins read all
create policy "private uploads own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('payment-proofs', 'assignment-files')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "private uploads own or admin read" on storage.objects
  for select to authenticated
  using (bucket_id in ('payment-proofs', 'assignment-files')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "private uploads admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('payment-proofs', 'assignment-files') and public.is_admin());
