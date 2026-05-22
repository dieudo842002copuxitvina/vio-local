# Robots & Indexing Strategy — VIO LOCAL

## Overview

Three interlocking mechanisms protect index quality and crawl budget:

```
robots.txt            → structural blocks (paths and tracking params)
<meta name="robots">  → per-page thin/noindex signal (from thin-page.ts)
<link rel="canonical">→ duplicate prevention (from thin-page.ts)
sitemap.xml           → positive inclusion list (only indexed pages)
```

No single mechanism is sufficient alone. A page blocked in robots.txt can still be linked to and hurt PageRank flow. A canonical tag only works if Google crawls the page. Together they form a complete defense.

---

## robots.txt — Rule Map

File location: `public/robots.txt`  
Served at: `https://violocal.vn/robots.txt`

### Blocked paths

| Path pattern | Reason |
|---|---|
| `/dashboard/` | Authenticated UI — no public content |
| `/quan-ly/` | Storefront management dashboard |
| `/tai-khoan/` | Account settings |
| `/dang-nhap` | Login page |
| `/dang-ky` | Registration page |
| `/quen-mat-khau` | Password reset |
| `/xac-nhan/` | Email verification flows |
| `/admin/` | Internal admin panel |
| `/ho-kinh-doanh/tao-moi` | Create-storefront form |
| `/ho-kinh-doanh/*/chinh-sua` | Edit-storefront form |
| `/api/` | API endpoints |
| `/_server/` `/__vinxi/` `/_build/` | TanStack Start / Vinxi internals |

### Blocked query parameters

| Parameter | Reason |
|---|---|
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | UTM tracking — creates thousands of duplicate URLs |
| `fbclid` | Facebook click ID — appended by FB shares |
| `gclid` | Google click ID — appended by Google Ads |
| `msclkid` | Microsoft Ads click ID |
| `ref` | Internal referral tracking |
| `sort` | Re-orders same discovery content — duplicate |
| `filter` | Refilters same discovery content — duplicate |
| `tab` | Client-side tab state — duplicate content |

### Why pagination (`?page=`) is NOT blocked

`?page=2` and beyond carry `<meta name="robots" content="noindex, follow">` and a `canonical` pointing to page 1 (enforced by `thin-page.ts`). Blocking pagination in `robots.txt` would prevent Google from discovering linked storefronts on those pages. `noindex, follow` is the correct instrument — Google crawls for link discovery but doesn't index.

### Crawler-specific rules

| Crawler | Rule | Reason |
|---|---|---|
| AhrefsBot, SemrushBot, MajesticSEO | `Crawl-delay: 10` | SEO tools run frequent crawls — throttle to protect server |
| DotBot, MJ12bot, PetalBot | `Disallow: /` | Aggressive scrapers, ignore noindex, no attribution |

---

## Per-Page Robots Meta (`<meta name="robots">`)

Managed entirely by `src/services/seo/thin-page.ts` via `resolvePageDecision()`.

| Page state | Robots directive | Canonical |
|---|---|---|
| `indexed` | `index, follow` | self |
| `noindex` | `noindex, follow` | self (not parent — see below) |
| `not-found` | Page throws 404 — no meta rendered | — |
| Paginated (page 2+) | `noindex, follow` | page 1 URL |
| Storefront (draft) | `noindex, nofollow` | self |

### Why noindex canonical = self (not parent)

A thin district page for `/dak-lak/ea-kar` with 2 storefronts could point `canonical → /dak-lak` (the province page). This would be wrong:

1. Google treats canonical as a **duplicate signal** — it would learn that `/dak-lak/ea-kar` is a copy of `/dak-lak`, and might merge their link equity incorrectly.
2. If the district later grows past the threshold, the canonical must update — creating a flip that can take weeks for Google to process.
3. `noindex, follow` already prevents indexing while letting Google follow outbound links.

**Rule: canonical always points to self for noindex pages.**

---

## Canonical URL Rules

| Scenario | Canonical |
|---|---|
| Province page, page 1 | `https://violocal.vn/dak-lak` |
| Province page, page 2 | `https://violocal.vn/dak-lak` (→ page 1) |
| District page (indexed) | `https://violocal.vn/dak-lak/buon-ma-thuot` |
| District page (noindex) | `https://violocal.vn/dak-lak/ea-kar` (self) |
| Storefront | `https://violocal.vn/ho-kinh-doanh/ca-phe-buon-me` |
| Product | `https://violocal.vn/san-pham/robusta-dak-lak` |
| Category+Province | `https://violocal.vn/dak-lak/ca-phe` |
| Category+District | `https://violocal.vn/dak-lak/buon-ma-thuot/ca-phe` |

All canonical tags are absolute URLs (required by Google). Relative canonicals are silently ignored by some crawlers.

---

## Sitemap Architecture

### File map

```
/sitemap.xml                 ← index: lists all four sub-sitemaps
/sitemap-geo.xml             ← province + district + category+geo pages
/sitemap-storefronts.xml     ← all public storefronts
/sitemap-products.xml        ← all available products
/sitemap-services.xml        ← all available services
```

### Why four sitemaps, not one

1. **Separated change velocity.** Geo pages change daily (new storefronts push districts over thresholds). Storefront/product pages change weekly. Separate files let Google prioritize crawls correctly.
2. **File size limit.** Google's limit is 50,000 URLs or 50MB per sitemap file. Splitting by entity type keeps each file small and makes partial re-submission possible.
3. **Error isolation.** A DB error in geo sitemap generation doesn't break storefront sitemaps.

### Sitemap inclusion rules

A URL appears in the sitemap **only if**:
- `getPageState(type, count) === 'indexed'` (passes thin-page threshold)
- `pageIndex === 0` (no pagination in sitemap — page 1 only)
- Content is publicly visible (`is_public = true` / `is_available = true`)

This exactly mirrors the `shouldIncludeInSitemap()` function in `thin-page.ts`.

### Priority and changefreq values

| URL type | Priority | Changefreq | Rationale |
|---|---|---|---|
| Province pages | 0.9 | daily | New storefronts push district counts above thresholds |
| District pages | 0.8 | daily | Same — counts change as storefronts join |
| Storefronts | 0.8 | weekly | Business info changes occasionally |
| Category+Province | 0.7 | weekly | Stable once above threshold |
| Category+District | 0.6 | weekly | Stable once above threshold |
| Products | 0.6 | weekly | Availability and pricing changes |
| Services | 0.6 | weekly | Service area / availability changes |

> **Note:** Google's documentation states they ignore `<priority>` and `<changefreq>` from sitemaps submitted via Search Console. These values are informational for Bing and other crawlers. `<lastmod>` is the only field Google consistently acts on — keep it accurate.

### Sitemap generation: server routes

```typescript
// src/routes/sitemap.xml.ts (TanStack Start server file route)
export const Route = createServerFileRoute('/sitemap.xml').methods({
  GET: async () => new Response(buildSitemapIndex(), {
    headers: {
      'Content-Type':  SITEMAP_CONTENT_TYPE,
      'Cache-Control': SITEMAP_CACHE_CONTROL,
    },
  }),
})

// src/routes/sitemap-storefronts.xml.ts
export const Route = createServerFileRoute('/sitemap-storefronts.xml').methods({
  GET: async ({ context }) => {
    const entries = await getStorefrontSitemapEntries(context.supabase)
    return new Response(buildSitemapXml(entries), {
      headers: {
        'Content-Type':  SITEMAP_CONTENT_TYPE,
        'Cache-Control': SITEMAP_CACHE_CONTROL,
      },
    })
  },
})
```

### Caching

Sitemap responses carry `Cache-Control: public, max-age=3600, s-maxage=3600`.

- **Browser / proxy cache:** 1 hour — prevents hammering the DB on repeated Googlebot visits
- **Edge cache (Cloudflare):** 1 hour via `s-maxage` — survives bot crawl waves
- **No stale-while-revalidate:** Sitemaps must be accurate. A stale sitemap pointing to deleted content is worse than a slow one.

### Sitemap helper SQL functions

Geo sitemap generation requires GROUP BY + HAVING aggregations that PostgREST cannot express. Three helper functions are defined in `20260522000002_sitemap_helpers.sql`:

| Function | Used for |
|---|---|
| `get_province_storefront_counts()` | Province pages threshold check |
| `get_category_province_counts(entity, min)` | Category+Province page inclusion |
| `get_category_district_counts(entity, min)` | Category+District page inclusion |

These functions run infrequently (1-hour cache) and are `STABLE PARALLEL SAFE` — safe for Supabase's read replicas.

---

## Duplicate Content Prevention

### The five duplicate vectors and their fixes

**1. Tracking parameter URLs**

```
https://violocal.vn/dak-lak?utm_source=facebook
https://violocal.vn/dak-lak?fbclid=IwAR0xyz
```

Fix: `Disallow: /*?utm_` and `Disallow: /*?fbclid=` in robots.txt. Google may still index these if linked externally — add a canonical tag on every page as the second line of defense.

**2. Sort/filter parameter URLs**

```
https://violocal.vn/dak-lak?sort=newest
https://violocal.vn/dak-lak?sort=verified
```

Fix: `Disallow: /*?sort=` in robots.txt. If sort/filter is ever implemented as a page feature, add `noindex` to those views rather than exposing a canonical variant.

**3. Paginated discovery pages**

```
https://violocal.vn/dak-lak          ← page 1 (indexed)
https://violocal.vn/dak-lak?page=2   ← page 2 (noindex + canonical → page 1)
```

Fix: `noindex, follow` + `canonical → page 1` via `getPaginatedRobots()` and `getCanonical()` in thin-page.ts. Do NOT block in robots.txt — let Google follow page 2's links.

**4. Thin discovery pages**

```
https://violocal.vn/dak-lak/krong-buk   ← 1 storefront (thin)
```

Fix: `noindex, follow` + `canonical = self`. Not in sitemap. Not linked from province nav (see provinceNavDistrict threshold). It exists for the user who follows a direct link but does not pollute the index.

**5. www vs non-www, HTTP vs HTTPS**

Fix: handled at DNS/hosting level (Cloudflare redirect rules). All traffic must land on `https://violocal.vn` (no www). If both resolve, Google will eventually consolidate — but a 301 redirect from www ensures immediate de-duplication.

---

## Crawl Budget Optimization

Crawl budget matters most for large sites (10k+ pages). For VIO LOCAL Phase 1, the concern is not budget exhaustion but **signal quality** — ensuring Google's crawl visits the right pages.

### Actions that improve crawl signal

| Action | Effect |
|---|---|
| Exclude `noindex` pages from sitemap | Crawl focuses on indexed pages |
| Block dashboard/auth in robots.txt | No crawl wasted on 0-SEO-value pages |
| Block tracking params in robots.txt | No crawl wasted on parameter variants |
| `noindex, follow` on paginated pages | Google follows links but skips index |
| Province nav only links to indexed districts | Internal link graph only points to indexed pages |
| `<link rel="canonical">` on every page | Resolves ambiguity without robots.txt rules |

### Sitemaps as a crawl signal (not a crawl budget tool)

Sitemaps tell Google what exists and when it last changed. They do not guarantee crawling or indexing. Google uses them as a **hint**, weighted against its own PageRank signals.

The most powerful crawl signal is **internal links from indexed pages to other indexed pages**. The province nav guard (`shouldShowInProvinceNav()` in thin-page.ts) directly implements this: province pages only link to districts above the indexability threshold.

---

## Phase 1 Sitemap Scope

In Phase 1 (4 seeded provinces), the expected URL count per sitemap:

| Sitemap | Estimated URLs |
|---|---|
| `sitemap-geo.xml` | 4 provinces + ~50 districts + ~20 cat+geo = ~74 |
| `sitemap-storefronts.xml` | ~200 storefronts at launch |
| `sitemap-products.xml` | ~500 products at launch |
| `sitemap-services.xml` | ~200 services at launch |

All well under the 50k limit. Chunking (multiple sitemap files per entity type) is only needed when a single file approaches 40,000 URLs.

---

## Anti-Patterns

| Anti-pattern | Why | Fix |
|---|---|---|
| Including noindex pages in sitemap | Contradictory signal — Google receives `noindex` meta AND a sitemap entry | Exclude from sitemap entirely |
| `canonical → parent` on noindex pages | Creates a false duplicate relationship | `canonical = self` always |
| Blocking `?page=` in robots.txt | Prevents Google from discovering linked content | Use `noindex, follow` + canonical instead |
| One sitemap for all URL types | Hard to debug, slow to generate, hard to cache separately | Split by entity type |
| Sitemap without `<lastmod>` | Google can't prioritize which pages to recrawl | Always set `lastmod` from `updated_at` |
| Hardcoding `https://violocal.vn` in sitemap code | Breaks staging/preview environments | Use `VITE_SITE_URL` env variable |
| Generating sitemaps on every page request | Expensive DB queries per bot visit | Cache responses for 1 hour |
| Pre-generating sitemaps at build time | Content changes between deploys — sitemaps go stale | Generate on-demand with cache |
