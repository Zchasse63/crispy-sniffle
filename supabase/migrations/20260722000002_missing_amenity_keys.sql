-- P1#4: 9 amenity keys exist in scout.ts / synonyms / ai-search prompt but were
-- never inserted into public.amenities. Filters referencing them can never match
-- gym_amenities rows (FK). Labels mirror AMENITY_LABELS in src/lib/types/scout.ts.
insert into public.amenities (key, label, category, sort_order) values
  ('chalk_allowed',          'Chalk Allowed',          'strength',  20),
  ('wheelchair_accessible',  'Wheelchair Accessible',  'facility',  90),
  ('accessible_restrooms',   'Accessible Restrooms',   'facility', 100),
  ('hydromassage',           'Hydromassage',           'recovery',  60),
  ('open_gym',               'Open Gym Access',        'facility', 110),
  ('props_provided',         'Props Provided',         'class',     30),
  ('retail_shop',            'Retail / Pro Shop',      'facility', 120),
  ('spin_studio',            'Cycling Studio',         'class',     40),
  ('tanning',                'Tanning',                'facility', 130)
on conflict (key) do nothing;
