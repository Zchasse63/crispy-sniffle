-- Audit fixes (Cluster A) — community-review moderation + rating integrity.
--
-- Confirmed defects addressed here:
--  * (HIGH) The original permissive "owner update review" policy let a review's
--    author UPDATE any column, including hidden/report_count/moderated_*, so a
--    banned/brigaded user could silently reverse every moderation action.
--  * (HIGH) refresh_gym_rating() nulled a gym's SEEDED web rating whenever the
--    gym had zero visible reviews, and flipped rating_is_seed=false — callable by
--    any authenticated user, so seeded ratings could be wiped catalog-wide.
--  * (HIGH) report_review() had no per-reporter dedup, so a single account could
--    hide any review with 3 calls (and, via the above, null the gym rating).
--  * (LOW) is_banned(uuid) was granted to anon, letting unauthenticated callers
--    enumerate the ban status of harvested reviewer ids.
--  * (LOW) has_min_role(text) returned TRUE for any authenticated caller when
--    min_role was outside the four-role ladder (fail-open).

-- 1) Make the review moderation columns writable ONLY by the service role and the
--    SECURITY DEFINER RPCs — never by a review's own author via PostgREST. RLS
--    with-check cannot compare OLD/NEW, so enforce this with a BEFORE UPDATE
--    trigger. The trigger allows the change when the effective role is not a
--    client role (SECURITY DEFINER functions run as their owner; the admin routes
--    use the service_role), and blocks it for anon/authenticated PostgREST writes.
create or replace function public.guard_review_moderation_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.hidden           is distinct from old.hidden
    or new.report_count     is distinct from old.report_count
    or new.moderated_by     is distinct from old.moderated_by
    or new.moderated_at     is distinct from old.moderated_at
    or new.moderation_reason is distinct from old.moderation_reason then
      raise exception 'gym_reviews moderation columns are read-only for clients';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists gym_reviews_guard_moderation on public.gym_reviews;
create trigger gym_reviews_guard_moderation
  before update on public.gym_reviews
  for each row execute function public.guard_review_moderation_columns();

-- 2) Per-reporter report dedup. report_count is now the count of DISTINCT
--    reporters; one account can no longer inflate it. The table is written only
--    by report_review() (SECURITY DEFINER) — no client policies.
create table if not exists public.review_reports (
  review_id   uuid not null references public.gym_reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (review_id, reporter_id)
);
alter table public.review_reports enable row level security;
-- (no policies: only the security-definer report_review() reads/writes it)

create or replace function public.report_review(review_uuid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reporter uuid := auth.uid();
  v_gym_id   uuid;
  v_distinct integer;
  v_hidden   boolean;
begin
  if v_reporter is null then
    raise exception 'authentication required to report a review';
  end if;

  -- Record this reporter once. A repeat report by the same account is a no-op:
  -- it must neither re-count nor re-hide.
  insert into public.review_reports (review_id, reporter_id)
  values (review_uuid, v_reporter)
  on conflict (review_id, reporter_id) do nothing;
  if not found then
    return;
  end if;

  select count(*) into v_distinct
  from public.review_reports where review_id = review_uuid;

  update public.gym_reviews
  set report_count = v_distinct,
      hidden = case when v_distinct >= 3 then true else hidden end,
      updated_at = now()
  where id = review_uuid
  returning gym_id, hidden into v_gym_id, v_hidden;

  if v_gym_id is null then
    return; -- review no longer exists
  end if;

  -- Once a review is auto-hidden, drop it from the gym's average.
  if v_hidden then
    perform public.refresh_gym_rating(v_gym_id);
  end if;
end;
$$;

-- 3) refresh_gym_rating: never destroy a seeded web rating. When there are
--    visible Scout reviews they become the first-party rating; when there are
--    none, preserve an existing seed and only clear a first-party rating that has
--    lost all its reviews.
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
    update public.gyms
    set rating = v_avg,
        rating_count = v_count,
        rating_is_seed = false,
        updated_at = now()
    where id = gym_uuid;
  else
    update public.gyms
    set rating = case when rating_is_seed then rating else null end,
        rating_count = case when rating_is_seed then rating_count else 0 end,
        updated_at = now()
    where id = gym_uuid;
  end if;
end;
$$;

-- 4) is_banned is only needed by the authenticated-only insert policy; anon has
--    no legitimate use for it and could enumerate ban status. Functions are
--    EXECUTE-to-PUBLIC by default, so revoking anon alone leaves the implicit
--    PUBLIC grant intact — revoke PUBLIC too (authenticated keeps its own grant).
revoke execute on function public.is_banned(uuid) from public, anon;

-- 5) has_min_role: fail closed on an unrecognized min_role rather than TRUE.
create or replace function public.has_min_role(min_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when min_role not in ('owner', 'admin', 'reviewer', 'viewer') then false
    else
      (case (select role from public.staff_members where user_id = auth.uid())
        when 'owner' then 4 when 'admin' then 3 when 'reviewer' then 2 when 'viewer' then 1 else 0 end)
      >=
      (case min_role
        when 'owner' then 4 when 'admin' then 3 when 'reviewer' then 2 when 'viewer' then 1 else 0 end)
  end;
$$;
