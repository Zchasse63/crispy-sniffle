-- Rehost gym photos into our OWN Storage so they can't rot or hotlink-block the
-- way external source URLs do (Central Rock's went 404). `storage_path` points at
-- an object in the public `gym-photos` bucket; the app serves from there when set
-- and falls back to the original `url`/`photo_url` otherwise (safe partial rollout).
-- Backend is swappable in one place: src/lib/gymPhotoUrl.ts.

-- Public-read bucket. Writes are service-role only (the rehost loader) — NO anon
-- insert policy, unlike owner-photos which needs client uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gym-photos', 'gym-photos', true, 15728640,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gym_photos_public_read" on storage.objects;
create policy "gym_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'gym-photos');
-- (no insert/update/delete policy: only the service role writes, and it bypasses RLS)

alter table public.gym_photos add column if not exists storage_path text;
alter table public.gyms add column if not exists photo_storage_path text;
