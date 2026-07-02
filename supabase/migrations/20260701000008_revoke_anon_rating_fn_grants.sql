-- 20260701000007 revoked only PUBLIC, but Supabase default privileges ALSO grant
-- EXECUTE to anon/authenticated explicitly at function-creation time, so anon
-- retained access. Revoke the explicit grants. authenticated keeps execute on the
-- two RPCs it legitimately calls; the trigger function is revoked from both roles
-- (it only ever runs inside the trigger, as the table owner).
revoke execute on function public.refresh_gym_rating(uuid) from anon;
revoke execute on function public.report_review(uuid) from anon;
revoke execute on function public.gym_reviews_refresh_rating() from anon, authenticated;
