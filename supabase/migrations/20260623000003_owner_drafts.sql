-- Server-side owner-form drafts for cross-device resume. Keyed by invite_id (one
-- draft per single-use invite). The /api/owner/draft route reads/writes via the
-- service-role client after validating the invite token; the table denies all
-- anon/authenticated writes (same posture as the other owner tables) + staff SELECT.
create table if not exists public.owner_drafts (
  invite_id uuid primary key references public.owner_invites(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  version int not null,
  answers jsonb not null,
  completed_sections jsonb not null default '[]'::jsonb,
  contact_name text,
  contact_role text,
  updated_at timestamptz not null default now()
);
create index if not exists owner_drafts_gym_idx on public.owner_drafts(gym_id);
alter table public.owner_drafts enable row level security;

drop policy if exists owner_drafts_read on public.owner_drafts;
create policy owner_drafts_read on public.owner_drafts for select to authenticated using (public.is_staff());

drop policy if exists owner_drafts_deny_write_ins on public.owner_drafts;
create policy owner_drafts_deny_write_ins on public.owner_drafts as restrictive for insert to anon, authenticated with check (false);
drop policy if exists owner_drafts_deny_write_upd on public.owner_drafts;
create policy owner_drafts_deny_write_upd on public.owner_drafts as restrictive for update to anon, authenticated using (false) with check (false);
drop policy if exists owner_drafts_deny_write_del on public.owner_drafts;
create policy owner_drafts_deny_write_del on public.owner_drafts as restrictive for delete to anon, authenticated using (false);
