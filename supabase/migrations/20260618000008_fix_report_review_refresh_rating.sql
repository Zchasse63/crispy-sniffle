-- Bug: report_review() auto-hid a review at >=3 reports but never recomputed
-- the gym's rating, so a brigaded/hidden review kept polluting the average.
-- refresh_gym_rating() already excludes hidden reviews — it just wasn't called.
create or replace function public.report_review(review_uuid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_gym_id uuid;
  v_hidden boolean;
begin
  update public.gym_reviews
  set report_count = report_count + 1,
      hidden = case when report_count + 1 >= 3 then true else hidden end,
      updated_at = now()
  where id = review_uuid
  returning gym_id, hidden into v_gym_id, v_hidden;

  -- once a review is hidden, recompute the gym's rating to drop it from the
  -- average (refresh_gym_rating filters hidden = false).
  if v_hidden then
    perform public.refresh_gym_rating(v_gym_id);
  end if;
end;
$$;
