-- Owner-listed badge (set true when an owner submission publishes).
alter table public.gyms add column if not exists owner_listed boolean not null default false;

-- Tokenized invites. Raw token shown once to the operator; only its sha256 is
-- stored. The owner portal resolves a presented token by hashing + matching.
create table if not exists public.owner_invites (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  token_hash text not null unique,
  email text,
  status text not null default 'active' check (status in ('active','used','revoked','expired')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  submission_id uuid
);
create index if not exists owner_invites_gym_idx on public.owner_invites(gym_id);
alter table public.owner_invites enable row level security;
drop policy if exists owner_invites_read on public.owner_invites;
create policy owner_invites_read on public.owner_invites for select to authenticated using (public.is_staff());

-- Owner submissions: the raw answer map + a parsed-facts diff awaiting review.
create table if not exists public.owner_submissions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  invite_id uuid references public.owner_invites(id),
  contact_name text,
  contact_email text,
  contact_role text,
  raw_answers jsonb not null,
  parsed_facts jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','published','rejected','needs_info')),
  conflict_count int not null default 0,
  fact_count int not null default 0,
  note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists owner_submissions_status_idx on public.owner_submissions(status, created_at desc);
create index if not exists owner_submissions_gym_idx on public.owner_submissions(gym_id);
alter table public.owner_submissions enable row level security;
drop policy if exists owner_submissions_read on public.owner_submissions;
create policy owner_submissions_read on public.owner_submissions for select to authenticated using (public.is_staff());

-- Per-fact decision log written at publish time (unifies with gym_edit_log shape).
create table if not exists public.owner_fact_log (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.owner_submissions(id) on delete cascade,
  gym_id uuid references public.gyms(id),
  field text,
  old_value jsonb,
  new_value jsonb,
  decision text not null check (decision in ('published','rejected','skipped')),
  actor uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists owner_fact_log_submission_idx on public.owner_fact_log(submission_id);
alter table public.owner_fact_log enable row level security;
drop policy if exists owner_fact_log_read on public.owner_fact_log;
create policy owner_fact_log_read on public.owner_fact_log for select to authenticated using (public.is_staff());
