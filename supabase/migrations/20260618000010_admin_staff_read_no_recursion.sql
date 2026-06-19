-- Fix infinite-recursion in staff_members RLS: the original read policy
-- referenced staff_members inside its own USING clause, which Postgres rejects
-- as recursive (every staff read errored, surfacing as a phantom 0 count).
-- Use the security-definer is_staff() (bypasses RLS) instead.
drop policy if exists staff_read on public.staff_members;
create policy staff_read on public.staff_members for select to authenticated
  using (public.is_staff());
