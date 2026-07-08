-- Preserve seeded web ratings permanently. Previously the seed lived ONLY in
-- gyms.rating: the first Scout review overwrote it in place + flipped
-- rating_is_seed=false, so a later delete of that review (zero visible reviews)
-- nulled the rating with no way back — one account could destroy a seed catalog-
-- wide (post-review-then-delete). Give the seed its own column so refresh can
-- RESTORE it when reviews reach zero rather than destroy it.
alter table public.gyms add column if not exists seed_rating numeric;
alter table public.gyms add column if not exists seed_rating_count integer;

-- Preserve any currently-seeded rating (none exist today, but idempotent + safe).
update public.gyms
  set seed_rating = rating, seed_rating_count = rating_count
  where rating_is_seed = true and seed_rating is null;

create or replace function public.refresh_gym_rating(gym_uuid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_avg   numeric;
begin
  select count(*), round(avg(rating)::numeric, 2)
    into v_count, v_avg
  from public.gym_reviews
  where gym_id = gym_uuid and hidden = false;

  if v_count > 0 then
    -- Visible Scout reviews win; the seed stays preserved in seed_rating.
    update public.gyms
    set rating = v_avg, rating_count = v_count, rating_is_seed = false, updated_at = now()
    where id = gym_uuid;
  else
    -- No visible reviews: restore the preserved seed if we have one, else clear.
    -- Never destroys the seed — it lives in seed_rating.
    update public.gyms
    set rating = seed_rating,
        rating_count = coalesce(seed_rating_count, 0),
        rating_is_seed = (seed_rating is not null),
        updated_at = now()
    where id = gym_uuid;
  end if;
end;
$$;
