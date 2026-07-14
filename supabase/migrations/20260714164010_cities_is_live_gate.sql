-- Gate which metros are publicly browsable. The cities table already holds 10
-- rows, 8 of which are placeholder metros with 1-3 seed gyms — a city switcher
-- built from fetchCities() would expose them. Tampa goes live now; Miami flips
-- only after its dedicated enrichment pass (decision log, world-class plan).
alter table public.cities add column is_live boolean not null default false;
update public.cities set is_live = true where slug = 'tampa';
