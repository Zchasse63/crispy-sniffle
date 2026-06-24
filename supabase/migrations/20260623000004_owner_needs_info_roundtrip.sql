-- needs_info round-trip: let staff send a submission back to the owner for edits.
-- Adds a revision counter + a needs_info timestamp, and a context resolver RPC so
-- the public /own page can re-open with the owner's PRIOR answers + the staff note.
-- The invite token is the gate; the RPC is security-definer + scoped to the
-- matching ACTIVE invite, so RLS deny-by-default stays intact.
alter table public.owner_submissions add column if not exists revision int not null default 1;
alter table public.owner_submissions add column if not exists needs_info_at timestamptz;

create or replace function public.resolve_owner_invite_context(p_token_hash text)
returns table(gym_id uuid, submission_id uuid, review_note text, prior_answers jsonb)
language sql stable security definer set search_path = '' as $$
  select i.gym_id,
         case when s.status = 'needs_info' then s.id end,
         case when s.status = 'needs_info' then s.review_note end,
         case when s.status = 'needs_info' then s.raw_answers end
  from public.owner_invites i
  left join public.owner_submissions s on s.id = i.submission_id and s.gym_id = i.gym_id
  where i.token_hash = p_token_hash
    and i.status = 'active'
    and (i.expires_at is null or i.expires_at > now())
  limit 1;
$$;
grant execute on function public.resolve_owner_invite_context(text) to anon, authenticated;
