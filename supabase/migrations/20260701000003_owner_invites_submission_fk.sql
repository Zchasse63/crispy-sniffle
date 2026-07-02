-- Audit fix (LOW): owner_invites.submission_id was a bare uuid with no foreign
-- key, so it could dangle after a submission row was deleted (resolve_owner_invite_context
-- then silently serves a blank form). Add the missing FK; on delete, null the link
-- rather than cascade (the invite itself is independent of any one submission).
-- Null any pre-existing dangling reference first so the constraint validates.
update public.owner_invites i set submission_id = null
where submission_id is not null
  and not exists (select 1 from public.owner_submissions s where s.id = i.submission_id);

alter table public.owner_invites
  drop constraint if exists owner_invites_submission_id_fkey;
alter table public.owner_invites
  add constraint owner_invites_submission_id_fkey
  foreign key (submission_id) references public.owner_submissions(id) on delete set null;
