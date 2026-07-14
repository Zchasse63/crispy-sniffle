-- Fact freshness integrity. `updated_at` on fact_confirmations/gym_equipment
-- is a generic "row touched" stamp (bumped by trigger on any update, e.g. a
-- backfill script) and must NEVER be read as "this fact was re-verified on
-- this date" — that would render a first-write or incidental-edit date as if
-- a human had just confirmed it. gyms.hours_verified_at / day_pass_verified_at
-- are the deliberate verification stamps (set only by an explicit re-check
-- flow); confirmation_counts.last_confirmed_at is likewise scoped to actual
-- verdict='confirm' rows, not row touches. Keep these signals separate.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

alter table public.fact_confirmations add column updated_at timestamptz not null default now();
create trigger fact_confirmations_touch before update on public.fact_confirmations
  for each row execute function public.touch_updated_at();

create trigger gym_amenities_touch before update on public.gym_amenities
  for each row execute function public.touch_updated_at();

alter table public.gym_equipment add column updated_at timestamptz not null default now();
create trigger gym_equipment_touch before update on public.gym_equipment
  for each row execute function public.touch_updated_at();

alter table public.gyms
  add column hours_verified_at timestamptz,
  add column day_pass_verified_at timestamptz;

drop function public.confirmation_counts(uuid);
create function public.confirmation_counts(gym uuid)
returns table (
  fact_type text,
  fact_key text,
  confirms bigint,
  corrects bigint,
  last_confirmed_at timestamptz,
  confirms_7d bigint
)
language sql security definer set search_path = public
as $$
  select
    fc.fact_type,
    fc.fact_key,
    count(*) filter (where fc.verdict = 'confirm') as confirms,
    count(*) filter (where fc.verdict = 'correct') as corrects,
    max(fc.updated_at) filter (where fc.verdict = 'confirm') as last_confirmed_at,
    count(*) filter (where fc.verdict = 'confirm' and fc.updated_at > now() - interval '7 days') as confirms_7d
  from public.fact_confirmations fc
  where fc.gym_id = gym
  group by fc.fact_type, fc.fact_key
$$;
grant execute on function public.confirmation_counts(uuid) to anon, authenticated;
