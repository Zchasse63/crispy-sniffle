-- Metro-expansion staging: page-cache columns + the private page-cache bucket.
alter table public.facility_candidates add column if not exists photos jsonb;
alter table public.facility_candidates add column if not exists fetched_at timestamptz;
alter table public.facility_candidates add column if not exists landed_at timestamptz;

-- Private page-cache bucket: only the service-role loaders read/write it
-- ("re-extraction must never require a re-crawl"). No public read, no client policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facility-cache', 'facility-cache', false, 5242880, array['text/markdown','text/plain'])
on conflict (id) do update set public = excluded.public;
