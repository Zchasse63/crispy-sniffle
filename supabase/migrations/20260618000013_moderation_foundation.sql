-- Review moderation metadata.
alter table public.gym_reviews
  add column if not exists moderated_by uuid references auth.users(id),
  add column if not exists moderated_at timestamptz,
  add column if not exists moderation_reason text;

-- Per-user moderation (bans).
create table if not exists public.user_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'banned' check (status in ('active','banned')),
  reason text,
  moderated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_moderation enable row level security;
drop policy if exists user_moderation_read on public.user_moderation;
create policy user_moderation_read on public.user_moderation for select to authenticated using (public.is_staff());

-- Is this user currently banned? (security definer → usable in RLS predicates)
create or replace function public.is_banned(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_moderation where user_id = uid and status = 'banned');
$$;
grant execute on function public.is_banned(uuid) to authenticated, anon;

-- Banned users can no longer post reviews.
drop policy if exists "owner insert review" on public.gym_reviews;
create policy "owner insert review" on public.gym_reviews for insert to authenticated
  with check (auth.uid() = user_id and not public.is_banned(auth.uid()));

-- Staff-only email lookup (auth.users is never exposed to clients directly).
create or replace function public.admin_user_lookup(uid uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_email text;
begin
  if not public.is_staff() then raise exception 'not staff'; end if;
  select email into v_email from auth.users where id = uid;
  return v_email;
end; $$;
grant execute on function public.admin_user_lookup(uuid) to authenticated;
