-- WP-A: gym-local open/closed evaluation needs each city's IANA timezone.
-- Without it, the server hero evaluates hours on the Netlify UTC clock and
-- clients on the viewer's clock (never the gym's), so open/closed is wrong.
alter table public.cities
  add column timezone text not null default 'America/New_York';

-- Backfill the four US zones the current + placeholder cities span.
update public.cities set timezone = 'America/Chicago'     where slug = 'dallas';
update public.cities set timezone = 'America/Phoenix'     where slug = 'phoenix';
update public.cities set timezone = 'America/Los_Angeles' where slug = 'sf-bay';
-- tampa, miami, new-york, atlanta, boston, washington-dc, palm-beach = America/New_York (default)
