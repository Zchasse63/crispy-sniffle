-- Audit fix (MEDIUM): denormalized gym rating consistency relied entirely on a
-- best-effort client RPC after each review write, and the owner update/delete RLS
-- policies allow direct PostgREST mutations that refreshed nothing — leaving
-- gyms.rating / rating_count stale indefinitely. Make it self-healing with a DB
-- trigger so every review insert/hide/rating-change/delete recomputes the gym's
-- rating server-side (the client call becomes a harmless no-op backstop).
create or replace function public.gym_reviews_refresh_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- refresh_gym_rating writes only public.gyms, so this does not re-enter this trigger.
  perform public.refresh_gym_rating(coalesce(new.gym_id, old.gym_id));
  return null;
end;
$$;

drop trigger if exists gym_reviews_rating_sync on public.gym_reviews;
create trigger gym_reviews_rating_sync
  after insert or delete or update of rating, hidden on public.gym_reviews
  for each row execute function public.gym_reviews_refresh_rating();
