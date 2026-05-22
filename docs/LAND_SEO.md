# Land Listings SEO Architecture — VIO LOCAL

## Overview

Agricultural land listings live under a dedicated `/dat-nong-nghiep` prefix — completely separate from the storefront/product/service discovery graph. This isolation serves three goals:

1. **Topical authority** — Google learns `/dat-nong-nghiep/*` is authoritative for land queries without diluting the commerce signal of `/:province/*`
2. **Moderation-safe indexing** — land listings require approved status before appearing in search (spam is very high in this vertical)
3. **URL clarity** — "đất nông nghiệp" is an unambiguous search intent; mixing it with storefronts would confuse both Google and users

---

## Route Strategy

```
/dat-nong-nghiep                          ← hub: all provinces with listings
/dat-nong-nghiep/:slug                    ← listing detail (canonical)
/dat-nong-nghiep/:province                ← province discovery
/dat-nong-nghiep/:province/:district      ← district discovery
```

### Server-side route disambiguation

The `/dat-nong-nghiep/:segment` segment is ambiguous — it could be a province slug (`dong-nai`) or a listing slug (`dat-vuon-2ha-xuan-loc`). Resolution logic in the route loader:

```typescript
// src/routes/dat-nong-nghiep/$segment.tsx
const [provinceCheck, listingCheck] = await Promise.all([
  supabase.from('provinces').select('id, slug, name_full').eq('slug', segment).maybeSingle(),
  supabase.from('land_listings')
    .select('*').eq('slug', segment)
    .eq('is_public', true).eq('moderation_status', 'approved').maybeSingle(),
])

if (provinceCheck)  → render province discovery page
else if (listingCheck) → render listing detail page
else → throw notFound()
```

**Province slugs always win on collision.** This means listing slugs must never be identical to province slugs. The slug generation utility (`generateUniqueSlug`) must check both `land_listings.slug` and `provinces.slug` before accepting a slug.

### Slug collision prevention

Listing slugs are generated from the title + geo suffix + year:

```
"Đất vườn 2ha Xuân Lộc" + district "xuan-loc" + year "2026"
→ "dat-vuon-2ha-xuan-loc-2026"
```

Province slugs are all short, single-place names (`dong-nai`, `dak-lak`, `lam-dong`). A listing slug with a year suffix cannot collide with them unless someone names their land parcel exactly after a province — handled by the DB uniqueness check.

---

## Thin-Page Thresholds

Land listings use lower thresholds than storefronts (land listings are rarer).

| Page type | Threshold | Rationale |
|---|---|---|
| Province discovery | ≥ 5 listings | Land listings grow slower than storefronts |
| District discovery | ≥ 2 listings | Two listings minimum to create meaningful context |
| Province nav district link | ≥ 2 listings | Matches district threshold — never link indexed → noindex |

These constants live in `src/services/seo/thin-page.ts` under `THRESHOLDS.landProvince`, `THRESHOLDS.landDistrict`, `THRESHOLDS.landProvinceNavDistrict`.

**Visibility gate:** A listing appears publicly only when BOTH:
- `is_public = true` (owner chose to publish)
- `moderation_status = 'approved'` (moderator approved)

A pending or rejected listing counts zero toward thin-page thresholds.

---

## Metadata Strategy

### Listing detail page (`/dat-nong-nghiep/:slug`)

**Title formula:**
```
{listing.title} tại {district}, {province} | VIO LOCAL
```

Examples:
```
Đất vườn sầu riêng 2ha tại Xuân Lộc, Đồng Nai | VIO LOCAL
Đất cà phê 5ha Cư M'gar tại Cư M'gar, Đắk Lắk | VIO LOCAL
Đất lúa 3ha cần bán tại Bình Phước | VIO LOCAL
```

**Description formula (max 160 chars):**
```
{area} · {land_type} · {crop_type} · {legal_status}. Vị trí: {geo}. Liên hệ trực tiếp.
```

Example:
```
Diện tích: 2 hectares · Đất cây ăn trái · Cây trồng: sầu riêng · Sổ đỏ đầy đủ.
Vị trí: Xuân Lộc, Đồng Nai. Liên hệ trực tiếp qua số điện thoại.
```

**Key metadata choices:**
- `og:type = "website"` — not `business.business` (this is not a business card)
- `og:locale = "vi_VN"` — Vietnamese content signal
- `og:image` — first listing image (sort_order=0) at min 1200×630
- No `twitter:card` override — land listings rarely shared via TikTok

### Province discovery page (`/dat-nong-nghiep/:province`)

**Title:**
```
Đất nông nghiệp {province_name_full} — {N} tin đăng | VIO LOCAL
```

Example: `Đất nông nghiệp Đồng Nai — 47 tin đăng | VIO LOCAL`

**Description:**
```
Tổng hợp {N} tin đăng đất nông nghiệp tại {province_full}.
Đất lúa, cây lâu năm, cây ăn trái, vườn rau — đăng trực tiếp bởi chủ đất.
Liên hệ nhanh không qua trung gian.
```

### District discovery page (`/dat-nong-nghiep/:province/:district`)

**Title:**
```
Đất nông nghiệp {district_name_full} — {N} tin đăng | VIO LOCAL
```

Example: `Đất nông nghiệp Xuân Lộc — 12 tin đăng | VIO LOCAL`

---

## Canonical Strategy

| Page | Canonical | Reasoning |
|---|---|---|
| Listing detail (indexed) | `self` | Canonical URL |
| Listing detail (noindex: pending/rejected) | `self` | Do not point to parent — avoids false duplicate signal |
| Province discovery, page 1 | `self` | Full canonical page |
| Province discovery, page 2+ | page 1 URL | Pagination canonical |
| District discovery, page 1 | `self` | Full canonical page |
| District discovery, page 2+ | page 1 URL | Pagination canonical |

Paginated pages always carry `noindex, follow` regardless of total count (same rule as all other discovery pages via `getPaginatedRobots()` in thin-page.ts).

---

## Structured Data

### Listing detail: `RealEstateListing`

```json
{
  "@context": "https://schema.org",
  "@type": "RealEstateListing",
  "name": "Đất vườn sầu riêng 2ha Xuân Lộc",
  "description": "Đất cây ăn trái, diện tích 2ha, sổ đỏ đầy đủ...",
  "url": "https://violocal.vn/dat-nong-nghiep/dat-vuon-sau-rieng-2ha-xuan-loc",
  "image": "https://[supabase]/storage/v1/land-listings/[id]/0.webp",
  "telephone": "+84912345678",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Xuân Lộc",
    "addressRegion": "Đồng Nai",
    "addressCountry": "VN"
  },
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "Diện tích",  "value": "2 hectares" },
    { "@type": "PropertyValue", "name": "Loại đất",   "value": "Đất cây ăn trái" },
    { "@type": "PropertyValue", "name": "Cây trồng",  "value": "Sầu riêng" },
    { "@type": "PropertyValue", "name": "Pháp lý",    "value": "Sổ đỏ đầy đủ" },
    { "@type": "PropertyValue", "name": "Giá",        "value": "1.2 tỷ" }
  ]
}
```

**Why `RealEstateListing` and not `Product`:**
- `RealEstateListing` is the semantically correct type for land
- Google supports it for rich results in property-related searches
- `additionalProperty` array covers all land-specific fields without custom types

**What NOT to include in JSON-LD:**
- `geo` / `GeoCoordinates` — avoid until PostGIS is added (inaccurate text coords are worse than no coords)
- `offers.price` — use `additionalProperty` for `price_text` instead (price is non-standard free text)
- `floorSize` — use `additionalProperty` for `land_area_text` (floor size implies indoor area)

### Discovery pages: `BreadcrumbList`

All discovery pages include a BreadcrumbList for sitelinks in search results:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Trang chủ",       "item": "https://violocal.vn" },
    { "@type": "ListItem", "position": 2, "name": "Đất nông nghiệp", "item": "https://violocal.vn/dat-nong-nghiep" },
    { "@type": "ListItem", "position": 3, "name": "Đồng Nai",        "item": "https://violocal.vn/dat-nong-nghiep/dong-nai" },
    { "@type": "ListItem", "position": 4, "name": "Xuân Lộc",        "item": "https://violocal.vn/dat-nong-nghiep/dong-nai/xuan-loc" }
  ]
}
```

---

## Internal Linking

### Hub page → province pages

`/dat-nong-nghiep` lists all provinces that have ≥ 5 approved+public listings. Each province is a card link. Only provinces above the `landProvince` threshold are shown — no links to noindex pages.

### Province page → district pages

Province discovery pages (`/dat-nong-nghiep/dong-nai`) show a district nav:

```
Xuân Lộc (12) · Biên Hòa (8) · Long Thành (5)
```

Rule: only show districts with ≥ `landProvinceNavDistrict` (2) listings. This matches the `landDistrict` threshold — an indexed province page never links to a noindex district page.

### Province page → listing cards

Province pages show all listings in that province. Each listing card links to `/dat-nong-nghiep/:slug`.

### Listing detail → nearby listings

Detail pages show "Đất nông nghiệp gần đây" — hierarchical fill-up (ward → district → province), same algorithm as `getNearbyStorefronts()`. This creates an internal link graph within the land context.

### Listing detail → province/district discovery

Each listing detail page includes:
- Breadcrumb: Trang chủ → Đất nông nghiệp → {Province} → {District}
- Footer links: "Xem thêm đất nông nghiệp tại {district}" and "tại {province}"

These links support crawl discovery and distribute PageRank from individual listings back to discovery pages.

### Land ↔ Commerce graph separation

Land listings do NOT link to storefront/product/service pages and vice versa. The two graphs are intentionally separate — mixing them dilutes the topical authority of both.

Exception: a storefront owner who also has land listings may link from their storefront page to their land listings — but this is a user-generated profile link, not a system-level cross-graph link.

---

## Geographic Discovery Strategy

### Province discovery — what appears at /dat-nong-nghiep/dong-nai

1. District nav (districts with ≥ 2 listings)
2. Land type breakdown (count of listings per `land_type` in this province):
   ```
   Đất cây lâu năm (23) · Đất cây ăn trái (14) · Đất lúa (8) · ...
   ```
3. Listing cards (featured first, then newest)
4. "Xem thêm" pagination

This breakdown serves dual purpose: UX navigation AND keyword-rich anchor text for Google (each land type label is a search phrase in Vietnamese).

### District discovery — what appears at /dat-nong-nghiep/dong-nai/xuan-loc

1. Listing cards with land type badges
2. Nearby districts nav: "Đất nông nghiệp huyện lân cận"
3. Link back to province: "Tất cả đất nông nghiệp Đồng Nai"
4. "Đất nông nghiệp gần đây" section (ward-level nearby algorithm)

### Geo-keyword density

Vietnamese land search queries follow the pattern:
```
"đất nông nghiệp {place}" — e.g. "đất nông nghiệp Đắk Lắk"
"mua đất {land_type} {place}" — e.g. "mua đất cà phê Cư M'gar"
"đất {crop_type} {place}" — e.g. "đất sầu riêng Xuân Lộc"
```

Title and description formulas directly match these patterns. No keyword stuffing needed — the natural formula captures the exact search intent.

---

## Nearby Discovery

`getNearbyLandListings()` in `src/features/land-listings/services/land-listings.ts` implements the same 3-level fill-up as the storefront nearby algorithm:

```
Level 1: Same ward (ward_id)       → "trong thôn / xã này"
Level 2: Same district             → "trong huyện này"
Level 3: Same province, other district → "trong tỉnh"
```

Nearby land listings on the detail page serve two functions:
1. **UX:** Buyer may be flexible on exact location
2. **SEO:** Creates an internal link graph within the land context — Google can discover all district listings by following nearby links from any one listing

---

## Sitemap Integration

Land listing pages should be added to the existing sitemap architecture (docs/ROBOTS_INDEXING.md):

```
/sitemap-land-listings.xml    ← all public+approved listings
/sitemap-land-geo.xml         ← province and district discovery pages above threshold
```

Add to the sitemap index at `/sitemap.xml`.

**Inclusion rules:**
- Land listing: `is_public = true AND moderation_status = 'approved'`
- Province discovery: `count >= THRESHOLDS.landProvince`
- District discovery: `count >= THRESHOLDS.landDistrict`
- No paginated pages in sitemap (page 1 only, same rule as all other sitemaps)

---

## robots.txt Additions

No new `Disallow` rules are needed. The existing robots.txt:
- Allows `/dat-nong-nghiep/*` by default (the `Allow: /` catch-all)
- Blocks dashboard and owner management routes

Owner management routes for land listings (once built) should follow the same pattern as storefronts:
```
Disallow: /dat-nong-nghiep/tao-moi
Disallow: /dat-nong-nghiep/*/chinh-sua
```

---

## Moderation and Index Quality

### Why moderation matters for SEO

Land listings attract high volumes of spam and fraudulent posts:
- Fake listings at artificially low prices to capture leads
- Listings for land the poster doesn't own
- Repeated duplicate listings for the same parcel

If these are indexed, Google may penalize the entire `/dat-nong-nghiep/*` graph for low-quality content. The `moderation_status` gate ensures only verified listings enter the index.

### The moderation flow and SEO state

| Owner action | Moderation state | is_public | Google sees |
|---|---|---|---|
| Submit new listing | pending | false | Nothing (not public, not approved) |
| Moderator approves | approved | false | Nothing (owner hasn't published yet) |
| Owner publishes | approved | true | Full SEO treatment |
| Moderator hides | hidden | true | Nothing (hidden overrides is_public) |
| Owner unpublishes | approved | false | Nothing (owner took it offline) |
| Moderator rejects | rejected | any | Nothing (rejected is permanent) |

The DB-level RLS `WHERE is_public = true AND moderation_status = 'approved'` is the enforcement layer — the application cannot accidentally expose a rejected listing.

---

## Anti-Patterns

| Anti-pattern | Why | Fix |
|---|---|---|
| Merging with `/san-pham/:slug` or `/dich-vu/:slug` routes | Destroys topical authority of both graphs | Keep `/dat-nong-nghiep` prefix isolated |
| Including pending/rejected listings in the sitemap | Causes Google to crawl non-existent or low-quality pages | Only `approved + is_public=true` in sitemap |
| `canonical → province page` for noindex listings | Creates false duplicate signal | `canonical = self` always |
| Generating province/district pages before listings exist | Creates thin/empty pages before content is ready | Threshold gate: ≥5 province, ≥2 district |
| Using `?land_type=cay_lau_nam` for land type filtering | Parameter-heavy duplicate URLs | Use section headings on province pages; avoid parameter-based land type pages unless count is very high |
| Linking from province nav to districts below threshold | Province page (indexed) → district page (noindex) leaks crawl budget | `landProvinceNavDistrict: 2` threshold guard |
| Hardcoding price ranges in meta title | Price changes frequently; stale title in SERP looks spammy | Use `price_text` in description only, not title |
| JSON-LD `geo.latitude/longitude` from `coordinates_text` | Unvalidated text coordinates parsed to numbers are inaccurate | Omit `geo` from JSON-LD until PostGIS is added |
