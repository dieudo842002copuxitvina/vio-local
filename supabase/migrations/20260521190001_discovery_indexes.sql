-- =============================================================================
-- VIO LOCAL — Discovery Indexes + District Summary Materialized View
-- =============================================================================
-- Depends on:
--   20260521160001_storefronts.sql  (storefronts)
--   20260521170001_products.sql     (products)
--   20260521180001_services.sql     (services)
--
-- Problem this migration solves:
--   Existing single-column partial indexes (idx_products_province,
--   idx_products_district) work for simple geo queries. They do NOT serve
--   compound geo+category queries efficiently:
--
--     SELECT ... FROM products
--     WHERE province_id = 75 AND category_id = 3 AND is_available = true
--
--   PostgreSQL will use idx_products_province to find province rows, then
--   filter by category_id — a table scan over the province result set.
--   With 500+ products per province this becomes measurable.
--
--   Compound (province_id, category_id) indexes eliminate this secondary scan.
--
-- =============================================================================


-- ── COMPOUND GEO+CATEGORY INDEXES ────────────────────────────────────────────
-- Powers /[province]/[category] and /[province]/[district]/[category] pages.

create index if not exists idx_products_province_category
  on public.products(province_id, category_id)
  where is_available = true;

create index if not exists idx_products_district_category
  on public.products(district_id, category_id)
  where is_available = true;

create index if not exists idx_services_province_category
  on public.services(province_id, category_id)
  where is_available = true;

create index if not exists idx_services_district_category
  on public.services(district_id, category_id)
  where is_available = true;


-- ── COMPOUND GEO+SORT INDEXES FOR STOREFRONTS ─────────────────────────────────
-- Discovery pages sort: verified first, then newest.
-- (province_id, is_verified DESC, created_at DESC) means the DB can satisfy
-- the WHERE + ORDER BY from a single index scan — no filesort.

create index if not exists idx_storefronts_province_sort
  on public.storefronts(province_id, is_verified desc, created_at desc)
  where is_public = true;

create index if not exists idx_storefronts_district_sort
  on public.storefronts(district_id, is_verified desc, created_at desc)
  where is_public = true;


-- ── WARD INDEX FOR FILL-UP NEARBY QUERIES ────────────────────────────────────
-- The nearby fill-up algorithm starts at ward level: "other storefronts in
-- this exact ward". Without this index it falls back to a seq scan.

create index if not exists idx_storefronts_ward
  on public.storefronts(ward_id)
  where is_public = true;

create index if not exists idx_products_ward
  on public.products(ward_id)
  where is_available = true;


-- ── DISTRICT DISCOVERY SUMMARY MATERIALIZED VIEW ─────────────────────────────
-- Used by province pages to list districts with storefront/product/service
-- counts. Without this view, every province page load runs a GROUP BY across
-- storefronts + products + services — expensive at scale.
--
-- Refresh strategy:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.district_discovery_summary;
--   Schedule via pg_cron (every 5 minutes) or a Supabase Edge Function cron.
--   CONCURRENTLY requires the unique index below — it refreshes without locking.

create materialized view if not exists public.district_discovery_summary as
select
  d.id           as district_id,
  d.province_id,
  d.name,
  d.name_full,
  d.slug,
  count(distinct s.id)
    filter (where s.is_public = true)                                    as storefront_count,
  count(distinct p.id)
    filter (where p.is_available = true and sf_p.is_public = true)      as product_count,
  count(distinct sv.id)
    filter (where sv.is_available = true and sf_sv.is_public = true)    as service_count
from public.districts d
left join public.storefronts s     on s.district_id  = d.id
left join public.products    p     on p.district_id  = d.id
left join public.storefronts sf_p  on sf_p.id        = p.storefront_id
left join public.services    sv    on sv.district_id = d.id
left join public.storefronts sf_sv on sf_sv.id       = sv.storefront_id
group by d.id, d.province_id, d.name, d.name_full, d.slug;

-- Required for REFRESH CONCURRENTLY
create unique index if not exists idx_district_summary_pk
  on public.district_discovery_summary(district_id);

-- Province page nav: list districts sorted by storefront count
create index if not exists idx_district_summary_province
  on public.district_discovery_summary(province_id, storefront_count desc);

comment on materialized view public.district_discovery_summary is
  'Pre-aggregated storefront/product/service counts per district. '
  'Refresh every 5 minutes: REFRESH MATERIALIZED VIEW CONCURRENTLY public.district_discovery_summary. '
  'Do not query storefronts GROUP BY on every province page load.';
