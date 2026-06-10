-- Women's-only facilities/areas (user-flagged trend; data via next research pass)
insert into public.amenities (key, label, category, sort_order) values
  ('womens_area', 'Women''s-Only Area', 'facility', 167),
  ('womens_only', 'Women''s-Only Gym', 'facility', 168)
on conflict (key) do nothing;
