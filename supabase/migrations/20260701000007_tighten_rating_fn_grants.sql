-- Least-privilege hardening (advisor 0028/0029): functions are EXECUTE-to-PUBLIC
-- by default, which exposed these via /rest/v1/rpc to anon. Revoke PUBLIC:
--  * gym_reviews_refresh_rating() is a TRIGGER function — never call it via RPC
--    (the trigger fires regardless of grants).
--  * refresh_gym_rating() / report_review() are only invoked by signed-in users
--    (posting/reporting requires auth) and now also server-side by the trigger;
--    authenticated keeps its explicit grant, anon loses the implicit one.
revoke execute on function public.gym_reviews_refresh_rating() from public;
revoke execute on function public.refresh_gym_rating(uuid) from public;
revoke execute on function public.report_review(uuid) from public;
