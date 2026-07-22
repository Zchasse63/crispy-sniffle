-- P2: scalar provenance for LLM-extracted gym row fields (hours/prices/
-- description from land.mjs). Fact rows already carry source+confidence;
-- gyms scalars did not. null = curated/unknown (existing Tampa seed rows).
-- Values: 'scraped' | 'seed' | 'owner'.

alter table public.gyms
  add column if not exists data_source text
  check (data_source is null or data_source in ('scraped', 'seed', 'owner'));

comment on column public.gyms.data_source is
  'Row-level provenance for gym scalars (hours/prices/description). null = curated/unknown; scraped = pipeline land.mjs; seed = research seed; owner = owner-queue publish.';
