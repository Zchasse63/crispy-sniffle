-- Parking intelligence: structured per-gym parking options.
-- Sources: gym-stated text (scraped), OpenStreetMap Overpass (osm),
-- Tampa open data (city_data), strip-plaza inference (estimated).
-- gym_amenities.parking stays the boolean filter surface; the pipeline
-- script keeps it in sync (no trigger).
create table public.gym_parking (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  kind         text not null
               check (kind in (
                 'onsite_lot', 'onsite_garage',
                 'nearby_lot', 'nearby_garage',
                 'street', 'valet'
               )),
  name         text,
  distance_m   integer check (distance_m >= 0),
  access       text not null default 'unknown'
               check (access in ('free','customers','validated','paid','permit','unknown')),
  fee_detail   text,
  capacity     integer check (capacity > 0),
  lat          numeric(9,6),
  lng          numeric(9,6),
  is_primary   boolean not null default false,
  source       text not null default 'seed'
               check (source in ('owner','scout_verified','user','scraped','seed','estimated','osm','city_data')),
  confidence   numeric(3,2) not null default 0.5 check (confidence between 0 and 1),
  detail       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index gym_parking_gym_idx on public.gym_parking(gym_id);
create index gym_parking_primary_idx on public.gym_parking(gym_id, is_primary)
  where is_primary = true;

alter table public.gym_parking enable row level security;
create policy "public read gym_parking"
  on public.gym_parking for select to anon, authenticated using (true);
