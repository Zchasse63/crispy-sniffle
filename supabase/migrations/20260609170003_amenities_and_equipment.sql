create table public.amenities (
  key         text primary key,
  label       text not null,
  category    text not null check (category in ('strength','cardio','recovery','facility','hours','class')),
  sort_order  integer not null default 0
);

insert into public.amenities (key, label, category, sort_order) values
  ('sauna',             'Sauna',             'recovery', 10),
  ('cold_plunge',       'Cold Plunge',       'recovery', 20),
  ('steam_room',        'Steam Room',        'recovery', 30),
  ('pool',              'Pool',              'recovery', 40),
  ('recovery_room',     'Recovery Room',     'recovery', 50),
  ('open_24h',          '24-Hour Access',    'hours',    10),
  ('classes',           'Group Classes',     'class',    10),
  ('personal_training', 'Personal Training', 'class',    20),
  ('turf_area',         'Turf Area',         'strength', 10),
  ('cardio_zone',       'Cardio Zone',       'cardio',   10),
  ('basketball_court',  'Basketball Court',  'facility',  5),
  ('day_pass',          'Day Passes',        'facility', 10),
  ('parking',           'Parking',           'facility', 20),
  ('lockers',           'Locker Rooms',      'facility', 30),
  ('showers',           'Showers',           'facility', 40),
  ('towel_service',     'Towel Service',     'facility', 50),
  ('wifi',              'Wi-Fi',             'facility', 60),
  ('juice_bar',         'Juice Bar',         'facility', 70),
  ('childcare',         'Childcare',         'facility', 80);

create table public.gym_amenities (
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  amenity_key text not null references public.amenities(key),
  present     boolean not null default true,
  source      text not null default 'seed'
              check (source in ('owner','scout_verified','user','scraped','seed','estimated')),
  confidence  numeric(3,2) not null default 0.5 check (confidence between 0 and 1),
  detail      text,
  updated_at  timestamptz not null default now(),
  primary key (gym_id, amenity_key)
);
create index gym_amenities_key_idx on public.gym_amenities(amenity_key);

create type public.equipment_key as enum (
  'squat_rack', 'power_rack', 'platform',
  'dumbbells', 'barbells', 'kettlebells',
  'ghd', 'sled', 'ski_erg', 'assault_bike', 'rower',
  'reverse_hyper', 'belt_squat', 'comp_bench',
  'cable_machine', 'leg_press', 'smith_machine', 'hack_squat',
  'pull_up_bar', 'dip_station', 'monolift', 'climbing_wall'
);

create table public.gym_equipment (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  equipment_key   public.equipment_key not null,
  brand           text,
  quantity        integer,
  max_weight_lbs  integer,
  source          text not null default 'seed'
                  check (source in ('owner','scout_verified','user','scraped','seed','estimated')),
  confidence      numeric(3,2) not null default 0.5 check (confidence between 0 and 1),
  detail          text,
  created_at      timestamptz not null default now()
);
create index gym_equipment_gym_idx on public.gym_equipment(gym_id);
create unique index gym_equipment_key_unique on public.gym_equipment(gym_id, equipment_key);
