-- R6.5: luxury segment (Life Time-class clubs are not big-box) + vibe tags
-- (soft matching signals — the Kodawari rule extended: vibes boost, never exclude)
alter type public.gym_segment add value if not exists 'luxury';

alter table public.gyms
  add column vibe_tags text[] not null default '{}',
  add column vibe_source text not null default 'estimated'
    check (vibe_source in ('owner','scout_verified','user','scraped','seed','estimated'));
