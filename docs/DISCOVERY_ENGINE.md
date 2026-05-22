# Hyperlocal Discovery Query Architecture

Query patterns, indexes, caching, and internal linking for VIO LOCAL discovery.

Implementation:
- Queries → [`src/services/discovery/queries.ts`](../src/services/discovery/queries.ts)
- Indexes + materialized view → [`supabase/migrations/20260521190001_discovery_indexes.sql`](../supabase/migrations/20260521190001_discovery_indexes.sql)

---

## 1. Discovery Page Taxonomy

Every discovery page maps to one query pattern. URL structure drives the pattern selection.

```
/:province-slug                       → province storefronts
/:province-slug/:district-slug        → district storefronts       (resolved as district)
/:province-slug/:category-slug        → province products/services  (resolved as category)
/ho-kinh-doanh/:slug                  → storefront page (includes nearby + products)
/san-pham/:slug                       → product page (includes nearby similar)
/dich-vu/:slug                        → service page
```

Route loader resolves `:district-slug` vs `:category-slug` by querying `districts` first. If the segment matches a district slug for that province, it's a district page. Otherwise it's treated as a category slug.

---

## 2. Query Patterns

### 2.1 Province Discovery

```sql
-- /dong-nai
-- Powers: province storefront list, sorted verified-first
SELECT *
FROM storefronts
WHERE province_id = 75         -- Đồng Nai GSO code
  AND is_public   = true
ORDER BY is_verified DESC,
         created_at  DESC
LIMIT 20 OFFSET 0;
```

**Index used:** `idx_storefronts_province_sort (province_id, is_verified DESC, created_at DESC) WHERE is_public = true`  
This index covers both the `WHERE` and `ORDER BY` — zero filesort.

---

### 2.2 District Discovery

```sql
-- /dong-nai/xuan-loc
SELECT *
FROM storefronts
WHERE district_id = 724        -- Xuân Lộc GSO code
  AND is_public   = true
ORDER BY is_verified DESC,
         created_at  DESC
LIMIT 20 OFFSET 0;
```

**Index used:** `idx_storefronts_district_sort (district_id, is_verified DESC, created_at DESC) WHERE is_public = true`

---

### 2.3 Province + Category Discovery (products)

```sql
-- /dong-nai/trai-cay  (province_id=75, category_id=3)
SELECT p.*, s.business_name, s.slug AS storefront_slug, s.is_verified
FROM products p
JOIN storefronts s ON s.id = p.storefront_id AND s.is_public = true
WHERE p.province_id  = 75
  AND p.category_id  = 3
  AND p.is_available = true
ORDER BY p.is_featured DESC,
         p.created_at  DESC
LIMIT 20 OFFSET 0;
```

**Index used:** `idx_products_province_category (province_id, category_id) WHERE is_available = true`  
Without this compound index, PostgreSQL uses `idx_products_province`, finds all province rows, then scans for `category_id`. At 500+ products per province this becomes a full province scan.

---

### 2.4 Province District Summary (province page nav)

```sql
-- Province page: list districts with counts (for nav + internal linking)
-- Uses materialized view — NOT a live GROUP BY
SELECT *
FROM district_discovery_summary
WHERE province_id     = 75
  AND storefront_count > 0      -- skip empty districts
ORDER BY storefront_count DESC;
```

**Runs against:** `district_discovery_summary` materialized view  
**Index used:** `idx_district_summary_province (province_id, storefront_count DESC)`  
**Cost:** O(number of districts in province) — typically 5–15 rows. Constant-time.

Without the materialized view, this query joins storefronts + products + services with GROUP BY on every province page load. At 100 concurrent visitors that's 100 GROUP BY scans per second.

---

### 2.5 Segment Disambiguation (district vs category)

```sql
-- Route loader: is this segment a district or a category?
-- Query 1: check district
SELECT id, name, slug
FROM districts
WHERE province_id = $province_id
  AND slug        = $segment
LIMIT 1;

-- If no result:
-- Query 2: check category
SELECT id, name, slug, type
FROM categories
WHERE slug = $segment
LIMIT 1;
```

Both are index-only scans. Total disambiguation cost: 1–2 microsecond queries.

---

## 3. Indexing Strategy

### Existing indexes (from migrations)

| Index | Table | Columns | Partial |
|---|---|---|---|
| `idx_storefronts_province` | storefronts | province_id | `is_public = true` |
| `idx_storefronts_district` | storefronts | district_id | `is_public = true` |
| `idx_products_province` | products | province_id | `is_available = true` |
| `idx_products_district` | products | district_id | `is_available = true` |
| `idx_products_category` | products | category_id | `is_available = true` |
| `idx_services_province` | services | province_id | `is_available = true` |
| `idx_services_district` | services | district_id | `is_available = true` |
| `idx_services_category` | services | category_id | `is_available = true` |

### New compound indexes (migration 20260521190001)

| Index | Columns | Purpose |
|---|---|---|
| `idx_storefronts_province_sort` | `(province_id, is_verified DESC, created_at DESC)` | Province page — sort without filesort |
| `idx_storefronts_district_sort` | `(district_id, is_verified DESC, created_at DESC)` | District page — sort without filesort |
| `idx_storefronts_ward` | `ward_id` | Nearby fill-up level 1 |
| `idx_products_province_category` | `(province_id, category_id)` | Province+category page |
| `idx_products_district_category` | `(district_id, category_id)` | District+category page |
| `idx_products_ward` | `ward_id` | Nearby product fill-up |
| `idx_services_province_category` | `(province_id, category_id)` | Province services by category |
| `idx_services_district_category` | `(district_id, category_id)` | District services by category |

### Index selection guide

```
Query type                         Use index
───────────────────────────────    ─────────────────────────────────────────
Province storefronts               idx_storefronts_province_sort
District storefronts               idx_storefronts_district_sort
Province products (any category)   idx_products_province
Province products (one category)   idx_products_province_category  ← compound
District products (one category)   idx_products_district_category  ← compound
Slug resolution (provinces/cats)   idx_provinces_slug / idx_categories_slug
District summary per province      idx_district_summary_province   ← mat. view
```

---

## 4. Nearby Discovery Strategy

### Why no PostGIS, no lat/lng math

PostGIS `ST_DWithin` with a radius in km is the "correct" geographic answer.  
It is wrong for VIO LOCAL users.

A farmer in Xã Tân Phú, Huyện Tân Phú searches for nearby businesses.  
Their mental model of "nearby" is:
1. Businesses in Xã Tân Phú (same commune — walking distance)
2. Businesses in Huyện Tân Phú (same district — one motorbike trip)
3. Businesses in Tỉnh Đồng Nai (same province — a day's travel)

This matches the Vietnamese administrative hierarchy exactly. A 10km radius in PostGIS would cross into a neighboring province and return results a farmer considers "far". The hierarchy model is more accurate AND cheaper.

### Fill-up algorithm

```
getNearbyStorefronts(origin, limit=8)

Step 1: ward level (proximity: 'ward')
  SELECT * FROM storefronts
  WHERE ward_id = origin.ward_id AND is_public = true
  LIMIT (limit - results.length)
  → "Hộ kinh doanh cùng xã"

Step 2: district level (proximity: 'district') [if results < limit]
  SELECT * FROM storefronts
  WHERE district_id = origin.district_id AND is_public = true
    AND id NOT IN (already found)
  LIMIT (limit - results.length)
  → "Hộ kinh doanh cùng huyện"

Step 3: province level, different district (proximity: 'province') [if results < limit]
  SELECT * FROM storefronts
  WHERE province_id = origin.province_id
    AND district_id != origin.district_id AND is_public = true
    AND id NOT IN (already found)
  LIMIT (limit - results.length)
  → "Hộ kinh doanh trong tỉnh"
```

Maximum 3 queries. Most storefronts return full results at level 1 or 2. In early stages when density is low, level 3 ensures the section is never empty.

### Nearby proximity label (UI)

The `proximity` field on `NearbyStorefront` drives the section label:

```typescript
if (proximity === 'ward')     label = `Cùng xã ${ward.name}`
if (proximity === 'district') label = `Cùng huyện ${district.name}`
if (proximity === 'province') label = `Trong tỉnh ${province.name}`
```

This is transparent to the user and localised — they understand exactly why each result appeared.

### Nearby products (category-aware)

For the product page "Sản phẩm tương tự gần đây" section:

```
getNearbyProducts(origin, limit=6)

Step 1: same district + same category
Step 2: same province + same category (fill remaining)
```

Without category filter, this becomes noise ("nearby product" from a hardware store on a fruit page). Category matching is required.

---

## 5. Caching Strategy

VIO LOCAL has three distinct caching layers.

### Layer 1 — Materialized view (PostgreSQL, ~5min TTL)

`district_discovery_summary` is the most expensive query on the platform. The province page's district nav requires a GROUP BY across three large tables. The materialized view freezes this result and refreshes every 5 minutes.

```sql
-- Refresh (run via pg_cron or Supabase Edge Function cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY public.district_discovery_summary;
```

`CONCURRENTLY` allows read access during refresh — no page-blocking lock.

Setup pg_cron (Supabase supports it):
```sql
SELECT cron.schedule(
  'refresh-district-summary',
  '*/5 * * * *',  -- every 5 minutes
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.district_discovery_summary$$
);
```

### Layer 2 — HTTP Cache-Control (CDN/browser, ~60s TTL)

Discovery pages are public and change slowly. Add `Cache-Control` headers in the route:

```typescript
// TanStack Start route — set cache headers
export const Route = createFileRoute('/$provinceSlug')({
  loader: async ({ params }) => {
    const data = await getProvinceDiscovery(params.provinceSlug)
    return data
  },
  // TanStack Router loader stale time (client-side navigation cache)
  staleTime: 60_000,
})

// In the server response (via middleware or headers):
// Cache-Control: public, s-maxage=60, stale-while-revalidate=300
// s-maxage=60      → CDN serves cached for 60s
// stale-while-revalidate=300 → serve stale while fetching fresh for 5min
```

**Pages to cache:** Province, district, category+geo discovery pages.  
**Pages NOT to cache:** Owner dashboard, draft storefront previews, admin queues.

### Layer 3 — TanStack Query stale-while-revalidate (client-side)

For components that fetch discovery data client-side (load-more pagination, nearby sections):

```typescript
const { data } = useQuery({
  queryKey: ['province-storefronts', provinceId, page],
  queryFn: () => getProvinceStorefronts(supabase, provinceId, page),
  staleTime: 60_000,         // treat as fresh for 1 minute
  gcTime:    5 * 60_000,     // keep in memory for 5 minutes
})
```

**Geographic reference data** (provinces, districts lists) changes almost never:
```typescript
staleTime: 60 * 60_000   // 1 hour for geo reference data
```

### Cache invalidation triggers

| Event | What to invalidate |
|---|---|
| Storefront published | Province + district materialized view (next refresh picks it up) |
| Product created | Nothing — product pages are not cached at CDN level |
| Admin bulk import | `REFRESH MATERIALIZED VIEW` manually |
| District name change | Purge CDN cache for that district's slug |

---

## 6. Internal Linking Strategy

Internal links are not just navigation — they're how PageRank flows through the site. Every discovery page must link to adjacent pages in the hierarchy.

### Province page links

```
Province page (/dong-nai)
  ↓
  District nav: list all active districts with storefront count
    /dong-nai/xuan-loc (67 hộ kinh doanh)
    /dong-nai/tan-phu  (45 hộ kinh doanh)
    ...
  (data source: getActiveDistricts() → district_discovery_summary)

  ↓
  Featured storefronts: first 12 results
    /ho-kinh-doanh/vuon-bo-ba-nam
    ...
```

### District page links

```
District page (/dong-nai/xuan-loc)
  ↓
  Breadcrumb: VIO LOCAL → /dong-nai → /dong-nai/xuan-loc
  ↓
  Storefront list: 20 per page
    /ho-kinh-doanh/{slug}
  ↓
  Back to province: /dong-nai
```

### Storefront page links

```
Storefront page (/ho-kinh-doanh/vuon-bo-ba-nam)
  ↓
  Breadcrumb: /dong-nai → /dong-nai/xuan-loc → this page
  ↓
  Products listed (getStorefrontProducts)
    /san-pham/{slug}
  ↓
  Nearby storefronts (getNearbyStorefronts, limit=6)
    /ho-kinh-doanh/{nearby-slug}  ← "Hộ kinh doanh cùng huyện"
```

### Product page links

```
Product page (/san-pham/bo-sap-dak-lak)
  ↓
  Breadcrumb: /dak-lak → /dak-lak/ea-hleo → /ho-kinh-doanh/{storefront} → this page
  ↓
  "Từ cùng cửa hàng" (getStorefrontProducts, excludeId=this, limit=4)
    /san-pham/{sibling-slug}
  ↓
  "Sản phẩm tương tự gần đây" (getNearbyProducts, limit=6)
    /san-pham/{nearby-slug}
  ↓
  Back to storefront: /ho-kinh-doanh/{slug}
  Back to district:   /dak-lak/ea-hleo
```

### Why count badges on district links matter

```html
<!-- ✅ With count — rich anchor text + content signal -->
<a href="/dong-nai/xuan-loc">Huyện Xuân Lộc (67 hộ kinh doanh)</a>

<!-- ❌ Without count — thin anchor text, no signal -->
<a href="/dong-nai/xuan-loc">Huyện Xuân Lộc</a>
```

The count badge:
1. Tells users which districts are worth clicking (self-sorting navigation)
2. Embeds "hộ kinh doanh" as anchor text on 63+ province pages — thousands of internal links with this keyword
3. Signals page depth to Google (non-empty districts are worth crawling)

---

## 7. SEO-Safe Discovery Rules

### What gets indexed

```
✅ index  Province pages with ≥10 storefronts
✅ index  District pages with ≥3 storefronts
✅ index  Category+province pages with ≥3 listings
✅ index  Category+district pages with ≥2 listings
✅ index  Individual storefront pages (is_public = true)
✅ index  Individual product pages (is_available = true, storefront is_public = true)

❌ noindex  Any discovery page below the threshold (thin page)
❌ noindex  Paginated pages beyond page 1 (duplicate content risk)
❌ noindex  Search result pages (parameter-based, not canonical)
❌ noindex  Draft storefronts (is_public = false)
```

### Thin page guard in route loaders

```typescript
// In the /:provinceSlug route loader
const { items, total } = await getProvinceStorefronts(supabase, province.id)

if (isThinPage('province', total)) {
  // Still render the page for users who navigate here,
  // but mark it noindex so Google doesn't index empty pages
  return { items, total, robots: 'noindex, follow' }
}
return { items, total, robots: 'index, follow' }
```

### Pagination — page 1 only gets indexed

```typescript
// Page 1: indexed, canonical to itself
robots = 'index, follow'
canonical = `https://violocal.vn/${provinceSlug}`

// Page 2+: not indexed (duplicate structure, thin per-page content)
robots = 'noindex, follow'
canonical = `https://violocal.vn/${provinceSlug}`  // points to page 1
```

---

## 8. Performance Targets

| Query | Target | Achieved with |
|---|---|---|
| Province storefronts (page 1) | ≤30ms | `idx_storefronts_province_sort` |
| District storefronts (page 1) | ≤20ms | `idx_storefronts_district_sort` |
| Province + category products | ≤40ms | `idx_products_province_category` |
| Province district summary | ≤5ms | materialized view |
| Nearby fill-up (3 queries) | ≤60ms total | ward/district/province indexes |
| Segment disambiguation | ≤5ms | slug index lookups |
| Full province page SSR | ≤150ms | all of the above |

**Mobile 3G target:** First Contentful Paint ≤1.5s. This is achievable if SSR query time stays ≤150ms, because the HTML arrives pre-rendered (no client-side waterfall).

---

## 9. Anti-patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| `SELECT *` with no `LIMIT` on geo queries | Full table scan at scale | Always `LIMIT` + `OFFSET` |
| `ORDER BY created_at` without geo index | Filesort on every request | Compound `(geo_col, created_at DESC)` index |
| `COUNT(*)` on every page load for nav | Expensive GROUP BY per request | `district_discovery_summary` materialized view |
| PostGIS radius for "nearby" | Crosses administrative boundaries; wrong mental model | Hierarchical fill-up |
| Elasticsearch for full-text search | Operational complexity, cost | Postgres `ilike` or `pg_trgm` for Phase 1 |
| Client-side discovery on SEO pages | Google can't crawl JavaScript-rendered results | SSR route loaders for all discovery pages |
| Caching owner dashboard | Shows stale is_public state | Never cache owner/admin pages |
| Index per column on all geo queries | Redundant when compound covers it | Audit and drop single-column after compound is confirmed used |
