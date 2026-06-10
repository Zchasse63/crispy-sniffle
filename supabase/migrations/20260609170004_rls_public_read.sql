-- Beta security model: anonymous public READ on catalog data; zero client writes.
alter table public.cities         enable row level security;
alter table public.gyms           enable row level security;
alter table public.amenities      enable row level security;
alter table public.gym_amenities  enable row level security;
alter table public.gym_equipment  enable row level security;

create policy "public read cities"
  on public.cities for select to anon, authenticated using (true);
create policy "public read gyms"
  on public.gyms for select to anon, authenticated using (true);
create policy "public read amenities"
  on public.amenities for select to anon, authenticated using (true);
create policy "public read gym_amenities"
  on public.gym_amenities for select to anon, authenticated using (true);
create policy "public read gym_equipment"
  on public.gym_equipment for select to anon, authenticated using (true);
