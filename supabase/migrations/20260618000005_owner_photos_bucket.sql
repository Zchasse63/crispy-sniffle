-- Owner-photo uploads. Public read; 15MB limit (phone photos run 3-12MB);
-- HEIC/HEIF accepted (iPhone default). PROTOTYPE: anon insert is scoped to the
-- bucket only — tighten to token-validated upload when the owner_submissions
-- backend lands (see partner-outreach-plan.md ingestion design).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'owner-photos', 'owner-photos', true, 15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owner_photos_anon_insert" on storage.objects;
create policy "owner_photos_anon_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'owner-photos');

drop policy if exists "owner_photos_public_read" on storage.objects;
create policy "owner_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'owner-photos');
