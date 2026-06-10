-- Cities: launch markets with data tiers (rich = full Scout dataset, basic = limited)
create table public.cities (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  state       text not null,
  lat         numeric(9,6) not null,
  lng         numeric(9,6) not null,
  tier        text not null default 'basic' check (tier in ('rich', 'basic')),
  created_at  timestamptz not null default now()
);
comment on column public.cities.tier is 'rich = full Scout dataset; basic = limited data, honestly labeled in UI';

create type public.gym_segment as enum (
  'strength', 'crossfit', 'big_box', 'boutique',
  'climbing', 'yoga_pilates', 'mma', 'recovery'
);

create table public.gyms (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  city_id         uuid not null references public.cities(id),
  name            text not null,
  neighborhood    text,
  address         text,
  lat             numeric(9,6),
  lng             numeric(9,6),
  location        extensions.geography(point, 4326),
  description     text,
  segment         public.gym_segment,
  day_pass_price  numeric(6,2),
  week_pass_price numeric(6,2),
  hours           jsonb,
  website         text,
  phone           text,
  photo_url       text,
  rating          numeric(3,2),
  rating_count    integer not null default 0,
  verified        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on column public.gyms.hours is '{"open_24h": bool, "mon": ["06:00","22:00"], ...} — null entries mean unknown';

create index gyms_city_idx on public.gyms(city_id);
create index gyms_location_idx on public.gyms using gist(location);
create index gyms_segment_idx on public.gyms(segment);

create or replace function public.gyms_set_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := extensions.st_setsrid(
      extensions.st_makepoint(new.lng::float8, new.lat::float8), 4326
    )::extensions.geography;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger gyms_location_trigger
  before insert or update on public.gyms
  for each row execute function public.gyms_set_location();
