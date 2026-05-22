-- =============================================================================
-- VIO LOCAL — Autocomplete Search Index
-- =============================================================================
-- Depends on:
--   20260521144613_init_categories.sql   (categories)
--   20260521150001_geographic_system.sql (provinces, districts)
--   20260521160001_storefronts.sql       (storefronts)
--   20260521170001_products.sql          (products)
--   20260521180001_services.sql          (services)
--
-- Strategy:
--   Unified materialized view (search_autocomplete) aggregates all five
--   entity types into a single, denormalized, unaccent-normalized table.
--   A GIN trigram index makes ILIKE fast enough for keystroke-level queries.
--   A single RPC function (autocomplete_search) wraps all query logic —
--   callers never write raw SQL.
--
-- Vietnamese language notes:
--   pg_trgm + unaccent handles "ca phe" → "cà phê" matching because
--   unaccent() strips diacritics from stored text AND from the query.
--   PostgreSQL has no built-in Vietnamese ts_config, so tsvector is NOT used.
--   trigram similarity is the correct primitive for Vietnamese typeahead.
--
-- Refresh strategy (same as district_discovery_summary):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.search_autocomplete;
--   Scheduled via pg_cron every 5 minutes.
--   CONCURRENTLY requires the unique index below — refreshes without locking.
-- =============================================================================


-- ── EXTENSIONS ───────────────────────────────────────────────────────────────

create extension if not exists pg_trgm;   -- trigram similarity + GIN index
create extension if not exists unaccent;  -- strip Vietnamese diacritics


-- ── MATERIALIZED VIEW ────────────────────────────────────────────────────────

create materialized view if not exists public.search_autocomplete as

-- Provinces ──────────────────────────────────────────────────────────────────
select
  'province'::text                                          as entity_type,
  p.id::text                                                as entity_id,
  p.name                                                    as display_text,
  p.name_full                                               as subtitle,
  p.slug,
  p.id::smallint                                            as province_id,
  p.slug                                                    as province_slug,
  null::integer                                             as district_id,
  5::smallint                                               as rank_boost,
  unaccent(lower(p.name || ' ' || p.name_full))             as search_normalized
from public.provinces p

union all

-- Districts ──────────────────────────────────────────────────────────────────
select
  'district'::text,
  d.id::text,
  d.name,
  d.name_full || ' — ' || p.name_full,                     -- "Buôn Ma Thuột — Đắk Lắk"
  d.slug,
  d.province_id::smallint,
  p.slug,
  d.id,
  4::smallint,
  unaccent(lower(d.name || ' ' || d.name_full))
from public.districts d
join public.provinces p on p.id = d.province_id

union all

-- Storefronts ─────────────────────────────────────────────────────────────────
select
  'storefront'::text,
  s.id::text,
  s.business_name,
  coalesce(d.name || ', ' || p.name, p.name, null),        -- "Buôn Ma Thuột, Đắk Lắk"
  s.slug,
  s.province_id::smallint,
  p.slug,
  s.district_id,
  case when s.is_verified then 3::smallint else 1::smallint end,
  unaccent(lower(s.business_name))
from public.storefronts s
left join public.districts d  on d.id = s.district_id
left join public.provinces p  on p.id = s.province_id
where s.is_public = true

union all

-- Products ────────────────────────────────────────────────────────────────────
select
  'product'::text,
  pr.id::text,
  pr.title,
  coalesce(c.name, '') ||
    case when d.name  is not null then ' · ' || d.name  else '' end ||
    case when p.name  is not null then ', '  || p.name  else '' end,
  pr.slug,
  pr.province_id::smallint,
  p.slug,
  pr.district_id,
  case when pr.is_featured then 2::smallint else 1::smallint end,
  unaccent(lower(pr.title))
from public.products pr
left join public.categories  c    on c.id  = pr.category_id
left join public.districts   d    on d.id  = pr.district_id
left join public.provinces   p    on p.id  = pr.province_id
join      public.storefronts sf   on sf.id = pr.storefront_id and sf.is_public = true
where pr.is_available = true

union all

-- Services ────────────────────────────────────────────────────────────────────
select
  'service'::text,
  sv.id::text,
  sv.title,
  coalesce(c.name, '') ||
    case when d.name  is not null then ' · ' || d.name  else '' end ||
    case when p.name  is not null then ', '  || p.name  else '' end,
  sv.slug,
  sv.province_id::smallint,
  p.slug,
  sv.district_id,
  1::smallint,
  unaccent(lower(sv.title))
from public.services sv
left join public.categories  c    on c.id  = sv.category_id
left join public.districts   d    on d.id  = sv.district_id
left join public.provinces   p    on p.id  = sv.province_id
join      public.storefronts sf   on sf.id = sv.storefront_id and sf.is_public = true
where sv.is_available = true;


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Required for REFRESH CONCURRENTLY — must be unique
create unique index if not exists idx_search_ac_pk
  on public.search_autocomplete(entity_type, entity_id);

-- GIN trigram index — powers ILIKE prefix/contains AND similarity()
-- This is the hot index: every autocomplete query hits it.
create index if not exists idx_search_ac_trgm
  on public.search_autocomplete using gin (search_normalized gin_trgm_ops);

-- Geographic scoping — filters results to the user's current province
create index if not exists idx_search_ac_province
  on public.search_autocomplete(province_id)
  where province_id is not null;

-- Entity type filtering — allows restricting to specific entity types
create index if not exists idx_search_ac_type
  on public.search_autocomplete(entity_type);

-- Rank sort support — verified/featured boosting within a match set
create index if not exists idx_search_ac_rank
  on public.search_autocomplete(entity_type, rank_boost desc);


-- ── SEARCH FUNCTION ───────────────────────────────────────────────────────────
--
-- Single entry point for all autocomplete queries.
-- Returns up to p_limit_each results per entity type, ordered:
--   1. prefix match before contains before fuzzy
--   2. rank_boost DESC within match quality tier
--   3. entity type priority: province → district → storefront → product → service
--
-- p_query         raw user input (the function normalizes + escapes internally)
-- p_province_id   optional scope to a province; provinces/districts always returned
-- p_limit_each    max results per entity type (default 3 → up to 15 rows total)

create or replace function public.autocomplete_search(
  p_query       text,
  p_province_id smallint  default null,
  p_limit_each  int       default 3
)
returns table (
  entity_type    text,
  entity_id      text,
  display_text   text,
  subtitle       text,
  slug           text,
  province_slug  text,
  match_prefix   boolean
)
language sql stable parallel safe as $$
  with normalized as (
    select
      -- stripped form for similarity() and LIKE matching
      unaccent(lower(trim(p_query)))                              as raw,
      -- wildcard-escaped form for safe LIKE patterns
      replace(
        replace(
          replace(unaccent(lower(trim(p_query))), '\', '\\'),
          '%', '\%'),
        '_', '\_')                                                as esc
  ),
  matches as (
    select
      a.entity_type,
      a.entity_id,
      a.display_text,
      a.subtitle,
      a.slug,
      a.province_slug,
      a.rank_boost,
      -- flag whether it's a prefix match (for UI bolding and ranking)
      a.search_normalized like (n.esc || '%') escape '\'       as is_prefix,
      -- numeric sort key: 0 = prefix, 1 = contains, 2 = fuzzy
      case
        when a.search_normalized like (n.esc || '%') escape '\'             then 0
        when a.search_normalized like ('%' || n.esc || '%') escape '\'      then 1
        else 2
      end                                                        as match_tier,
      -- per-type rank to cap at p_limit_each
      row_number() over (
        partition by a.entity_type
        order by
          case
            when a.search_normalized like (n.esc || '%') escape '\'        then 0
            when a.search_normalized like ('%' || n.esc || '%') escape '\'  then 1
            else 2
          end,
          a.rank_boost desc
      )                                                          as rn
    from public.search_autocomplete a, normalized n
    where
      -- geographic scope: geo entities always pass; others filtered to province
      (
        p_province_id is null
        or a.province_id = p_province_id
        or a.entity_type in ('province', 'district')
      )
      -- match condition: prefix OR contains OR trigram fuzzy (3+ chars only)
      and (
        a.search_normalized like (n.esc || '%') escape '\'
        or a.search_normalized like ('%' || n.esc || '%') escape '\'
        or (length(n.raw) >= 3 and similarity(a.search_normalized, n.raw) > 0.3)
      )
  )
  select
    entity_type,
    entity_id,
    display_text,
    subtitle,
    slug,
    province_slug,
    is_prefix as match_prefix
  from matches
  where rn <= p_limit_each
  order by
    -- entity type priority
    case entity_type
      when 'province'   then 1
      when 'district'   then 2
      when 'storefront' then 3
      when 'product'    then 4
      when 'service'    then 5
    end,
    match_tier,
    rank_boost desc,
    display_text
$$;


-- ── RLS: PUBLIC READ ACCESS ───────────────────────────────────────────────────
-- Materialized view does not inherit RLS from underlying tables.
-- It is safe to expose because it only contains is_public=true / is_available=true rows.
-- No anon-user can see drafts, unverified private data, etc.

grant select on public.search_autocomplete to anon, authenticated;
grant execute on function public.autocomplete_search to anon, authenticated;


-- ── PG_CRON REFRESH ──────────────────────────────────────────────────────────
-- Same 5-minute schedule as district_discovery_summary.
-- Both views refresh in a single pg_cron tick to keep them in sync.

select cron.schedule(
  'refresh-search-autocomplete',
  '*/5 * * * *',
  $$refresh materialized view concurrently public.search_autocomplete$$
);


-- ── COMMENTS ─────────────────────────────────────────────────────────────────

comment on materialized view public.search_autocomplete is
  'Unified autocomplete index: provinces, districts, storefronts, products, services. '
  'search_normalized = unaccent(lower(text)) — enables diacritic-insensitive ILIKE. '
  'Refresh every 5 min: REFRESH MATERIALIZED VIEW CONCURRENTLY public.search_autocomplete.';

comment on function public.autocomplete_search is
  'Autocomplete RPC — call via supabase.rpc(''autocomplete_search'', {p_query, p_province_id, p_limit_each}). '
  'Returns up to p_limit_each rows per entity type. '
  'Normalizes query with unaccent(lower()) so Vietnamese diacritics are optional for the user.';
