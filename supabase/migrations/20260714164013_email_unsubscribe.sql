-- One-click unsubscribe: a per-subscriber token so a signed-out link in an
-- email can flip unsubscribed_at without exposing/guessing the row id.
alter table public.email_subscribers
  add column unsubscribed_at timestamptz,
  add column unsubscribe_token uuid not null default gen_random_uuid();
create unique index email_subscribers_unsubscribe_token_idx on public.email_subscribers (unsubscribe_token);
