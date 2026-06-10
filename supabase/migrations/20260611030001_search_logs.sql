-- Day-one search telemetry: what people ask for IS the product roadmap
-- (popular-query chips, demand-driven expansion). Insert-only from clients;
-- no reads except service role.
create table public.search_logs (
  id           uuid primary key default gen_random_uuid(),
  query        text not null check (char_length(query) <= 300),
  parsed_via   text not null check (parsed_via in ('ai','fallback')),
  result_count integer,
  top_score    integer,
  created_at   timestamptz not null default now()
);
alter table public.search_logs enable row level security;
create policy "anyone can log searches"
  on public.search_logs for insert to anon, authenticated with check (true);
