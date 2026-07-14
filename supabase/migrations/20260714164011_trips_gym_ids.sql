-- Trip-scoped gym shortlist. Array, not a join table: ALL trip sync matches
-- the (user_id, city_slug, start_date, end_date) tuple, never the row id, so
-- local vs cloud row ids legitimately diverge — a join table keyed on
-- cloud_trips.id would silently orphan rows across that divergence.
alter table public.cloud_trips add column gym_ids uuid[] not null default '{}';
