-- R6: decision intelligence — how to actually get in, what membership
-- costs, and how to arrive without a car.
alter table public.gyms
  add column drop_in_policy text
    check (drop_in_policy in ('walk_in','book_first','restricted','trial_route','membership_only')),
  add column drop_in_note text,
  add column monthly_from numeric(6,2) check (monthly_from > 0),
  add column monthly_note text;

-- bike racks + transit stops near each gym (OSM, same pattern as gym_parking)
create table public.gym_transit (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  kind        text not null check (kind in ('bike_rack','bus_stop','rail_station')),
  name        text,
  distance_m  integer check (distance_m >= 0),
  lat         numeric(9,6),
  lng         numeric(9,6),
  source      text not null default 'osm'
              check (source in ('owner','scout_verified','user','scraped','seed','estimated','osm','city_data')),
  confidence  numeric(3,2) not null default 0.6 check (confidence between 0 and 1),
  detail      text,
  created_at  timestamptz not null default now()
);
create index gym_transit_gym_idx on public.gym_transit(gym_id);
alter table public.gym_transit enable row level security;
create policy "public read gym_transit"
  on public.gym_transit for select to anon, authenticated using (true);
