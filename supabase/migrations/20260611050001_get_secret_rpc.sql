-- Version-control capture of the get_secret() RPC that the ai-search edge
-- function and vision-enrich depend on. It was provisioned live early on but
-- never committed — this makes the LLM path reproducible on a fresh project.
-- Reads the newest Vault secret by name; service-role only (the edge fn calls
-- it with the service key). CONFIRMED live + working (ai-search v8 in prod).
create or replace function public.get_secret(secret_name text)
returns text
language sql
security definer
set search_path to ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  order by created_at desc
  limit 1;
$function$;

revoke all on function public.get_secret(text) from public, anon, authenticated;
grant execute on function public.get_secret(text) to service_role;
