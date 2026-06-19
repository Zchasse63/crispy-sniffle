-- Staff-only: resolve an email to its auth user id (for granting staff roles).
create or replace function public.admin_find_user_by_email(p_email text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_staff() then raise exception 'not staff'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  return v_id;
end; $$;
grant execute on function public.admin_find_user_by_email(text) to authenticated;
