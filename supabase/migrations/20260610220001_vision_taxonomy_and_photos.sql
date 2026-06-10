-- R7: machine-granularity equipment (premium 'Pro preview' surface),
-- cafe/coworking amenities, tagged facility photos.
alter type public.equipment_key add value if not exists 'hip_thrust';
alter type public.equipment_key add value if not exists 'leg_extension';
alter type public.equipment_key add value if not exists 'leg_curl';
alter type public.equipment_key add value if not exists 'abductor_adductor';
alter type public.equipment_key add value if not exists 'calf_machine';

insert into public.amenities (key, label, category, sort_order) values
  ('cafe', 'Café', 'facility', 165),
  ('coworking_space', 'Co-working Space', 'facility', 166)
on conflict (key) do nothing;

create table public.gym_photos (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  url         text not null,
  subject     text check (subject in ('gym_floor','equipment','exterior','parking','lounge_cafe','sauna_recovery','other')),
  source      text not null default 'scraped'
              check (source in ('owner','scout_verified','user','scraped','seed','estimated')),
  created_at  timestamptz not null default now(),
  unique (gym_id, url)
);
create index gym_photos_gym_idx on public.gym_photos(gym_id);
alter table public.gym_photos enable row level security;
create policy "public read gym_photos"
  on public.gym_photos for select to anon, authenticated using (true);
