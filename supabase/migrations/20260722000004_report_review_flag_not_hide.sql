-- P2: review auto-hide → staff flag. Three throwaway accounts could hide a
-- legit review with no staff loop. report_review still increments
-- report_count (and the admin moderation surface already lists/sorts by
-- report_count), but no longer sets hidden=true automatically. Staff hide
-- via the existing admin moderation actions.
--
-- Rating-aggregate trigger behavior is unchanged: refresh_gym_rating only
-- runs when a review is actually hidden (staff action), not on report.

create or replace function public.report_review(review_uuid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reporter uuid := auth.uid();
  v_gym_id   uuid;
  v_distinct integer;
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

  -- Flag for staff: bump report_count only. Do NOT auto-hide.
  update public.gym_reviews
  set report_count = v_distinct,
      updated_at = now()
  where id = review_uuid
  returning gym_id into v_gym_id;

  if v_gym_id is null then
    return; -- review no longer exists
  end if;

  -- No refresh_gym_rating here: the review stays visible until staff hide it.
end;
$$;
