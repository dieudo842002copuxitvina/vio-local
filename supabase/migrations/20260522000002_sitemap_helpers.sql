-- =============================================================================
-- VIO LOCAL — Sitemap Helper Functions
-- =============================================================================
-- Depends on:
--   20260521144613_init_categories.sql   (categories)
--   20260521150001_geographic_system.sql (provinces, districts)
--   20260521170001_products.sql          (products)
--   20260521180001_services.sql          (services)
--
-- These functions are called exclusively by sitemap generation routes.
-- They perform GROUP BY + HAVING aggregations that PostgREST cannot express
-- natively. Not performance-critical: sitemaps are generated infrequently
-- and responses are cached for 1 hour.
-- =============================================================================


-- ── PROVINCE-LEVEL CATEGORY COUNTS ───────────────────────────────────────────
--
-- Returns every (province, category) pair that meets the minimum listing count,
-- including the URL slugs needed to build sitemap <loc> entries.
--
-- p_entity    'product' or 'service'
-- p_min_count minimum listing count (from THRESHOLDS.categoryProvince)
--
-- Example call:
--   SELECT * FROM get_category_province_counts('product', 3);

create or replace function public.get_category_province_counts(
  p_entity    text,     -- 'product' | 'service'
  p_min_count int
)
returns table (
  province_slug  text,
  category_slug  text,
  listing_count  bigint,
  last_updated   timestamptz
)
language sql stable parallel safe as $$
  -- products branch
  select
    prov.slug   as province_slug,
    cat.slug    as category_slug,
    count(*)    as listing_count,
    max(p.updated_at) as last_updated
  from public.products p
  join public.provinces   prov on prov.id = p.province_id
  join public.categories  cat  on cat.id  = p.category_id
  join public.storefronts sf   on sf.id   = p.storefront_id and sf.is_public = true
  where
    p_entity = 'product'
    and p.is_available = true
    and p.province_id  is not null
    and p.category_id  is not null
  group by prov.slug, cat.slug
  having count(*) >= p_min_count

  union all

  -- services branch
  select
    prov.slug,
    cat.slug,
    count(*),
    max(sv.updated_at)
  from public.services sv
  join public.provinces   prov on prov.id = sv.province_id
  join public.categories  cat  on cat.id  = sv.category_id
  join public.storefronts sf   on sf.id   = sv.storefront_id and sf.is_public = true
  where
    p_entity = 'service'
    and sv.is_available  = true
    and sv.province_id   is not null
    and sv.category_id   is not null
  group by prov.slug, cat.slug
  having count(*) >= p_min_count
$$;


-- ── DISTRICT-LEVEL CATEGORY COUNTS ───────────────────────────────────────────
--
-- Returns every (province, district, category) triple that meets the minimum
-- listing count. province_slug is included for /[province]/[district]/[category]
-- URL construction.
--
-- p_entity    'product' or 'service'
-- p_min_count minimum listing count (from THRESHOLDS.categoryDistrict)

create or replace function public.get_category_district_counts(
  p_entity    text,
  p_min_count int
)
returns table (
  province_slug  text,
  district_slug  text,
  category_slug  text,
  listing_count  bigint,
  last_updated   timestamptz
)
language sql stable parallel safe as $$
  select
    prov.slug,
    dist.slug,
    cat.slug,
    count(*),
    max(p.updated_at)
  from public.products p
  join public.provinces   prov on prov.id = p.province_id
  join public.districts   dist on dist.id = p.district_id
  join public.categories  cat  on cat.id  = p.category_id
  join public.storefronts sf   on sf.id   = p.storefront_id and sf.is_public = true
  where
    p_entity = 'product'
    and p.is_available = true
    and p.district_id  is not null
    and p.category_id  is not null
  group by prov.slug, dist.slug, cat.slug
  having count(*) >= p_min_count

  union all

  select
    prov.slug,
    dist.slug,
    cat.slug,
    count(*),
    max(sv.updated_at)
  from public.services sv
  join public.provinces   prov on prov.id = sv.province_id
  join public.districts   dist on dist.id = sv.district_id
  join public.categories  cat  on cat.id  = sv.category_id
  join public.storefronts sf   on sf.id   = sv.storefront_id and sf.is_public = true
  where
    p_entity = 'service'
    and sv.is_available = true
    and sv.district_id  is not null
    and sv.category_id  is not null
  group by prov.slug, dist.slug, cat.slug
  having count(*) >= p_min_count
$$;


-- ── PROVINCE STOREFRONT TOTALS ────────────────────────────────────────────────
--
-- Returns the total public storefront count per province.
-- Used by the sitemap generator to decide which province pages are indexed.
-- Avoids N+1 queries: one call returns all provinces with their counts.

create or replace function public.get_province_storefront_counts()
returns table (
  province_id   smallint,
  province_slug text,
  total         bigint
)
language sql stable parallel safe as $$
  select
    p.id::smallint  as province_id,
    p.slug          as province_slug,
    count(s.id)     as total
  from public.provinces p
  left join public.storefronts s
    on s.province_id = p.id and s.is_public = true
  group by p.id, p.slug
  having count(s.id) > 0
$$;


-- ── PERMISSIONS ───────────────────────────────────────────────────────────────

grant execute on function public.get_category_province_counts  to anon, authenticated;
grant execute on function public.get_category_district_counts  to anon, authenticated;
grant execute on function public.get_province_storefront_counts to anon, authenticated;


-- ── COMMENTS ─────────────────────────────────────────────────────────────────

comment on function public.get_category_province_counts is
  'Returns (province, category) pairs with listing counts >= p_min_count. '
  'Used by sitemap generation. Not for real-time queries — cache the result.';

comment on function public.get_category_district_counts is
  'Returns (province, district, category) triples with listing counts >= p_min_count. '
  'Used by sitemap generation. Not for real-time queries — cache the result.';

comment on function public.get_province_storefront_counts is
  'Returns all provinces with their public storefront count > 0. '
  'Used by sitemap generation to determine which province pages are indexed.';
