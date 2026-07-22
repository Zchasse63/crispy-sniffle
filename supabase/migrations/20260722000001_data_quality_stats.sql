-- Admin data-quality cockpit aggregates. Replaces full-table fact selects that
-- silently truncated at PostgREST's 1000-row cap (amenity facts already >1k).
-- Staff/service only; return shape mirrors getDataQuality() in gyms-admin.ts.

create or replace function public.data_quality_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_stale_cutoff timestamptz := now() - interval '90 days';
  v_total int;
  v_stale int;
  v_low_conf int;
  v_prov jsonb;
  v_status jsonb;
  v_price_gaps jsonb;
  v_city_board jsonb;
begin
  if auth.role() is distinct from 'service_role' and not public.is_staff() then
    raise exception 'not staff';
  end if;

  select count(*)::int into v_total from public.gyms;

  select count(*)::int into v_stale
  from public.gyms g
  where g.last_fetched_at is null or g.last_fetched_at < v_stale_cutoff;

  -- provenance + low-confidence across gym_amenities + gym_equipment
  select coalesce(count(*) filter (where confidence < 0.7), 0)::int into v_low_conf
  from (
    select confidence from public.gym_amenities
    union all
    select confidence from public.gym_equipment
  ) f;

  select coalesce(jsonb_agg(jsonb_build_object('source', source, 'count', cnt) order by cnt desc), '[]'::jsonb)
  into v_prov
  from (
    select coalesce(source, 'estimated') as source, count(*)::int as cnt
    from (
      select source from public.gym_amenities
      union all
      select source from public.gym_equipment
    ) f
    group by 1
  ) s;

  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) order by cnt desc), '[]'::jsonb)
  into v_status
  from (
    select status::text as status, count(*)::int as cnt
    from public.gyms
    group by status
  ) s;

  -- price gap = no monthly_from AND no day_pass_price AND no membership_plans
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'slug', g.slug,
        'name', g.name,
        'cityName', c.name
      )
      order by g.name
    ),
    '[]'::jsonb
  )
  into v_price_gaps
  from public.gyms g
  left join public.cities c on c.id = g.city_id
  where g.monthly_from is null
    and g.day_pass_price is null
    and g.membership_plans is null;

  -- city board: gym count, avg completeness (same CORE_FIELDS as lib/completeness.ts), price gaps
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cityId', city_id,
        'name', city_name,
        'state', city_state,
        'gyms', gyms,
        'avgCompleteness', avg_completeness,
        'priceGaps', price_gaps
      )
      order by gyms desc
    ),
    '[]'::jsonb
  )
  into v_city_board
  from (
    select
      g.city_id,
      c.name as city_name,
      c.state as city_state,
      count(*)::int as gyms,
      round(avg(
        (
          (case when g.address is not null and g.address <> '' then 1 else 0 end)
          + (case when g.phone is not null and g.phone <> '' then 1 else 0 end)
          + (case when g.website is not null and g.website <> '' then 1 else 0 end)
          + (case when g.segment is not null then 1 else 0 end)
          + (case when g.description is not null and g.description <> '' then 1 else 0 end)
          + (case when g.photo_url is not null and g.photo_url <> '' then 1 else 0 end)
          + (case when g.neighborhood is not null and g.neighborhood <> '' then 1 else 0 end)
          + (case when g.hours is not null then 1 else 0 end)
          + (case when g.monthly_from is not null then 1 else 0 end)
          + (case when g.day_pass_price is not null then 1 else 0 end)
        ) * 10.0
      ))::int as avg_completeness,
      count(*) filter (
        where g.monthly_from is null
          and g.day_pass_price is null
          and g.membership_plans is null
      )::int as price_gaps
    from public.gyms g
    left join public.cities c on c.id = g.city_id
    group by g.city_id, c.name, c.state
  ) board;

  return jsonb_build_object(
    'totalGyms', v_total,
    'provenanceMix', v_prov,
    'lowConfidenceFacts', v_low_conf,
    'priceGapGyms', v_price_gaps,
    'staleGyms', v_stale,
    'statusMix', v_status,
    'cityBoard', v_city_board
  );
end;
$$;

revoke all on function public.data_quality_stats() from public;
grant execute on function public.data_quality_stats() to authenticated;
grant execute on function public.data_quality_stats() to service_role;
