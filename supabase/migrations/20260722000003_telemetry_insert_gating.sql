-- P2: gate search_logs / ask_logs inserts. Clients previously had open
-- anon/authenticated INSERT with check (true) — a spam/bloat vector.
-- Both tables are only written from the browser (DiscoveryClient,
-- AskScout). Replace direct inserts with security-definer RPCs that:
--   * cap text lengths (300)
--   * validate shape (parsed_via enum, fact_ids array)
--   * throttle via rate_counters (30 inserts/hour per caller key)
-- then drop the open insert policies.

-- ── log_search ──────────────────────────────────────────────────────────
create or replace function public.log_search(
  p_query text,
  p_parsed_via text,
  p_result_count integer default null,
  p_top_score integer default null,
  p_anon_id text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := left(trim(coalesce(p_query, '')), 300);
  v_via text := lower(trim(coalesce(p_parsed_via, '')));
  v_key text;
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if v_query = '' then
    return;
  end if;
  if v_via not in ('ai', 'fallback') then
    return;
  end if;

  -- Caller key: auth.uid() when signed in, else a client-supplied anonymous
  -- id (capped), else a shared 'anon' bucket so unsigned traffic still has a
  -- ceiling.
  v_key := 'search_log:' || coalesce(
    auth.uid()::text,
    nullif(left(trim(coalesce(p_anon_id, '')), 64), ''),
    'anon'
  ) || ':' || extract(epoch from v_window)::bigint;

  insert into public.rate_counters as rc (bucket_key, window_start, count)
  values (v_key, v_window, 1)
  on conflict (bucket_key) do update set count = rc.count + 1
  returning count into v_count;

  if v_count > 30 then
    return; -- throttled; fire-and-forget callers ignore the no-op
  end if;

  insert into public.search_logs (query, parsed_via, result_count, top_score)
  values (
    v_query,
    v_via,
    p_result_count,
    p_top_score
  );
end;
$$;

revoke all on function public.log_search(text, text, integer, integer, text) from public;
grant execute on function public.log_search(text, text, integer, integer, text) to anon, authenticated;

-- ── log_ask ─────────────────────────────────────────────────────────────
create or replace function public.log_ask(
  p_gym_id uuid,
  p_question text,
  p_verdict text default null,
  p_fact_ids jsonb default '[]'::jsonb,
  p_anon_id text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question text := left(trim(coalesce(p_question, '')), 300);
  v_verdict text := nullif(left(trim(coalesce(p_verdict, '')), 64), '');
  v_facts jsonb;
  v_key text;
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if v_question = '' then
    return;
  end if;

  -- fact_ids must be a JSON array of short strings (synthetic fact ids).
  if p_fact_ids is null or jsonb_typeof(p_fact_ids) <> 'array' then
    v_facts := '[]'::jsonb;
  else
    -- Cap array length and element length to keep the row small.
    select coalesce(
      (select jsonb_agg(to_jsonb(left(value #>> '{}', 128)))
       from jsonb_array_elements(p_fact_ids) with ordinality as t(value, ord)
       where ord <= 50
         and jsonb_typeof(value) = 'string'
         and length(value #>> '{}') > 0),
      '[]'::jsonb
    ) into v_facts;
  end if;

  v_key := 'ask_log:' || coalesce(
    auth.uid()::text,
    nullif(left(trim(coalesce(p_anon_id, '')), 64), ''),
    'anon'
  ) || ':' || extract(epoch from v_window)::bigint;

  insert into public.rate_counters as rc (bucket_key, window_start, count)
  values (v_key, v_window, 1)
  on conflict (bucket_key) do update set count = rc.count + 1
  returning count into v_count;

  if v_count > 30 then
    return;
  end if;

  insert into public.ask_logs (gym_id, question, verdict, fact_ids)
  values (p_gym_id, v_question, v_verdict, v_facts);
end;
$$;

revoke all on function public.log_ask(uuid, text, text, jsonb, text) from public;
grant execute on function public.log_ask(uuid, text, text, jsonb, text) to anon, authenticated;

-- Drop the open insert policies — only the definer RPCs write now.
drop policy if exists "anyone can log searches" on public.search_logs;
drop policy if exists "anyone can log ask-scout queries" on public.ask_logs;
