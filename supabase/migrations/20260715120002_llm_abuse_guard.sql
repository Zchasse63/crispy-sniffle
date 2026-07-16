-- WP-H (edge half): durable abuse controls for the public LLM endpoints.
-- The in-edge in-memory limiter is per-isolate (resets on cold start, multiplies
-- across isolates) — not a real spend boundary. This adds a Postgres-backed
-- gate: per-IP per-minute limit, a global daily request ceiling per function,
-- and a kill switch that disables LLM calls without a redeploy.

-- Operational flags (kill switch lives here). Service-role only: RLS on, no policies.
create table if not exists public.app_flags (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
insert into public.app_flags (key, value) values ('llm_enabled', 'true'::jsonb)
  on conflict (key) do nothing;

-- Fixed-window counters. Rows are tiny and short-lived; llm_gate prunes.
create table if not exists public.rate_counters (
  bucket_key   text primary key,
  window_start timestamptz not null,
  count        integer not null
);
alter table public.rate_counters enable row level security;

create or replace function public.llm_gate(
  p_fn text,
  p_ip text,
  p_per_min integer,
  p_daily_cap integer
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_enabled jsonb;
  v_minute timestamptz := date_trunc('minute', now());
  v_day    timestamptz := date_trunc('day', now());
  v_count integer;
begin
  -- Kill switch: flip app_flags.llm_enabled to false to stop all LLM spend
  -- immediately, no redeploy.
  select value into v_enabled from public.app_flags where key = 'llm_enabled';
  if v_enabled is not null and v_enabled = 'false'::jsonb then
    return 'disabled';
  end if;

  -- Per-IP per-minute (atomic upsert-increment; fixed window).
  insert into public.rate_counters as rc (bucket_key, window_start, count)
  values (p_fn || ':ip:' || p_ip || ':' || extract(epoch from v_minute)::bigint, v_minute, 1)
  on conflict (bucket_key) do update set count = rc.count + 1
  returning count into v_count;
  if v_count > p_per_min then
    return 'rate_limited';
  end if;

  -- Global daily ceiling per function — the hard spend boundary.
  insert into public.rate_counters as rc (bucket_key, window_start, count)
  values (p_fn || ':day:' || extract(epoch from v_day)::bigint, v_day, 1)
  on conflict (bucket_key) do update set count = rc.count + 1
  returning count into v_count;
  if v_count > p_daily_cap then
    return 'budget_exceeded';
  end if;

  -- Opportunistic prune of expired windows (table stays tiny at Scout traffic).
  delete from public.rate_counters where window_start < now() - interval '2 days';

  return 'ok';
end;
$$;
revoke execute on function public.llm_gate(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.llm_gate(text,text,integer,integer) to service_role;
