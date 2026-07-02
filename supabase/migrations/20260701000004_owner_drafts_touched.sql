-- Persist the owner-form "touched fields" set alongside the server-side draft so
-- an owner's explicit confirmations survive a resumed or cross-device session
-- (the cross-device draft otherwise overwrote the local one and reset touched to
-- empty, silently dropping every equal-to-baseline confirmation at submit).
alter table public.owner_drafts
  add column if not exists touched jsonb not null default '[]'::jsonb;
