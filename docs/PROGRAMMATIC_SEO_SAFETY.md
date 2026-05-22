# Programmatic SEO Safety Architecture — VIO LOCAL

System-level safety architecture for a platform that generates discovery pages
programmatically across geographic hierarchy and entity types.

This document is the master safety reference. It consolidates rules from
existing docs and adds what those docs do not cover:
stale-page degradation, index health monitoring, crawl budget management,
and the comprehensive page-type safety matrix.

Related docs:
- [`THIN_PAGE_RULES.md`](THIN_PAGE_RULES.md) — three-state model, per-page-type thresholds
- [`ROBOTS_INDEXING.md`](ROBOTS_INDEXING.md) — robots.txt rules, sitemap architecture
- [`CONTENT_SEO.md`](CONTENT_SEO.md) — crop-region and seasonal content pages
- [`LAND_SEO.md`](LAND_SEO.md) — land listing discovery
- `src/services/seo/thin-page.ts` — `THRESHOLDS`, `resolvePageDecision()`

---

## The Problem with Programmatic SEO at Scale

A hyperlocal platform generates pages across three axes simultaneously:

```
Geographic axis:
  63 provinces × 700+ districts × ~10,000 wards = millions of potential pages

Category axis:
  50+ categories × (provinces + districts) = 75,000+ potential pages

Entity axis:
  Storefronts × Products × Services × Land listings = millions of entity pages
```

At Phase 1 launch, most potential URLs have zero content. As the platform grows,
page quality fluctuates: storefronts open, close, go private, get banned. Pages
that qualified last month may be thin today.

**Without a safety architecture:**
- Google indexes thousands of near-empty pages
- Thin pages dilute the domain authority earned by quality pages
- Crawl budget is consumed by worthless URLs
- Recovery from a thin-content penalty takes 6–12 months

**The four invariants this architecture enforces:**

```
1. A page with no content never enters the index.
2. A page that degrades below threshold exits the index within one crawl cycle.
3. Only pages that are in the index are linked to from other indexed pages.
4. Every page has exactly one canonical URL — never manipulated to deduplicate.
```

---

## 1. Quality Thresholds

### 1.1 Threshold table — all page types

`src/services/seo/thin-page.ts` is the single source of truth. Below is the
complete threshold reference, including page types not yet in `thin-page.ts`:

| Page type | `THRESHOLDS` key | Gate metric | NOT-FOUND | THIN (noindex) | INDEXED |
|---|---|---|---|---|---|
| Province discovery | `province` | storefronts | 0 | 1–9 | ≥ 10 |
| District discovery | `district` | storefronts | 0 | 1–2 | ≥ 3 |
| Category × province | `categoryProvince` | listings | 0 | 1–2 | ≥ 3 |
| Category × district | `categoryDistrict` | listings | 0 | 1 | ≥ 2 |
| Land province | `landProvince` | listings | 0 | 1–4 | ≥ 5 |
| Land district | `landDistrict` | listings | 0 | 1 | ≥ 2 |
| Crop × province | `cropProvince` | storefronts | 0 | 1–4 | ≥ 5 |
| National crop | `cropNational` | qualified provinces | 0 | 1 | ≥ 2 |
| Seasonal | `seasonProvince` | storefronts + in-season | 0 | 1–2 or off-season | ≥ 3 + in-season |

Province nav threshold (`provinceNavDistrict: 3`) is a **link gate**, not a page gate.
It prevents indexed province pages from linking to noindex district pages.

### 1.2 Threshold enforcement — three layers

Every threshold is checked in three independent layers. No single layer is sufficient.

```
Layer 1: Route loader  ← enforced on every SSR render
  resolvePageDecision(type, count, pageIndex, canonicalUrl)
  → not-found: throw notFound()
  → noindex:   return { robots: 'noindex, follow', ... }
  → indexed:   return { robots: 'index, follow', ... }

Layer 2: Nav link guard  ← enforced in discovery page components
  shouldShowInProvinceNav(districtStorefrontCount)
  → false if count < THRESHOLDS.provinceNavDistrict
  → never render an <a> to a noindex page from an indexed page

Layer 3: Sitemap builder  ← enforced at sitemap generation time
  shouldIncludeInSitemap(type, count, pageIndex)
  → false for noindex pages and paginated pages
  → sitemap is a positive-inclusion list of only indexed pages
```

Layers 1 and 3 are both computed from live DB data on every render / sitemap refresh.
**The robots meta directive is never hardcoded or statically cached** — it is always
the output of `resolvePageDecision()` called with the current count from the database.

### 1.3 Threshold philosophy

Thresholds are deliberately conservative:

- `province: 10` — a province page with 3 storefronts is not meaningful discovery;
  users who find it will not engage; it reflects poorly on the province as a location
- `district: 3` — two storefronts is the minimum to justify a district page; one
  is just a duplicate of the storefront page with extra navigation
- `cropProvince: 5` — content pages claim editorial authority; a content page with
  2 storefronts is not authoritative on a topic

Thresholds are NOT adjusted upward over time as the platform grows. A province with
exactly 10 storefronts in Year 3 deserves an indexed page just as much as in Year 1.
Lowering thresholds retroactively degrades the index; raising them is never needed
because the bar is already set for quality.

---

## 2. Noindex Rules

### 2.1 Structural noindex — always applied regardless of count

These pages are always `noindex, follow` regardless of how many listings they have:

```
Paginated pages — page 2+
  robots: noindex, follow
  canonical: → page 1 URL
  rationale: Identical structure; differentiated only by offset. Zero ranking value.

Parameter-filtered variants — ?sort=, ?filter=, ?tab=
  robots: noindex, follow
  canonical: → clean URL (no params)
  rationale: Same content reordered. Duplicate. Blocked at robots.txt for known params.

Preview routes — /ho-kinh-doanh/tao-moi, /ho-kinh-doanh/:slug/xem-truoc
  robots: noindex, nofollow
  canonical: self (not the live storefront page — preview ≠ canonical)
  rationale: Draft content. nofollow prevents crawling linked profiles.

Auth/account routes
  robots: noindex, nofollow
  rationale: No public content. Blocked in robots.txt but belt-and-suspenders.
```

### 2.2 Content-gate noindex — applied when count < threshold

```
Discovery pages below threshold
  robots: noindex, follow
  canonical: self
  rationale: Page is real but thin. 'follow' preserves link equity from listed entities.
             Self-canonical prevents false duplicate signal to province page.

Seasonal pages out of harvest window
  robots: noindex, follow
  canonical: self
  rationale: Same URL, same slug, different time context. Preserves URL permanence.

Content pages below storefront threshold
  robots: noindex, follow
  canonical: self
  rationale: Cross-entity page without commerce anchor is thin regardless of template quality.
```

### 2.3 Draft entity noindex

```
Storefront — is_public = false
  robots: noindex, nofollow
  canonical: self
  rationale: Owner hasn't published. nofollow prevents crawling linked social profiles.

Land listing — is_public = false OR moderation_status != 'approved'
  robots: noindex, nofollow
  canonical: self
  rationale: Unmoderated land listings may be spam. nofollow at draft stage.

Product / Service — is_available = false OR storefront is_public = false
  robots: noindex, follow
  canonical: self
  rationale: Temporarily unavailable ≠ spam. 'follow' maintains link equity.
             Owner may re-enable availability.
```

### 2.4 noindex vs. 404 — the decision boundary

```
404 (throw notFound()):
  count = 0          — no entities exist at this URL
  invalid slug/param — param doesn't match any DB record
  denied by gate     — crop not in province's allowlist, season wrong province

noindex, follow:
  count in [1, threshold) — entities exist but below quality threshold
  out-of-season page      — content valid, timing wrong
  paginated beyond page 1 — content valid, pagination duplicate

NEVER:
  404 a page because its count is below threshold but above 0
  noindex a page because its count is 0 (should be 404)
```

---

## 3. Canonical Strategy

### 3.1 The one rule

```
canonical = self — for every page that exists (200 response)
```

The only exceptions are mechanical duplicates created by the system itself:

```
EXCEPTION 1: Pagination
  Page 2+ canonical → /province-slug (page 1)
  Page 1 canonical  → /province-slug (self)

EXCEPTION 2: Parameter variants
  /dong-nai?sort=newest     canonical → /dong-nai
  /dong-nai?filter=verified canonical → /dong-nai
```

### 3.2 Why canonical is never manipulated for content deduplication

A common incorrect approach: point thin district pages to their parent province page.

```
❌ WRONG:
  /dak-lak/ea-kar (2 storefronts, noindex)
  canonical → /dak-lak
  "They're related, so the province gets the equity."

✅ CORRECT:
  /dak-lak/ea-kar (2 storefronts, noindex)
  canonical → /dak-lak/ea-kar (self)
  robots: noindex, follow
```

**Why the wrong approach causes harm:**
1. It tells Google that `/dak-lak` IS the Ea Kar content. That is factually false.
2. If `/dak-lak/ea-kar` later grows to 10 storefronts and becomes indexed,
   you now have a canonical that was pointing elsewhere — correcting it confuses
   Google and causes temporary ranking loss.
3. The province page gains false duplicate signal that can dilute its own ranking.

`noindex` alone is the correct instrument for thin pages. It says "don't index this URL"
without claiming another page is its canonical twin.

### 3.3 Canonical URL construction rules

```typescript
// Discovery pages — always clean slug URL, no trailing slash, no params
canonical = `${SITE_URL}/${provinceSlug}`
canonical = `${SITE_URL}/${provinceSlug}/${districtSlug}`
canonical = `${SITE_URL}/${provinceSlug}/${categorySlug}`

// Entity detail pages — slug URL, no query params
canonical = `${SITE_URL}/ho-kinh-doanh/${storefrontSlug}`
canonical = `${SITE_URL}/dat-nong-nghiep/${listingSlug}`

// Paginated discovery — page 1 URL (no page param)
canonical = `${SITE_URL}/${provinceSlug}`   // for page 2, 3, etc.

// Content pages
canonical = `${SITE_URL}/nong-san/${cropSlug}/${provinceSlug}`
canonical = `${SITE_URL}/mua-vu/${seasonSlug}`
```

**Canonical URLs are constructed in the route loader, not the component.**
They are part of `resolvePageDecision()` output and set via TanStack Start's
`head` config. They are never generated client-side.

### 3.4 Trailing slash consistency

```
https://violocal.vn/dong-nai     ← canonical (no trailing slash)
https://violocal.vn/dong-nai/    ← 301 → canonical
```

Enforce at the server/middleware layer. The canonical tag in `<head>` always uses
the non-trailing-slash version. This prevents split PageRank between two technically
different URLs that serve identical content.

---

## 4. Duplicate Prevention

### 4.1 Geographic duplicate sources

| Duplicate type | Cause | Prevention |
|---|---|---|
| Province slug collision | Two provinces with same romanised name | DB UNIQUE constraint on `provinces.slug` |
| District slug collision | Two districts in same province, same slug | DB UNIQUE constraint on `(province_id, slug)` |
| Province/listing slug collision | `/dat-nong-nghiep/:segment` ambiguous | Server-side resolver checks province first; listing slugs include district+year suffix |
| Old admin boundary slugs | Govt reform → district merged or renamed | `geographic_aliases` table → 301 redirect |

### 4.2 Category duplicate sources

| Duplicate type | Cause | Prevention |
|---|---|---|
| Category × province duplicates storefront discovery | `/dong-nai/ca-phe` vs `/ho-kinh-doanh/dong-nai/ca-phe` | Different URL structures, different intents, different canonical — not duplicates |
| Content page duplicates category × province | `/nong-san/ca-phe/dak-lak` vs `/dak-lak/ca-phe` | Different entity scope (cross-entity vs. storefronts-only) — not duplicates; cross-link each other |
| District category page duplicates province | `/dong-nai/xuan-loc/ca-phe` vs `/dong-nai/ca-phe` | Threshold gates ensure district page only exists if it has its own qualifying content |

### 4.3 Cross-entity duplicate prevention

Discovery routes across the geo hierarchy can surface overlapping content
at different granularities. The invariant is: **each page covers exactly its
named scope, no more, no less.**

```
/dong-nai          → storefronts in Đồng Nai province (all categories)
/dong-nai/xuan-loc → storefronts in Xuân Lộc district only
/dong-nai/trai-cay → storefronts in Đồng Nai selling trái cây

These three pages have different query scopes. They are not duplicates.
They are allowed to share some storefront listings — Google understands
geo-category hierarchy.
```

The duplicate risk is NOT from hierarchical overlap — it's from
**parameter-based variants of the same URL**:

```
❌ DUPLICATE RISK:
  /dong-nai              → 20 storefronts
  /dong-nai?sort=newest  → same 20 storefronts, different order
  /dong-nai?tab=products → same storefronts, different tab

✅ SOLUTION:
  /dong-nai                     → indexed, canonical self
  /dong-nai?sort=newest         → noindex + canonical → /dong-nai
  /dong-nai?tab=products        → noindex + canonical → /dong-nai
  Sort/tab parameters also blocked in robots.txt
```

### 4.4 Hreflang — not applicable

VIO LOCAL is Vietnamese-only (`og:locale = vi_VN`). There are no other language
versions. Do not add `hreflang` tags — they create maintenance overhead with zero
benefit when only one language exists.

```html
<!-- DO NOT add — creates false expectation of language alternates -->
<link rel="alternate" hreflang="vi" href="..." />

<!-- The HTML lang attribute is sufficient -->
<html lang="vi">
```

The `lang="vi"` on `<html>` in `__root.tsx` must be set before launch
(currently `lang="en"` — see PERFORMANCE_RULES.md §7.2).

### 4.5 URL normalisation rules

All these must 301 to the canonical form before the route renders:

```
/Dong-Nai          → /dong-nai          (lowercase enforcement)
/dong-nai/         → /dong-nai          (no trailing slash)
/dong-nai//        → /dong-nai          (double slash)
/dong%20nai        → /dong-nai          (URL encoding → slug)
```

Apply in Vercel `vercel.json` rewrites or a TanStack Start middleware layer —
not per-route. Normalising in each route loader is fragile and error-prone.

---

## 5. Thin-Page Prevention

### 5.1 System mechanics — how thin pages are prevented

Four independent gates run in sequence. All four must pass for a page to enter the index:

```
Gate A: Route loader — live DB count
  resolvePageDecision(type, count)
  Executes on every SSR render.
  No static generation — pages are always rendered from live DB data.

Gate B: Sitemap builder — live DB count at sitemap refresh time
  shouldIncludeInSitemap(type, count)
  Executes hourly via the sitemap route handler.
  A page absent from the sitemap is not submitted to Google for crawling.

Gate C: Nav link guard — live DB count in province page component
  shouldShowInProvinceNav(count)
  If a district drops below provinceNavDistrict threshold, its link disappears
  from the province page on next SSR render. Google loses the link path in.

Gate D: Partial unique index (saved_items, reports)
  Does not apply to discovery pages.
  Applies to user-generated entity pages — DB-level deduplication.
```

### 5.2 Anti-enumeration — never pre-generate all geo URLs

```typescript
// ❌ WRONG — generates all 63 province routes regardless of content
const provinces = await getAllProvinces()   // returns 63 rows
for (const p of provinces) {
  preRenderProvincePage(p.slug)             // 59 of these are 404 / empty at launch
}

// ✅ CORRECT — route loader checks content at request time
export const Route = createFileRoute('/$provinceSlug')({
  loader: async ({ params, context }) => {
    const province = await getProvinceBySlug(context.supabase, params.provinceSlug)
    if (!province) throw notFound()

    const { total } = await getProvinceStorefronts(context.supabase, province.id, 0)
    const decision  = resolvePageDecision('province', total, 0, canonicalUrl)

    if (decision.state === 'not-found') throw notFound()
    return { province, page: ..., decision }
  },
})
```

**Specific anti-generation rules:**

```
DO NOT pre-generate:
  ❌ All 63 province discovery pages
  ❌ All ~700 district discovery pages
  ❌ All 50 × 63 = 3,150 category × province pages
  ❌ All crop × province combinations not in CROPS[crop].provinces allowlist
  ❌ All seasonal pages when not in harvest window

DO generate on demand (request-time):
  ✅ Province pages — rendered when requested, 404 if no content
  ✅ District pages — rendered when requested, gated by district threshold
  ✅ Category × geo — rendered when requested, gated by categoryProvince threshold
  ✅ Crop × province — rendered when requested, gated by cropProvince threshold
```

### 5.3 Empty-state rendering rules

```
Count = 0 → HTTP 404
  Never render an empty-state placeholder for a URL with zero content.
  "No businesses found in this area yet!" pages accumulate as thin-content
  signals that dilute the entire domain.

Count in [1, threshold) → HTTP 200 + noindex, follow
  The page renders genuinely useful content:
  - All existing listings (1 to N)
  - Geographic context text (district belongs to province; static, no API call)
  - Links to nearby active areas (above threshold)
  - Registration CTA ("Add your business to this area")
  The noindex signal tells Google not to index it yet.
  The follow signal lets Google crawl and discover the listed entities.

Count ≥ threshold → HTTP 200 + index, follow
  Full SEO treatment.
```

---

## 6. Stale-Page Handling

This section covers what happens **after** a page is indexed and its content
quality later degrades below threshold. This is the most common failure mode
in live programmatic SEO deployments.

### 6.1 Degradation scenarios

```
Scenario A: Province drops from 12 → 7 storefronts
  Three storefronts closed. is_public = false. Province still indexed.
  → Province page now serves noindex, follow on next render.
  → Sitemap excludes it on next hourly refresh.

Scenario B: District drops from 5 → 1 storefront
  Four storefronts unpublished. District was indexed.
  → District page serves noindex, follow.
  → Province nav link to this district disappears.
  → Province page no longer links to it.

Scenario C: Seasonal page enters off-season
  cà phê harvest ends (January). Seasonal page was indexed.
  → Seasonal page serves noindex, follow (month check fails).
  → Sitemap excludes it until October (harvest starts again).

Scenario D: Category × province drops to 0
  All products in a category become unavailable (seasonal stock gone).
  → Page serves 404. Category link removed from nav.
```

### 6.2 Freshness window — how quickly Google gets the correct signal

```
Step 1: Content changes (storefront unpublishes)
  → DB updated immediately

Step 2: SSR route loader reads live count
  → Serves correct robots meta on next render
  → Cache TTL: s-maxage=60 (1 minute) for discovery pages

Step 3: Vercel Edge cache expires
  → Fresh render with correct noindex directive served
  → Latency: ≤ 1 minute

Step 4: Google re-crawls the page (next crawl cycle)
  → Sees noindex directive
  → Drops from index
  → Latency: hours to days depending on crawl frequency

Step 5: Sitemap refreshes (hourly)
  → Page removed from sitemap
  → Google stops re-crawling it voluntarily
  → Latency: 1 hour
```

**The freshness guarantee:** Within 1 minute of degradation, any subsequent crawl
by Google will see the correct `noindex` directive. The page is removed from the
sitemap within the hour. No manual intervention required.

### 6.3 Cache TTL constraint for discovery pages

Discovery pages must use `s-maxage=60` (NOT 300) to ensure the robots meta
is refreshed within one minute of content degradation:

```typescript
// In TanStack Start API handler for discovery routes:
'Cache-Control: public, s-maxage=60, stale-while-revalidate=300'
```

`stale-while-revalidate=300` allows Vercel to serve stale content for 5 minutes
while revalidating in the background — users still get fast responses. But the
`s-maxage=60` ensures Google gets a fresh render within 1 minute.

**Entity detail pages** use `s-maxage=60` for the same reason — a storefront
that goes `is_public = false` should serve `noindex, nofollow` within a minute.

### 6.4 Stale-page detection queries

Run these in the Supabase SQL editor (or as a monitoring job) to identify
pages currently serving a different state than their DB content warrants:

```sql
-- Provinces that were indexed (≥10) but have degraded (1–9)
-- These pages are now serving noindex — verify they're out of sitemap
SELECT
  p.slug                AS province_slug,
  COUNT(s.id)           AS storefront_count,
  'was_indexed_now_thin' AS status
FROM provinces p
LEFT JOIN storefronts s
       ON s.province_id = p.id
      AND s.is_public   = true
GROUP BY p.id, p.slug
HAVING COUNT(s.id) BETWEEN 1 AND 9
ORDER BY storefront_count DESC;


-- Districts that are thin (1–2) but province page is indexed (≥10)
-- Province page may still be linking to these — verify nav guard is working
SELECT
  pr.slug               AS province_slug,
  d.slug                AS district_slug,
  COUNT(s.id)           AS storefront_count
FROM districts d
JOIN provinces pr ON pr.id = d.province_id
LEFT JOIN storefronts s
       ON s.district_id = d.id
      AND s.is_public   = true
JOIN (
  -- Only provinces that are themselves indexed
  SELECT province_id
  FROM storefronts
  WHERE is_public = true
  GROUP BY province_id
  HAVING COUNT(*) >= 10
) indexed_provinces ON indexed_provinces.province_id = d.province_id
GROUP BY pr.slug, d.id, d.slug
HAVING COUNT(s.id) BETWEEN 1 AND 2
ORDER BY province_slug, storefront_count;


-- Land provinces that are thin (1–4)
SELECT
  p.slug                AS province_slug,
  COUNT(ll.id)          AS listing_count
FROM provinces p
LEFT JOIN land_listings ll
       ON ll.province_id       = p.id
      AND ll.is_public         = true
      AND ll.moderation_status = 'approved'
GROUP BY p.id, p.slug
HAVING COUNT(ll.id) BETWEEN 1 AND 4;


-- Storefronts that are public but have zero products/services
-- (Storefront pages are indexed but have very thin content)
SELECT
  s.slug,
  s.name,
  p.slug AS province_slug,
  (SELECT COUNT(*) FROM products WHERE storefront_id = s.id AND is_available = true) AS product_count,
  (SELECT COUNT(*) FROM services WHERE storefront_id = s.id AND is_available = true) AS service_count
FROM storefronts s
JOIN provinces p ON p.id = s.province_id
WHERE s.is_public = true
  AND (
    SELECT COUNT(*) FROM products WHERE storefront_id = s.id AND is_available = true
  ) = 0
  AND (
    SELECT COUNT(*) FROM services WHERE storefront_id = s.id AND is_available = true
  ) = 0
ORDER BY s.created_at DESC
LIMIT 50;
```

### 6.5 Recovery — automatic re-indexing

When a degraded page's content grows back above threshold, no manual action is needed:

```
Storefront publishes → count crosses threshold →
  Route loader returns 'indexed' state →
  Serves 'index, follow' on next render →
  Sitemap includes it on next hourly refresh →
  Google crawls it on next crawl cycle →
  Page re-enters index
```

**No manual Google Search Console action needed.** The system is self-healing.
The only time manual intervention is required is if Google has soft-penalised
a URL for repeated thin content — in that case, submit the URL for re-indexing
via Search Console once the content is confirmed stable.

### 6.6 Stale-page anti-patterns

```
❌ Redirecting thin pages to their province page
  301 /dak-lak/ea-kar → /dak-lak
  Wrong: destroys the URL permanently. When the district grows to 3 storefronts,
  the 301 must be reversed — very hard to undo from Google's cache.

❌ Serving 410 Gone for temporarily-thin pages
  410 /dak-lak/ea-kar
  Wrong: 410 signals permanent deletion. Google removes it from index permanently.
  When the district recovers, the URL is disadvantaged.

✅ Serve noindex, follow — transient signal, auto-recovers
  HTTP 200 + <meta name="robots" content="noindex, follow">
  Google respects this immediately but doesn't permanently mark the URL as gone.
  When the page crosses threshold, the next render serves index, follow.
  Google re-indexes within days.
```

---

## 7. Crawl Budget Management

### 7.1 Crawl budget allocation

Google's crawl budget is limited by the domain's authority and page count.
For a new domain, allocate budget carefully:

```
Priority 1 — Entity detail pages (highest value)
  /ho-kinh-doanh/:slug         — unique per storefront, high value
  /san-pham/:slug              — product detail
  /dat-nong-nghiep/:slug       — land listing detail

Priority 2 — Discovery pages (geographic backbone)
  /:province-slug              — province discovery
  /:province-slug/:district    — district discovery

Priority 3 — Category × geo discovery
  /:province-slug/:category    — category × province

Priority 4 — Content pages
  /nong-san/:crop/:province    — crop × province
  /mua-vu/:season              — seasonal

Priority 5 — Hub pages
  /nong-san, /dat-nong-nghiep  — content hubs
```

Sitemap priority in `sitemap.xml` signals this hierarchy:

```typescript
// src/services/seo/sitemap.ts
const PRIORITY = {
  storefront:      0.9,
  product:         0.8,
  landListing:     0.8,
  service:         0.7,
  provinceDiscovery: 0.7,
  districtDiscovery: 0.6,
  categoryProvince:  0.5,
  cropProvince:      0.6,
  seasonal:          0.7,   // higher during harvest — high commercial intent
  hub:               0.4,
} as const
```

### 7.2 Crawl budget protection rules

```
1. Paginated pages: noindex, follow + not in sitemap
   Google crawls for link discovery but doesn't allocate index crawl budget.

2. Thin pages: noindex, follow + not in sitemap
   Google doesn't prioritise re-crawling noindex pages frequently.

3. Admin/dashboard: blocked in robots.txt
   Google never crawls these — zero crawl budget wasted.

4. Parameter variants: blocked in robots.txt + noindex + canonical to clean URL
   Triple protection — belt, suspenders, and zip tie.

5. Nav links filtered: indexed pages only link to indexed pages
   Crawl budget flows from indexed pages to other indexed pages.
   No crawl budget leaks to noindex pages via internal links.
```

### 7.3 Sitemap structure — crawl budget amplification

Four sitemaps, each focused on a specific entity type:

```
/sitemap.xml                     ← sitemap index (references the four below)
/sitemap-geo.xml                 ← province + district discovery pages
/sitemap-entities.xml            ← storefront + product + service + land listing pages
/sitemap-land.xml                ← land listing province + district discovery
/sitemap-content.xml             ← crop × province + seasonal pages
```

Split sitemaps allow Google to prioritise crawl budget independently per type.
If entity sitemaps are crawled first, new storefronts enter the index faster.

**Sitemap size limits:**
- Max 40,000 URLs per sitemap file (safety margin below Google's 50,000 limit)
- If entity count exceeds 40,000 per type, split into numbered sitemaps:
  `/sitemap-entities-1.xml`, `/sitemap-entities-2.xml`

### 7.4 `changefreq` and `lastmod` — accurate signalling

```typescript
// sitemap entries — changefreq reflects actual update frequency
{
  url:        storefrontUrl,
  lastmod:    storefront.updated_at,   // exact timestamp from DB
  changefreq: 'weekly',               // storefronts change infrequently
  priority:   0.9,
}

{
  url:        discoveryPageUrl,
  lastmod:    mostRecentStorefrontUpdate,  // date of newest storefront in that geo
  changefreq: 'daily',               // listings change daily as storefronts open/close
  priority:   0.7,
}
```

`lastmod` must be a real DB timestamp — not `new Date()`.
Setting `lastmod = now()` on every sitemap refresh signals "this page changes
constantly" which causes Google to crawl it too frequently, wasting crawl budget.

---

## 8. Comprehensive Safety Matrix

Complete reference for every page type. Use this as the checklist when adding
a new route to the platform.

| Page type | URL pattern | Threshold key | On 0 | On thin | On indexed | Canonical | In sitemap |
|---|---|---|---|---|---|---|---|
| Province discovery | `/:province` | `province` | 404 | noindex,follow | index,follow | self | ✅ |
| District discovery | `/:province/:district` | `district` | 404 | noindex,follow | index,follow | self | ✅ |
| Category × province | `/:province/:category` | `categoryProvince` | 404 | noindex,follow | index,follow | self | ✅ |
| Category × district | `/:province/:district` (cat filter) | `categoryDistrict` | 404 | noindex,follow | index,follow | self | ✅ |
| Storefront detail | `/ho-kinh-doanh/:slug` | `is_public` | 404 | n/a | index,follow | self | ✅ |
| Storefront draft | `/ho-kinh-doanh/:slug` | `is_public=false` | n/a | noindex,nofollow | n/a | self | ❌ |
| Product detail | `/san-pham/:slug` | `is_available+sf_public` | 404 | n/a | index,follow | self | ✅ |
| Product unavailable | `/san-pham/:slug` | `is_available=false` | n/a | noindex,follow | n/a | self | ❌ |
| Service detail | `/dich-vu/:slug` | `is_available+sf_public` | 404 | n/a | index,follow | self | ✅ |
| Land listing detail | `/dat-nong-nghiep/:slug` | `is_public+approved` | 404 | n/a | index,follow | self | ✅ |
| Land listing unmoderated | `/dat-nong-nghiep/:slug` | `approved=false` | n/a | noindex,nofollow | n/a | self | ❌ |
| Land province | `/dat-nong-nghiep/:province` | `landProvince` | 404 | noindex,follow | index,follow | self | ✅ |
| Land district | `/dat-nong-nghiep/:province/:district` | `landDistrict` | 404 | noindex,follow | index,follow | self | ✅ |
| Crop × province | `/nong-san/:crop/:province` | `cropProvince` | 404 | noindex,follow | index,follow | self | ✅ |
| National crop | `/nong-san/:crop` | `cropNational` | 404 | noindex,follow | index,follow | self | ✅ |
| Crop hub | `/nong-san` | any active crop | 404 | noindex,follow | index,follow | self | ✅ |
| Seasonal | `/mua-vu/:season` | `seasonProvince` + in-season | 404 | noindex,follow | index,follow | self | ✅ in-season only |
| Seasonal out-of-season | `/mua-vu/:season` | off-season months | n/a | noindex,follow | n/a | self | ❌ |
| Discovery page 2+ | any | n/a | n/a | noindex,follow | noindex,follow | → page 1 | ❌ |
| Param variant | `?sort=`, `?filter=` | n/a | n/a | noindex,follow | noindex,follow | → clean URL | ❌ |
| Saved items | `/dashboard/da-luu` | auth required | n/a | noindex,nofollow | n/a | self | ❌ |
| Owner dashboard | `/dashboard/` | auth required | n/a | noindex,nofollow | n/a | self | ❌ |

---

## 9. New Route Checklist

When adding a new programmatically generated route, verify all items:

```
Schema and data
[ ] Route has a corresponding DB query with a COUNT
[ ] Count is always live (not cached in component state)
[ ] Threshold key added to THRESHOLDS in thin-page.ts
[ ] Nav link guard added for any parent page that links to this page

Route loader
[ ] resolvePageDecision(newThresholdKey, count, pageIndex, canonicalUrl)
[ ] not-found: throw notFound()
[ ] noindex: return decision with robots: 'noindex, follow'
[ ] indexed: return decision with robots: 'index, follow'
[ ] canonical URL constructed server-side in loader

Head config
[ ] <meta name="robots"> from decision.robots
[ ] <link rel="canonical" href={decision.canonical}>
[ ] <title>, <meta description> with live data from loader
[ ] JSON-LD with appropriate schema type
[ ] OG tags via ogToHeadMeta() from src/services/seo/og.ts

Sitemap
[ ] shouldIncludeInSitemap() returns false for page 2+ and noindex pages
[ ] New sitemap getter added to appropriate sitemap file
[ ] Sitemap entry includes real lastmod from DB (not Date.now())
[ ] changefreq reflects actual expected update frequency

Robots.txt
[ ] Management/edit routes for this entity blocked in robots.txt
[ ] No indexable param variants left unblocked

Stale-page monitoring
[ ] Detection query added to §6.4 monitoring checklist
[ ] Cache-Control: s-maxage=60 set on the route handler
```
