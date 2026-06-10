-- R8: first client writes — profiles, visits, reviews(+photos), fact
-- confirmations, follows, cloud trips, community links. RLS: owner-only
-- writes via auth.uid(); public reads only where the surface demands it.
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text check (char_length(display_name) <= 40),
  training_prefs  jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "owner read profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "owner insert profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "owner update profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.gym_visits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  visited_on  date not null,
  note        text check (char_length(note) <= 280),
  created_at  timestamptz not null default now()
);
create index gym_visits_user_idx on public.gym_visits(user_id);
create index gym_visits_gym_idx on public.gym_visits(gym_id);
alter table public.gym_visits enable row level security;
create policy "owner all visits" on public.gym_visits for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.gym_reviews (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (char_length(comment) <= 1000),
  visit_context text check (visit_context in ('member','day_pass','drop_in','class','trial')),
  report_count  integer not null default 0,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (gym_id, user_id)
);
create index gym_reviews_gym_idx on public.gym_reviews(gym_id);
alter table public.gym_reviews enable row level security;
create policy "public read visible reviews" on public.gym_reviews for select to anon, authenticated using (hidden = false);
create policy "owner read own reviews" on public.gym_reviews for select to authenticated using (auth.uid() = user_id);
create policy "owner insert review" on public.gym_reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "owner update review" on public.gym_reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner delete review" on public.gym_reviews for delete to authenticated using (auth.uid() = user_id);

create table public.review_photos (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.gym_reviews(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
create index review_photos_review_idx on public.review_photos(review_id);
alter table public.review_photos enable row level security;
create policy "public read review_photos" on public.review_photos for select to anon, authenticated using (true);
create policy "owner insert review_photo" on public.review_photos for insert to authenticated with check (auth.uid() = user_id);
create policy "owner delete review_photo" on public.review_photos for delete to authenticated using (auth.uid() = user_id);

-- staging suggestions at the 'user' tier; promotion to catalog tables is a
-- future moderated flow. NO anon read (who-confirmed-what stays private);
-- public counts come from the security-definer function below.
create table public.fact_confirmations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  fact_type       text not null check (fact_type in ('amenity','equipment','price','hours')),
  fact_key        text not null,
  verdict         text not null check (verdict in ('confirm','correct')),
  corrected_value text check (char_length(corrected_value) <= 120),
  note            text check (char_length(note) <= 280),
  created_at      timestamptz not null default now(),
  unique (user_id, gym_id, fact_type, fact_key)
);
create index fact_confirmations_gym_idx on public.fact_confirmations(gym_id);
alter table public.fact_confirmations enable row level security;
create policy "owner all confirmations" on public.fact_confirmations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.confirmation_counts(gym uuid)
returns table (fact_type text, fact_key text, confirms bigint, corrects bigint)
language sql security definer set search_path = ''
as $$
  select fact_type, fact_key,
         count(*) filter (where verdict = 'confirm'),
         count(*) filter (where verdict = 'correct')
  from public.fact_confirmations where gym_id = gym
  group by fact_type, fact_key;
$$;
grant execute on function public.confirmation_counts(uuid) to anon, authenticated;

create table public.followed_gyms (
  user_id     uuid not null references auth.users(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  alert_email boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (user_id, gym_id)
);
alter table public.followed_gyms enable row level security;
create policy "owner all followed" on public.followed_gyms for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.cloud_trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  city_slug   text not null,
  city_name   text not null,
  start_date  date not null,
  end_date    date not null,
  lodging     jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, city_slug, start_date, end_date)
);
create index cloud_trips_user_idx on public.cloud_trips(user_id);
alter table public.cloud_trips enable row level security;
create policy "owner all trips" on public.cloud_trips for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.community_links (
  id         uuid primary key default gen_random_uuid(),
  gym_slug   text not null,
  url        text not null,
  title      text not null,
  platform   text not null default 'reddit' check (platform in ('reddit','forum','blog','other')),
  year       integer,
  topic_note text,
  created_at timestamptz not null default now(),
  unique (gym_slug, url)
);
create index community_links_slug_idx on public.community_links(gym_slug);
alter table public.community_links enable row level security;
create policy "public read community_links" on public.community_links for select to anon, authenticated using (true);

create or replace function public.report_review(review_uuid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.gym_reviews
  set report_count = report_count + 1,
      hidden = case when report_count + 1 >= 3 then true else hidden end,
      updated_at = now()
  where id = review_uuid;
end;
$$;
grant execute on function public.report_review(uuid) to authenticated;

create or replace function public.refresh_gym_rating(gym_uuid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.gyms
  set rating = (select round(avg(rating)::numeric, 2) from public.gym_reviews where gym_id = gym_uuid and hidden = false),
      rating_count = (select count(*) from public.gym_reviews where gym_id = gym_uuid and hidden = false),
      updated_at = now()
  where id = gym_uuid;
end;
$$;
grant execute on function public.refresh_gym_rating(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- review photo storage (owner-prefix writes, public reads, 5MB images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "owner upload review photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner delete review photo" on storage.objects for delete to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public read review photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'review-photos');
