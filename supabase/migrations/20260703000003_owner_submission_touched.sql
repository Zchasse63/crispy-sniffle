-- needs_info re-edits silently dropped every round-1 "confirmed" fact: the touched
-- set was never persisted, so a round-2 resubmit started touched empty and
-- parseSubmission's differs-or-touched gate skipped every baseline-equal answer the
-- owner had explicitly attested. Persist the touched set on the submission and hand
-- it back through the context RPC so the re-edit re-derives ALL facts.
alter table public.owner_submissions add column if not exists touched jsonb not null default '[]'::jsonb;

-- RETURNS TABLE gains a column → must drop before recreate.
drop function if exists public.resolve_owner_invite_context(text);
create function public.resolve_owner_invite_context(p_token_hash text)
returns table(gym_id uuid, submission_id uuid, review_note text, prior_answers jsonb, prior_touched jsonb)
language sql stable security definer set search_path = '' as $$
  select i.gym_id,
         case when s.status = 'needs_info' then s.id end,
         case when s.status = 'needs_info' then s.review_note end,
         case when s.status = 'needs_info' then s.raw_answers end,
         case when s.status = 'needs_info' then s.touched end
  from public.owner_invites i
  left join public.owner_submissions s on s.id = i.submission_id and s.gym_id = i.gym_id
  where i.token_hash = p_token_hash
    and i.status = 'active'
    and (i.expires_at is null or i.expires_at > now())
  limit 1;
$$;
grant execute on function public.resolve_owner_invite_context(text) to anon, authenticated;
