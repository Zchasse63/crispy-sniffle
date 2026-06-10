-- Ratings honesty: seeded web ratings must not masquerade as Scout reviews.
alter table public.gyms add column rating_is_seed boolean not null default true;

create or replace function public.refresh_gym_rating(gym_uuid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.gyms
  set rating = (select round(avg(rating)::numeric, 2) from public.gym_reviews where gym_id = gym_uuid and hidden = false),
      rating_count = (select count(*) from public.gym_reviews where gym_id = gym_uuid and hidden = false),
      rating_is_seed = false,
      updated_at = now()
  where id = gym_uuid;
end;
$$;
