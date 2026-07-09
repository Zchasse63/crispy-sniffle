-- Outreach pool: non-landed real-gym prospects we email a "claim your free listing"
-- invite. A prospect enters the pool (status='outreach') only if we discover an
-- email; otherwise it's rejected 'no-contact' (no way to reach them = no point).
alter table public.facility_candidates
  add column if not exists email text,
  add column if not exists email_source text,
  add column if not exists contacted_at timestamptz;
comment on column public.facility_candidates.email is 'Discovered outreach email for a non-landed real-gym prospect (status=outreach).';
comment on column public.facility_candidates.email_source is 'Where the email was found: mailto | contact-page | cached | social.';
