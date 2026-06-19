-- Admin portal foundation: staff RBAC, audit log, runtime config.

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin','reviewer','viewer')),
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;

-- caller's role (null if not staff) — bypasses the RLS circularity for the guard
create or replace function public.my_staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.staff_members where user_id = auth.uid();
$$;
grant execute on function public.my_staff_role() to authenticated;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid());
$$;
grant execute on function public.is_staff() to authenticated;

-- a staff user can read the whole staff list; a non-staff user reads nothing.
-- MUST use the security-definer is_staff() (not a self-subquery) or the policy
-- recurses on staff_members and every read errors.
drop policy if exists staff_read on public.staff_members;
create policy staff_read on public.staff_members for select to authenticated
  using (public.is_staff());

-- role-rank helper for downstream RLS/RPC guards
create or replace function public.has_min_role(min_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case (select role from public.staff_members where user_id = auth.uid())
    when 'owner' then 4 when 'admin' then 3 when 'reviewer' then 2 when 'viewer' then 1 else 0 end
  >= case min_role
    when 'owner' then 4 when 'admin' then 3 when 'reviewer' then 2 when 'viewer' then 1 else 0 end;
$$;
grant execute on function public.has_min_role(text) to authenticated;

-- append-only admin audit log
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users(id),
  action text not null,
  target_table text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
alter table public.admin_audit_log enable row level security;
drop policy if exists audit_read on public.admin_audit_log;
create policy audit_read on public.admin_audit_log for select to authenticated using (public.is_staff());

create or replace function public.log_admin_action(
  p_action text, p_target_table text default null,
  p_target_id text default null, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'not staff'; end if;
  insert into public.admin_audit_log (actor, action, target_table, target_id, detail)
  values (auth.uid(), p_action, p_target_table, p_target_id, p_detail);
end; $$;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;

-- runtime config / feature flags
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
drop policy if exists config_read on public.app_config;
create policy config_read on public.app_config for select to authenticated using (public.is_staff());

-- seed the first/existing user as owner (Zach)
insert into public.staff_members (user_id, role)
select id, 'owner' from auth.users order by created_at limit 1
on conflict (user_id) do nothing;
