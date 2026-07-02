-- Audit fix (LOW, residual): a review author could reverse a moderation hide by
-- DELETEing their hidden/moderated review and re-INSERTing a fresh one (new id,
-- hidden=false, report_count=0) — the UPDATE-column guard trigger doesn't cover
-- delete+reinsert. Forbid authors from deleting a review that is hidden or has
-- been moderated; the unique(gym_id,user_id) constraint then also blocks the
-- re-insert. Staff/service-role deletes bypass RLS and are unaffected.
drop policy if exists "owner delete review" on public.gym_reviews;
create policy "owner delete review" on public.gym_reviews for delete to authenticated
  using (auth.uid() = user_id and hidden = false and moderated_by is null);
