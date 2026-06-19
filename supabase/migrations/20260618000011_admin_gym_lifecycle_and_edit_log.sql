-- Gym lifecycle status (open-decision #1: one unified enum) + freshness stamps.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'gym_status') then
    create type public.gym_status as enum
      ('active','suspect','closed','moved','duplicate','unverified_new');
  end if;
end $$;

alter table public.gyms
  add column if not exists status public.gym_status not null default 'active',
  add column if not exists status_note text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists last_fetched_at timestamptz,
  add column if not exists last_extracted_at timestamptz;

update public.gyms set status = 'active' where status is null;

-- Append-only edit log for every catalog mutation (mirrors the owner_fact_log
-- shape so the System → Audit timeline can unify them later).
create table if not exists public.gym_edit_log (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete cascade,
  actor uuid references auth.users(id),
  action text not null,                 -- 'update' | 'status' | 'amenity' | 'create'
  field text,
  old_value jsonb,
  new_value jsonb,
  source text,
  confidence numeric,
  created_at timestamptz not null default now()
);
create index if not exists gym_edit_log_gym_idx on public.gym_edit_log(gym_id, created_at desc);
alter table public.gym_edit_log enable row level security;
drop policy if exists gym_edit_log_read on public.gym_edit_log;
create policy gym_edit_log_read on public.gym_edit_log for select to authenticated using (public.is_staff());
