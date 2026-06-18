-- Source CHECK on gym_amenities/gym_equipment was missing osm + city_data,
-- drifting from gym_parking/gym_transit and scout.ts ProvenanceSource.
alter table public.gym_amenities drop constraint gym_amenities_source_check,
  add constraint gym_amenities_source_check
  check (source = any (array['owner','scout_verified','user','scraped','seed','estimated','osm','city_data']::text[]));
alter table public.gym_equipment drop constraint gym_equipment_source_check,
  add constraint gym_equipment_source_check
  check (source = any (array['owner','scout_verified','user','scraped','seed','estimated','osm','city_data']::text[]));
