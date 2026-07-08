-- Metro-expansion pipeline staging table (Stage 1 discovery → Stage 4 landing).
-- Holds discovered fitness facilities (Overture Maps + later FSQ/ATP) with per-
-- source provenance, validation state, pre-classified segment, and a link to the
-- landed gym. Internal: staff-only read; only the service-role loaders write.
create table if not exists public.facility_candidates (
  overture_id  text primary key,
  metro        text not null,                 -- 'miami', 'tampa', ...
  name         text not null,
  segment      text,                           -- pre-classified (soft): strength|crossfit|yoga|mma|...
  category     text,                           -- Overture primary category
  categories   jsonb,                          -- all categories (primary + alternate)
  address      text,
  locality     text,
  region       text,
  postcode     text,
  lat          numeric,
  lng          numeric,
  website      text,                           -- primary website (enrichment key)
  websites     jsonb,                          -- all website urls
  socials      jsonb,                          -- instagram/facebook/...
  phone        text,
  confidence   numeric,                        -- Overture confidence
  website_live boolean,                        -- Stage 2 validation (null = unchecked)
  status       text not null default 'candidate', -- candidate|fetched|extracted|landed|rejected
  reject_reason text,
  gym_id       uuid references public.gyms(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists facility_candidates_metro_status_idx
  on public.facility_candidates (metro, status);

alter table public.facility_candidates enable row level security;
-- Staff-only SELECT; no write policy → deny-all for anon/authenticated. The
-- service-role loaders bypass RLS.
drop policy if exists "facility_candidates staff read" on public.facility_candidates;
create policy "facility_candidates staff read" on public.facility_candidates
  for select to authenticated using (public.is_staff());
