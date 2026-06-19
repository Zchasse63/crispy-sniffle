-- Anon-callable resolver so the public /own/[token] page never needs the
-- service-role key. Returns the gym_id for a valid active, non-expired invite.
create or replace function public.resolve_owner_invite(p_token_hash text)
returns uuid language sql stable security definer set search_path = '' as $$
  select gym_id from public.owner_invites
  where token_hash = p_token_hash
    and status = 'active'
    and (expires_at is null or expires_at > now())
  limit 1;
$$;
grant execute on function public.resolve_owner_invite(text) to anon, authenticated;
