-- WP-F: three verified community/data-integrity security holes.

-- ── #4: review_photos cross-review attach ───────────────────────────────────
-- The insert policy only checked the photo row's own user_id, so a user could
-- attach a photo to SOMEONE ELSE's review (rendered as that reviewer's photo).
-- Require the referenced review to be owned by the inserting user.
drop policy if exists "owner insert review_photo" on public.review_photos;
create policy "owner insert review_photo" on public.review_photos for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.gym_reviews r
      where r.id = review_id and r.user_id = auth.uid()
    )
  );

-- ── #10: review gym_id / user_id must be immutable after insert ──────────────
-- A review author could PATCH gym_id to another gym; the rating trigger only
-- fires on rating/hidden changes, leaving gym A a ghost rating and gym B a
-- review missing from its aggregate. Freeze identity columns for client roles
-- by extending the existing moderation guard (trigger already attached).
create or replace function public.guard_review_moderation_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.hidden            is distinct from old.hidden
    or new.report_count      is distinct from old.report_count
    or new.moderated_by      is distinct from old.moderated_by
    or new.moderated_at      is distinct from old.moderated_at
    or new.moderation_reason is distinct from old.moderation_reason
    or new.gym_id            is distinct from old.gym_id
    or new.user_id           is distinct from old.user_id then
      raise exception 'gym_reviews moderation/identity columns are read-only for clients';
    end if;
  end if;
  return new;
end;
$$;

-- ── #9: fact_confirmations garbage-key inflation ────────────────────────────
-- fact_key was free text with no validation, so a signed-in user could script
-- thousands of confirmations for nonexistent facts and inflate the public
-- "N facts confirmed this week" counter. And last_confirmed_at rode a generic
-- updated_at that any row touch bumped. Fix: (a) a dedicated confirmed_at stamp,
-- (b) a security-definer RPC that validates the fact exists before writing,
-- (c) remove direct insert/update (route all writes through the RPC),
-- (d) counts use confirmed_at and only sum confirmations for real catalog facts.
alter table public.fact_confirmations add column if not exists confirmed_at timestamptz;
update public.fact_confirmations set confirmed_at = updated_at
  where verdict = 'confirm' and confirmed_at is null;

create or replace function public.confirm_fact(
  p_gym uuid,
  p_fact_type text,
  p_fact_key text,
  p_verdict text,
  p_corrected_value text default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_exists boolean;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_verdict not in ('confirm','correct') then raise exception 'invalid verdict'; end if;
  if p_fact_type not in ('amenity','equipment','price','hours') then raise exception 'invalid fact_type'; end if;

  -- The (gym, fact_type, fact_key) must reference a REAL current fact — a
  -- confirmation for a nonexistent fact is meaningless and must never inflate
  -- a public counter (never-fabricate).
  v_exists := case p_fact_type
    when 'amenity'   then exists (select 1 from public.gym_amenities a  where a.gym_id = p_gym and a.amenity_key::text   = p_fact_key)
    when 'equipment' then exists (select 1 from public.gym_equipment e where e.gym_id = p_gym and e.equipment_key::text = p_fact_key)
    when 'price'     then (p_fact_key = 'day_pass' and exists (select 1 from public.gyms g where g.id = p_gym and g.day_pass_price is not null))
    when 'hours'     then (p_fact_key = 'hours'    and exists (select 1 from public.gyms g where g.id = p_gym and g.hours is not null))
    else false
  end;
  if not v_exists then raise exception 'no such fact to confirm: % / %', p_fact_type, p_fact_key; end if;

  insert into public.fact_confirmations
    (user_id, gym_id, fact_type, fact_key, verdict, corrected_value, note, confirmed_at)
  values (
    v_user, p_gym, p_fact_type, p_fact_key, p_verdict,
    case when p_verdict = 'correct' then left(p_corrected_value, 120) else null end,
    left(p_note, 280),
    case when p_verdict = 'confirm' then now() else null end
  )
  on conflict (user_id, gym_id, fact_type, fact_key) do update
    set verdict = excluded.verdict,
        corrected_value = excluded.corrected_value,
        note = excluded.note,
        confirmed_at = case when excluded.verdict = 'confirm' then now() else null end;
end;
$$;
revoke execute on function public.confirm_fact(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.confirm_fact(uuid,text,text,text,text,text) to authenticated;

-- Direct writes no longer allowed — only the validating RPC may insert/update.
-- Users keep read + delete on their own rows.
drop policy if exists "owner all confirmations" on public.fact_confirmations;
create policy "owner read confirmations" on public.fact_confirmations for select to authenticated
  using (auth.uid() = user_id);
create policy "owner delete confirmations" on public.fact_confirmations for delete to authenticated
  using (auth.uid() = user_id);

drop function if exists public.confirmation_counts(uuid);
create function public.confirmation_counts(gym uuid)
returns table (
  fact_type text, fact_key text, confirms bigint, corrects bigint,
  last_confirmed_at timestamptz, confirms_7d bigint
)
language sql security definer set search_path = public as $$
  select
    fc.fact_type, fc.fact_key,
    count(*) filter (where fc.verdict = 'confirm') as confirms,
    count(*) filter (where fc.verdict = 'correct') as corrects,
    max(fc.confirmed_at) filter (where fc.verdict = 'confirm') as last_confirmed_at,
    count(*) filter (where fc.verdict = 'confirm' and fc.confirmed_at > now() - interval '7 days') as confirms_7d
  from public.fact_confirmations fc
  where fc.gym_id = gym
    and (
      (fc.fact_type = 'amenity'   and exists (select 1 from public.gym_amenities a  where a.gym_id = fc.gym_id and a.amenity_key::text   = fc.fact_key))
      or (fc.fact_type = 'equipment' and exists (select 1 from public.gym_equipment e where e.gym_id = fc.gym_id and e.equipment_key::text = fc.fact_key))
      or (fc.fact_type = 'price'    and fc.fact_key = 'day_pass' and exists (select 1 from public.gyms g where g.id = fc.gym_id and g.day_pass_price is not null))
      or (fc.fact_type = 'hours'    and fc.fact_key = 'hours'    and exists (select 1 from public.gyms g where g.id = fc.gym_id and g.hours is not null))
    )
  group by fc.fact_type, fc.fact_key
$$;
grant execute on function public.confirmation_counts(uuid) to anon, authenticated;
