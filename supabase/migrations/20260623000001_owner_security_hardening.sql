-- Owner-pipeline security hardening (launch audit, P1).
--
-- 1) Per-IP abuse signal on submissions. Stored HASHED — never the raw IP — so
--    the public submit endpoint can enforce a durable per-network rate cap that
--    survives serverless instance recycling.
alter table public.owner_submissions
  add column if not exists submitter_ip_hash text;
create index if not exists owner_submissions_ip_idx
  on public.owner_submissions(submitter_ip_hash, created_at desc);

-- 2) Make the write-deny boundary EXPLICIT on the owner tables.
--    RLS is already enabled with SELECT-only staff policies, so writes are denied
--    by default. These RESTRICTIVE deny policies lock that intent: even if a
--    future permissive policy is added by mistake, restrictive AND-composition
--    keeps anon/authenticated writes closed. The service-role client bypasses RLS
--    entirely and is unaffected (all legitimate writes go through it).
do $$
declare t text;
begin
  foreach t in array array['owner_invites','owner_submissions','owner_fact_log']
  loop
    execute format('drop policy if exists %I on public.%I', t||'_deny_write_ins', t);
    execute format('create policy %I on public.%I as restrictive for insert to anon, authenticated with check (false)', t||'_deny_write_ins', t);
    execute format('drop policy if exists %I on public.%I', t||'_deny_write_upd', t);
    execute format('create policy %I on public.%I as restrictive for update to anon, authenticated using (false) with check (false)', t||'_deny_write_upd', t);
    execute format('drop policy if exists %I on public.%I', t||'_deny_write_del', t);
    execute format('create policy %I on public.%I as restrictive for delete to anon, authenticated using (false)', t||'_deny_write_del', t);
  end loop;
end $$;
