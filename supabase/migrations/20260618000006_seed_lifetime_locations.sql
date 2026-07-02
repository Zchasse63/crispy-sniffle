-- Premium Life Time clubs (research: docs/research/lifetime-research.md).
-- All luxury segment. tier/enrollment/exact-dues are never public → left null
-- (never-fabricate). monthly_from = published "starting at" floor; day_pass only
-- where page-verified. New metros seeded as 'basic' tier.

-- 1) metro cities (basic tier) for the LT expansion footprint
insert into public.cities (slug, name, state, lat, lng, tier) values
  ('palm-beach', 'Palm Beach', 'FL', 26.705, -80.085, 'basic'),
  ('atlanta', 'Atlanta', 'GA', 33.749, -84.388, 'basic'),
  ('dallas', 'Dallas', 'TX', 32.7767, -96.797, 'basic'),
  ('new-york', 'New York', 'NY', 40.7128, -74.006, 'basic'),
  ('phoenix', 'Phoenix', 'AZ', 33.448, -112.074, 'basic'),
  ('boston', 'Boston', 'MA', 42.3601, -71.0589, 'basic'),
  ('sf-bay', 'SF Bay Area', 'CA', 37.8, -122.27, 'basic'),
  ('washington-dc', 'Washington, DC', 'DC', 38.9072, -77.0369, 'basic')
on conflict (slug) do nothing;

-- 2) the 17 new clubs
insert into public.gyms
  (name, slug, city_id, segment, address, phone, monthly_from, day_pass_price,
   guest_policy_model, waitlist, drop_in_policy, members_guest_note, description,
   vibe_tags, vibe_source, rating_count, rating_is_seed, verified)
select v.name, v.slug, c.id, 'luxury', v.address, v.phone, v.monthly_from, v.day_pass,
   v.guest_model, v.waitlist, v.dropin,
   'Guest access via the Life Time app (member invite, photo ID, same guest once per 60 days); paid day pass where offered. Enrollment fee and exact dues are not public — confirm with the club.',
   'Life Time luxury athletic club — resort-style pools, 100-plus classes, LifeSpa and dining.',
   '{}', 'seed', 0, true, false
from (values
  ('Life Time Palm Beach Gardens','life-time-palm-beach-gardens','palm-beach','11825 Lake Victoria Gardens Ave, Palm Beach Gardens, FL 33410','561-352-2700',339::numeric,null::numeric,'member_invite_only',false,'restricted'),
  ('Life Time Boca Raton','life-time-boca-raton','palm-beach',null,'561-208-5900',329,null,'hybrid',false,'walk_in'),
  ('Life Time West Boca','life-time-west-boca','palm-beach','9698 Glades Rd, Boca Raton, FL 33434',null,null,null,'members_only_waitlist',true,'membership_only'),
  ('Life Time Buckhead','life-time-buckhead','atlanta','3470 Peachtree Rd NE, Atlanta, GA 30326','404-965-7540',299,75,'hybrid',false,'walk_in'),
  ('Life Time Sandy Springs','life-time-sandy-springs','atlanta','5600 Roswell Rd, Sandy Springs, GA 30342','678-832-2330',229,60,'hybrid',false,'walk_in'),
  ('Life Time Miami at The Falls','life-time-miami-the-falls','miami',null,null,339,null,'hybrid',false,'walk_in'),
  ('Life Time Coral Gables','life-time-coral-gables','miami',null,'786-437-4407',339,null,'member_invite_only',false,'restricted'),
  ('Life Time Las Colinas','life-time-las-colinas','dallas','Las Colinas, Irving, TX','214-231-5600',239,60,'public_day_pass',false,'walk_in'),
  ('Life Time Westlake','life-time-westlake','dallas','Westlake, TX',null,279,75,'hybrid',false,'walk_in'),
  ('Life Time Frisco','life-time-frisco','dallas',null,'469-476-3907',null,null,'member_invite_only',false,'restricted'),
  ('Life Time One Wall Street','life-time-one-wall-street','new-york','1 Wall St, New York, NY 10005',null,339,100,'public_day_pass',false,'walk_in'),
  ('Life Time Sky','life-time-sky-manhattan','new-york','605 W 42nd St, New York, NY 10036','646-601-7301',339,100,'hybrid',true,'walk_in'),
  ('Life Time PENN 1','life-time-penn-1','new-york','235 W 33rd St, New York, NY 10119','332-263-0901',339,100,'hybrid',true,'walk_in'),
  ('Life Time North Scottsdale','life-time-north-scottsdale','phoenix','6850 E Chauncey Ln, Phoenix, AZ 85054','480-538-3430',259,50,'hybrid',false,'walk_in'),
  ('Life Time Chestnut Hill','life-time-chestnut-hill','boston','300 Boylston St, Chestnut Hill, MA 02467','781-797-2007',289,75,'hybrid',false,'walk_in'),
  ('Life Time Walnut Creek','life-time-walnut-creek','sf-bay','1315 Broadway Plaza, Walnut Creek, CA 94596','925-951-4830',339,null,'hybrid',false,'walk_in'),
  ('Life Time Potomac','life-time-potomac','washington-dc','1151 Seven Locks Rd, Rockville, MD 20854','240-599-2930',219,60,'public_day_pass',false,'walk_in')
) as v(name, slug, city_slug, address, phone, monthly_from, day_pass, guest_model, waitlist, dropin)
join public.cities c on c.slug = v.city_slug
on conflict (slug) do nothing;

-- 3) correct the existing Harbour Island record (was over-absolute)
update public.gyms set
  guest_policy_model = 'members_only_waitlist',
  waitlist = true,
  drop_in_note = 'Members-only with a reported waitlist; no public day pass. Member-invited guests use the Life Time app (photo ID; same guest once per 60 days).',
  members_guest_note = 'Member-invited guests only (Life Time app, photo ID, once per 60 days). No public day-pass route; enrollment fee not published.'
where slug = 'life-time-harbour-island';
