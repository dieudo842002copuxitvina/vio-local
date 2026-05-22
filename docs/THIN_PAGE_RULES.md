# Thin-Page Prevention Rules

SEO quality gate for all discovery pages on VIO LOCAL.

Implementation: [`src/services/seo/thin-page.ts`](../src/services/seo/thin-page.ts)  
Related: [`DISCOVERY_ENGINE.md`](DISCOVERY_ENGINE.md) · [`LISTING_SEO.md`](LISTING_SEO.md)

---

## 0. The Three-State Model

Every discovery page exists in exactly one of three states. The state determines HTTP response code, `robots` meta, and what gets rendered.

```
COUNT = 0
  └─ NOT-FOUND   → 404 response. No page rendered. No robots tag. No canonical.

COUNT ∈ [1, threshold)
  └─ THIN        → 200 response. Page renders for users.
                   noindex, follow  ← Google cannot index it.
                   canonical = self ← no canonical manipulation.
                   Rich static content fills the page (see Section 6).

COUNT ≥ threshold
  └─ INDEXED     → 200 response. Full SEO treatment.
                   index, follow
                   canonical = self
                   Included in sitemap.
```

**Why render THIN pages at all instead of 404?**  
A district with 2 businesses has real users. Those businesses deserve presence. The page will grow over time. 404 creates broken links as the platform grows. `noindex` keeps the page alive for users while hiding it from Google until it has enough content to be worth ranking.

**Why NOT set canonical → parent on THIN pages?**  
Setting `canonical = /dong-nai` on a thin `/dong-nai/xuan-loc` page tells Google the province page IS the Xuân Lộc content. That would merge duplicate signals onto the province page and is factually wrong. `noindex` alone is the correct signal — it says "don't index this URL" without claiming another page is its canonical version.

---

## 1. Minimum Content Thresholds

### Discovery pages

| Page type | URL pattern | NOT-FOUND if | THIN if | INDEXED if |
|---|---|---|---|---|
| Province | `/:province` | 0 storefronts | 1–9 storefronts | ≥ 10 storefronts |
| District | `/:province/:district` | 0 storefronts | 1–2 storefronts | ≥ 3 storefronts |
| Province + category | `/:province/:category` | 0 listings | 1–2 listings | ≥ 3 listings |
| District + category | `/:province/:district` (category filter) | 0 listings | 1 listing | ≥ 2 listings |

### Listing pages

| Page type | NOT-FOUND if | THIN if | INDEXED if |
|---|---|---|---|
| Storefront | `is_public = false` → 404 | n/a — storefronts are not thin | always indexed if `is_public = true` |
| Product | storefront `is_public = false` → 404 | n/a | indexed (see harvest note) |
| Service | storefront `is_public = false` → 404 | n/a | indexed |

Storefronts, products, and services don't use the thin-page model — every published listing is a valid indexable entity. The discovery pages aggregate them, and aggregation pages are where thin-page risk lives.

### Province nav link threshold (separate from page indexability)

The province page's district nav links should only include districts with **≥ 3 storefronts** — matching the district page's own INDEXED threshold.

```
RULE: Only link from an INDEXED page to another INDEXED page.
```

Linking from `/dong-nai` (indexed) to `/dong-nai/xuan-loc` (thin, noindex) wastes crawl budget on pages Google has been told not to index. The link equity flows nowhere useful. Use the same threshold for both the nav links and the page itself.

---

## 2. noindex Rules

### When to set `noindex, follow`

```
THIN discovery page (count in [1, threshold))
Paginated pages beyond page 1
Search result pages (any URL with query parameters)
Draft storefront previews (owner preview of is_public=false)
Owner dashboard and account pages
Admin moderation pages
```

### When to set `noindex, nofollow`

```
Draft storefronts (is_public = false) — also nofollow to prevent crawling linked social profiles
```

### When to set `index, follow`

```
Province page with ≥ 10 public storefronts
District page with ≥ 3 public storefronts
Category+province page with ≥ 3 available listings
Category+district page with ≥ 2 available listings
Individual storefront pages (is_public = true)
Individual product pages (is_available = true AND storefront is_public = true)
Individual service pages (is_available = true AND storefront is_public = true)
```

### Pagination rule

```typescript
// Page 1 of any discovery page
robots   = getPageDecision(type, total) === 'indexed' ? 'index, follow' : 'noindex, follow'
canonical = pageUrl(slug)               // canonical to self

// Page 2+ of any discovery page
robots   = 'noindex, follow'            // always noindex regardless of total count
canonical = pageUrl(slug)               // canonical to page 1, NOT to self
```

Paginated pages have nearly identical structure (same header, same nav) with different content. Even if a province page has 200 storefronts, page 3 of that list contributes zero incremental ranking value.

---

## 3. Canonical Rules

| Scenario | Canonical |
|---|---|
| Indexed discovery page | `https://violocal.vn/{own-url}` |
| THIN discovery page (noindex) | `https://violocal.vn/{own-url}` — canonical to self |
| Paginated page (page 2+) | `https://violocal.vn/{slug}` — canonical to page 1 |
| Old geo slug (alias redirect) | 301 → new URL; new URL canonical to itself |
| Draft storefront | `https://violocal.vn/ho-kinh-doanh/{slug}` — canonical to self |
| Parameter-based URL | 301 → canonical slug URL (never both co-exist) |

### The parameter duplicate trap

Avoid generating both:
```
/dong-nai?category=trai-cay      ← parameter version
/dong-nai/trai-cay               ← canonical slug version
```

If parameter URLs are needed for filtering UX, set them `noindex` and canonical them to the slug URL. The slug URL is the only indexed version.

---

## 4. Internal Linking Rules

### From indexed pages — only link to indexed pages

| Page | Links to | Condition |
|---|---|---|
| Province page nav | District pages | `storefront_count ≥ 3` (INDEXED threshold) |
| Province page | Category+province pages | `listing_count ≥ 3` |
| Storefront page | District page | Always (upward link is always valid) |
| Storefront page | Province page | Always |
| Product page | District page | Always |
| Product page | Storefront page | Always |

**Never generate a province nav link to a district with 0 storefronts.**  
This is the most common thin-page mistake in hyperlocal platforms — eager enumeration of all administrative units regardless of content.

### From thin pages — link upward aggressively

A thin district page with 1-2 storefronts should:

```html
<!-- Prominent province link above the sparse results -->
<p>
  Chưa có nhiều hộ kinh doanh tại <strong>{district.name}</strong>.
  Khám phá thêm <a href="/{province.slug}">hộ kinh doanh tại {province.name}</a>.
</p>

<!-- "Active nearby districts" section below results -->
<section>
  <h2>Khu vực lân cận có nhiều hộ kinh doanh hơn</h2>
  {nearby active districts with ≥ 3 storefronts}
</section>
```

This turns thin pages into useful navigation hubs rather than dead ends. The upward links also pass any crawled authority back to indexed parent pages.

### Sitemap inclusion

```
Include:   INDEXED pages only (count ≥ threshold)
Exclude:   THIN pages (noindex)
Exclude:   404 pages
Exclude:   Paginated pages (page 2+)
Exclude:   Any page with noindex meta
```

---

## 5. Empty-State Handling (count = 0 → 404)

**Never render an indexed or noindex placeholder for a URL with zero content.**  
Empty placeholder pages ("No businesses found in this area yet!") are the fastest way to accumulate hundreds of thin pages that Google penalizes as low-quality content.

### Province page with 0 storefronts

```
HTTP 404
No route match — province pages only exist for seeded provinces.
The URL simply doesn't resolve.
```

In TanStack Router, this means: only generate province page routes for provinces in the DB that have ≥ 1 storefront. Do not seed province pages for all 63 provinces.

```typescript
// Route loader
const province = await getProvinceBySlug(params.provinceSlug)
if (!province) throw notFound()

const { total } = await getProvinceStorefronts(supabase, province.id, 0)
if (total === 0) throw notFound()  // 404 — no content at all
```

### District page with 0 storefronts

Same: 404. The route may exist in the router (districts are in the DB), but if `total === 0` the loader throws `notFound()`.

### Category+geo page with 0 listings

This URL is never linked to (province nav + category nav only links to pages with content). If someone navigates there directly: 404.

```typescript
const count = await getCategoryGeoCount(supabase, provinceId, categoryId)
if (count === 0) throw notFound()
```

### What 404 pages should contain

```
Breadcrumb: shows where the user was trying to go
"This area doesn't have listings yet" message
Links to: parent province page (if district 404), or homepage (if province 404)
"Register your business" CTA
```

404 pages should help users navigate, not just show an error.

---

## 6. Low-Content Handling (count ∈ [1, threshold) → THIN)

A THIN page renders for users but is `noindex`. The goal: make it genuinely useful so users aren't disappointed AND so the page becomes indexable as more businesses join.

### Required sections on a THIN discovery page

```
1. STANDARD HEADER      — province/district name, breadcrumb
2. LISTINGS (1–N)       — show all existing listings, no hiding
3. GEOGRAPHIC CONTEXT   — static paragraph about the location
4. NEARBY ACTIVE AREAS  — links to populated neighboring districts
5. GROWTH CTA           — "Register your business in {area}"
```

### Geographic context content (static, from DB geo fields)

```typescript
// Use district.name_full + province.name — available without API call
const geoContext = `
  ${district.name_full} thuộc ${province.name_full}.
  Hiện có ${total} hộ kinh doanh được đăng ký trên VIO LOCAL tại khu vực này.
  Khi có thêm hộ kinh doanh, trang này sẽ cập nhật tự động.
`
```

This is not keyword-stuffed boilerplate — it's factually accurate, useful to the user, and gives the page enough text to not be empty. It also sets expectations for the user naturally.

### Nearby active areas (links to populated districts)

```typescript
// Powered by district_discovery_summary materialized view
const nearbyActive = await supabase
  .from('district_discovery_summary')
  .select('*')
  .eq('province_id', district.province_id)
  .neq('district_id', district.id)
  .gte('storefront_count', 3)      // only link to INDEXED districts
  .order('storefront_count', { ascending: false })
  .limit(5)
```

Shows up to 5 neighboring districts that have real content. This creates useful navigation AND internal links from thin pages back to indexed pages.

### Growth CTA

```html
<section class="growth-cta">
  <h2>Bạn có hộ kinh doanh tại {district.name}?</h2>
  <p>Đăng ký miễn phí để xuất hiện trên trang này.</p>
  <a href="/dang-ky">Đăng ký ngay</a>
</section>
```

The CTA is not SEO manipulation — it's a genuine call to action that directly grows content density for the page. As more businesses register, the page crosses the threshold and becomes indexed automatically.

---

## 7. Duplicate Page Prevention

### Slug collision (DB-level)

```sql
-- Already enforced by UNIQUE constraints:
UNIQUE(slug)                    -- provinces (global)
UNIQUE(province_id, slug)       -- districts (per province)
UNIQUE(district_id, slug)       -- wards (per district)
```

No two province pages can share a slug. Duplicate URLs at the DB level are impossible.

### Alias redirects (301, never 302)

When a province or district is renamed (or reorganised by government):

```
OLD: /dong-nai/tan-uyen    (district merged into another)
NEW: /dong-nai/tan-uyen-moi

1. Update districts.slug to 'tan-uyen-moi'
2. INSERT geographic_aliases: alias_slug = 'tan-uyen-moi-old', reason = 'old-name'
   ← wait, this is backwards
   
Actually: alias stores the OLD slug that needs to redirect.
INSERT geographic_aliases:
  district_id = {id}, alias_slug = 'tan-uyen', reason = 'old-name'

Route loader: if district slug resolves via aliases table → 301 to canonical slug URL.
```

Stale aliases are never deleted (they preserve redirect history for backlinks). Set `is_active = false` only if the redirect is confirmed unwanted.

### Parameter vs slug duplicates

```
RULE: If a page has a canonical slug URL, the parameter version must not exist as an indexed page.

/dong-nai?cat=trai-cay     → 301 → /dong-nai/trai-cay   OR
/dong-nai?cat=trai-cay     → noindex + canonical=/dong-nai/trai-cay
```

Never allow both to be indexed. If filter parameters exist in the URL (user applied a filter), set `noindex` on that rendered state.

### Trailing slash consistency

```
https://violocal.vn/dong-nai    ← canonical (no trailing slash)
https://violocal.vn/dong-nai/   ← 301 → no trailing slash
```

Configure at server/middleware level, not per-page.

---

## 8. Auto-Generation Anti-patterns

These patterns generate thin pages at scale and must be prevented:

### Anti-pattern 1: Enumerate all 63 provinces at launch

```typescript
// ❌ WRONG — generates 59 empty province pages at Phase 1 launch
const provinces = await getAllProvinces()  // returns all 63
for (const p of provinces) {
  await generateProvincePage(p)
}

// ✅ CORRECT — only generate pages for provinces with content
const provinces = await getProvincesWithContent(threshold: 1)  // WHERE storefront_count > 0
```

### Anti-pattern 2: Generate all districts for an active province

```typescript
// ❌ WRONG — Đồng Nai has 11 districts; generating all 11 at launch creates 10 empty pages
const districts = await getAllDistrictsInProvince(province.id)

// ✅ CORRECT — only districts in the materialized view with ≥ 1 storefront
const districts = await getActiveDistricts(supabase, province.id)  // uses district_discovery_summary
```

### Anti-pattern 3: Generate all category+province combinations

```typescript
// ❌ WRONG — 50 categories × 4 provinces = 200 pages, most empty at launch
for (const cat of allCategories) {
  for (const prov of activeProvinces) {
    await generateCategoryPage(cat, prov)  // 195 of these will be empty
  }
}

// ✅ CORRECT — only render if navigated to; 404 if below threshold
// No pre-generation. Route loader checks count → 404 if 0, noindex if thin
```

### Anti-pattern 4: Showing ALL districts in province nav

```typescript
// ❌ WRONG — links to thin districts from indexed province page
const navDistricts = await getAllDistrictsInProvince(province.id)

// ✅ CORRECT — only districts that are themselves INDEXED
const navDistricts = await getActiveDistricts(supabase, province.id)
// getActiveDistricts queries district_discovery_summary WHERE storefront_count >= 3
```

---

## 9. Phase 1 Specific Rules (4 Provinces)

At Phase 1 launch (Đồng Nai, Bình Phước, Lâm Đồng, Đắk Lắk):

```
DO generate pages for:
  ✅ Province pages: only the 4 seeded provinces
  ✅ District pages: only districts with ≥ 1 storefront
  ✅ Category pages: only on demand (route loader gates)

DO NOT generate pages for:
  ❌ The other 59 provinces (not seeded, return 404)
  ❌ Districts of unsupported provinces (route resolves province first, fails fast)
  ❌ All category+province combinations (generate on demand)
```

**Expected page count at Phase 1 launch:**
```
4 province pages              (indexed if ≥ 10 storefronts each)
~20-40 district pages         (indexed if ≥ 3 storefronts, noindex otherwise)
N category+geo pages          (on demand, gated by threshold)
```

This is a very small crawlable surface — exactly right. A focused, high-quality index beats a large thin one every time.

---

## 10. Decision Reference Table

| URL | Count | HTTP | robots | Canonical | In sitemap |
|---|---|---|---|---|---|
| `/dong-nai` | 0 | 404 | — | — | No |
| `/dong-nai` | 5 | 200 | `noindex, follow` | self | No |
| `/dong-nai` | 15 | 200 | `index, follow` | self | Yes |
| `/dong-nai/xuan-loc` | 0 | 404 | — | — | No |
| `/dong-nai/xuan-loc` | 2 | 200 | `noindex, follow` | self | No |
| `/dong-nai/xuan-loc` | 5 | 200 | `index, follow` | self | Yes |
| `/dong-nai/trai-cay` | 0 | 404 | — | — | No |
| `/dong-nai/trai-cay` | 2 | 200 | `noindex, follow` | self | No |
| `/dong-nai/trai-cay` | 8 | 200 | `index, follow` | self | Yes |
| `/dong-nai` page 2 | any | 200 | `noindex, follow` | `/dong-nai` | No |
| `/ho-kinh-doanh/slug` | is_public=false | 200\* | `noindex, nofollow` | self | No |
| `/ho-kinh-doanh/slug` | is_public=true | 200 | `index, follow` | self | Yes |

\* Draft storefronts return 200 for the owner (authenticated), but the route could also 404 for unauthenticated requests. This is an app-layer decision, not an SEO decision.
