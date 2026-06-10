-- R9: newsletter / alert-intent capture (sender = future Resend key;
-- double-opt-in happens when sending exists). Insert-only from clients.
create table public.email_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email ~* '^\S+@\S+\.\S+$'),
  interests   text[] not null default '{new_gyms}',
  created_at  timestamptz not null default now()
);
alter table public.email_subscribers enable row level security;
create policy "anyone can subscribe"
  on public.email_subscribers for insert to anon, authenticated with check (true);
