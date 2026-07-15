-- Ask Scout telemetry: every guardrailed gym-detail Q&A, insert-only from
-- clients (mirrors search_logs — what people ask IS the product signal).
-- fact_ids records the synthetic fact ids (amenity:<key>, equipment:<key>,
-- parking:<uuid>, transit:<uuid>, gym:day_pass_price, gym:hours) the verdict
-- was derived from server-side — the LLM only ever returns these ids, never
-- prose (see CLAUDE.md rule 6).
create table public.ask_logs (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid references gyms(id) on delete set null,
  question   text not null check (char_length(question) <= 300),
  verdict    text,
  fact_ids   jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.ask_logs enable row level security;
create policy "anyone can log ask-scout queries"
  on public.ask_logs for insert to anon, authenticated with check (true);
