# Content SEO Architecture — VIO LOCAL

Hyperlocal content layer for crop-region, seasonal, and storefront discovery.

Implementation files:
- Content route data → `src/services/content/crops.ts`
- Content page queries → `src/services/content/queries.ts`
- Seasonal calendar → `src/services/content/seasons.ts`
- Thin-page thresholds → `src/services/seo/thin-page.ts` (`THRESHOLDS.cropProvince` etc.)

Related docs:
- [`THIN_PAGE_RULES.md`](THIN_PAGE_RULES.md) — three-state model, noindex rules
- [`LAND_SEO.md`](LAND_SEO.md) — land listing discovery (cross-referenced in §3)
- [`DISCOVERY_ENGINE.md`](DISCOVERY_ENGINE.md) — storefront/product discovery queries
- [`STOREFRONT_SEO.md`](STOREFRONT_SEO.md) — storefront entity metadata
- [`ROBOTS_INDEXING.md`](ROBOTS_INDEXING.md) — sitemap architecture

---

## Content Philosophy

**Content serves commerce. Every content page exists to surface real listings.**

Content pages on VIO LOCAL are not a blog. They are not an editorial layer. They are
discovery aggregators that pull from three entity types simultaneously — storefronts,
products, and land listings — under a shared crop-region or seasonal lens.

The three rules this document enforces:

```
1. No page renders without minimum commerce data behind it.
   If storefronts don't exist, the page doesn't exist.

2. Template text is written once per crop by a human.
   DB counts and entity links are injected live.
   AI-generated, per-page editorial text is banned.

3. Content pages complement the existing discovery graph.
   They do not duplicate it.
   /nong-san/ca-phe/dak-lak ≠ /dak-lak/ca-phe
   (See §1.3 for the precise distinction.)
```

---

## 1. Content Route Architecture

### 1.1 Route Prefixes

Two new prefixes, both clean of collision with existing routes:

```
/nong-san                              ← crop hub (all regions, all crops)
/nong-san/:crop-slug                   ← national crop page
/nong-san/:crop-slug/:province-slug    ← crop × province  (PRIMARY content page)
/mua-vu                                ← seasonal calendar index
/mua-vu/:season-slug                   ← seasonal harvest page
```

No `/mua-vu/:season-slug/:province-slug` — seasonal pages are regional by definition
(the season slug encodes the region; see §4.1).

### 1.2 Crop Slug Registry

Crop slugs are a TypeScript constant — no DB table required. Each entry maps the
public-facing slug to the DB fields it queries across entity types.

```typescript
// src/services/content/crops.ts

import type { LandType } from '../../features/land-listings/types'

export interface CropDef {
  slug:          string        // URL segment: /nong-san/:slug
  label:         string        // Vietnamese display label
  labelPlural:   string        // Used in page titles
  categorySlug:  string        // Matches categories.slug in storefronts/products
  landTypes:     LandType[]    // Matching land_listings.land_type values
  provinces:     string[]      // Province slugs where this crop is commercially relevant
  descriptionTemplate: string  // One human-written sentence. No AI expansion.
}

export const CROPS: Record<string, CropDef> = {
  'ca-phe': {
    slug:         'ca-phe',
    label:        'Cà phê',
    labelPlural:  'cà phê',
    categorySlug: 'ca-phe',
    landTypes:    ['cay_lau_nam'],
    provinces:    ['dak-lak', 'lam-dong', 'gia-lai', 'dak-nong'],
    descriptionTemplate:
      'Mua bán cà phê nhân, cà phê rang xay từ nhà vườn và đại lý tại {province}.',
  },
  'sau-rieng': {
    slug:         'sau-rieng',
    label:        'Sầu riêng',
    labelPlural:  'sầu riêng',
    categorySlug: 'trai-cay',     // maps to fruit tree category
    landTypes:    ['an_trai'],
    provinces:    ['dak-lak', 'dong-nai', 'binh-phuoc', 'tien-giang'],
    descriptionTemplate:
      'Vườn sầu riêng, sầu riêng trái và đất trồng sầu riêng tại {province}.',
  },
  'tieu': {
    slug:         'tieu',
    label:        'Hồ tiêu',
    labelPlural:  'hồ tiêu',
    categorySlug: 'gia-vi',
    landTypes:    ['cay_lau_nam'],
    provinces:    ['binh-phuoc', 'dak-nong', 'dong-nai'],
    descriptionTemplate:
      'Mua bán tiêu hạt, tiêu sọ từ nhà vườn và thương lái tại {province}.',
  },
  'dieu': {
    slug:         'dieu',
    label:        'Điều',
    labelPlural:  'điều',
    categorySlug: 'hat-dieu',
    landTypes:    ['cay_lau_nam'],
    provinces:    ['binh-phuoc', 'dong-nai', 'dak-nong'],
    descriptionTemplate:
      'Hạt điều thô, điều nhân, vườn điều đang thu hoạch tại {province}.',
  },
  'rau-cu': {
    slug:         'rau-cu',
    label:        'Rau củ',
    labelPlural:  'rau củ',
    categorySlug: 'rau-cu',
    landTypes:    ['rau_mau'],
    provinces:    ['lam-dong'],
    descriptionTemplate:
      'Rau sạch, rau hữu cơ trực tiếp từ vườn Đà Lạt và các huyện lân cận.',
  },
}

/** Returns only crops relevant to a given province slug. */
export function getCropsForProvince(provinceSlug: string): CropDef[] {
  return Object.values(CROPS).filter(c => c.provinces.includes(provinceSlug))
}

/** Returns null if the crop slug is not in the registry. */
export function getCropDef(cropSlug: string): CropDef | null {
  return CROPS[cropSlug] ?? null
}
```

### 1.3 Distinction from Existing Discovery Pages

The existing storefront discovery graph already has a category+province page:

```
/dak-lak/ca-phe   ← storefront discovery: "Coffee storefronts in Đắk Lắk"
                    Shows: storefronts in Đắk Lắk whose category = cà phê
                    Queries: storefronts table only
                    Intent: "find a cà phê storefront"
```

The new content page is different in three ways:

```
/nong-san/ca-phe/dak-lak   ← crop-region page: "Cà phê growing region — Đắk Lắk"
                              Shows: storefronts + product listings + land listings
                              Queries: three entity types, cross-entity aggregation
                              Intent: "understand and transact in the Đắk Lắk cà phê market"
```

They serve different intents. They have different URLs. Google will not treat them as
duplicates. Content pages link to the existing storefront discovery page as a "see more"
action — they are upstream of it, not a replacement.

**If `/dak-lak/ca-phe` already exists and is indexed, do not create `/nong-san/ca-phe/dak-lak`
until there are ≥ 3 land listings for `cay_lau_nam` in Đắk Lắk.** Without land listing data,
the cross-entity value disappears and the content page becomes a thin duplicate of
the storefront discovery page.

### 1.4 Route Disambiguation

`/nong-san/:crop-slug/:province-slug` has no ambiguity — crop slugs are pre-registered in
`CROPS` and province slugs come from the `provinces` table. Route loader logic:

```typescript
// src/routes/nong-san/$cropSlug/$provinceSlug.tsx

const cropDef = getCropDef(params.cropSlug)
if (!cropDef) throw notFound()

const province = await supabase
  .from('provinces')
  .select('id, slug, name, name_full')
  .eq('slug', params.provinceSlug)
  .maybeSingle()

if (!province) throw notFound()

// Province must be in crop's relevant provinces list.
// Prevents /nong-san/ca-phe/ha-noi (not a cà phê province).
if (!cropDef.provinces.includes(params.provinceSlug)) throw notFound()

const data = await getCropProvincePageData(supabase, cropDef, province.id)

const decision = resolveCropPageDecision(data)
if (decision.state === 'not-found') throw notFound()

return { cropDef, province, data, decision }
```

### 1.5 National Crop Page

`/nong-san/:crop-slug` aggregates all provinces for that crop. It is indexed only if
≥ 2 provinces independently meet `THRESHOLDS.cropProvince`. If only one province has
data, that province page is indexed directly but the national page is `noindex`.

```typescript
// Route loader for /nong-san/:crop-slug
const provinces = await getCropNationalSummary(supabase, cropDef)
// Returns: [{ province, storefrontCount, landListingCount }]

const qualifyingProvinces = provinces.filter(
  p => p.storefrontCount >= THRESHOLDS.cropProvince
)

const state = qualifyingProvinces.length >= THRESHOLDS.cropNational
  ? 'indexed'
  : qualifyingProvinces.length === 0 ? 'not-found' : 'noindex'
```

---

## 2. Metadata Strategy

### 2.1 Crop × Province Page

**Title formula:**
```
{Crop} tại {Province} — {N} nhà vườn và cửa hàng | VIO LOCAL
```

Examples:
```
Cà phê tại Đắk Lắk — 34 nhà vườn và cửa hàng | VIO LOCAL
Sầu riêng tại Đồng Nai — 18 nhà vườn và cửa hàng | VIO LOCAL
Rau củ tại Lâm Đồng — 61 nhà vườn và cửa hàng | VIO LOCAL
```

Rules:
- `N` = storefrontCount only (not total of all entities — storefronts are the commerce anchor)
- Do NOT include price ranges in titles — prices change; stale titles look spammy in SERP
- Do NOT include season/harvest date in titles — seasonal pages cover that (§4)

**Description formula (max 160 chars):**
```
{descriptionTemplate with province injected}. {N} cửa hàng, {M} mảnh đất {label}.
Liên hệ trực tiếp — không qua trung gian.
```

Example:
```
Mua bán cà phê nhân, cà phê rang xay từ nhà vườn và đại lý tại Đắk Lắk. 34 cửa hàng,
12 mảnh đất cây lâu năm. Liên hệ trực tiếp — không qua trung gian.
```

**OG tags** — use `ogToHeadMeta()` from `src/services/seo/og.ts`:
```typescript
const og: OgMeta = {
  title:       pageTitle,
  description: pageDescription,
  url:         `${getSiteUrl()}/nong-san/${cropSlug}/${provinceSlug}`,
  image:       withAlt(
    buildOgImageUrl(topStorefront?.cover_image_url ?? topStorefront?.avatar_url ?? null),
    `${cropDef.label} tại ${province.name_full}`
  ),
  type:        'website',          // OG_TYPE_REFERENCE.discoveryPage
  locale:      'vi_VN',
  siteName:    'VIO LOCAL',
  twitterCard: 'summary_large_image',
}
```

OG image source priority:
1. Cover image of the highest-ranked storefront on that page
2. Avatar of the highest-ranked storefront (Transform API crops to 1200×630)
3. Null → platform default OG image

### 2.2 Seasonal Page

**Title formula:**
```
Mùa {crop} {region} {year} — Mua trực tiếp từ nhà vườn | VIO LOCAL
```

Examples:
```
Mùa cà phê Tây Nguyên 2026 — Mua trực tiếp từ nhà vườn | VIO LOCAL
Mùa sầu riêng miền Nam 2026 — Mua trực tiếp từ nhà vườn | VIO LOCAL
```

`{year}` = current calendar year (injected at render time, not hardcoded in slug).
This ensures the page title stays current without requiring a new URL each year.

**Description formula:**
```
Thu hoạch {crop} tại {region} thường vào tháng {months}.
Hiện có {N} vườn và cửa hàng đang hoạt động. Liên hệ ngay trong mùa vụ.
```

### 2.3 National Crop Page

**Title formula:**
```
{Crop} Việt Nam — Mua từ nhà vườn tại {N} tỉnh | VIO LOCAL
```

Example:
```
Cà phê Việt Nam — Mua từ nhà vườn tại 4 tỉnh | VIO LOCAL
```

### 2.4 JSON-LD Schemas

#### Crop × Province page: `ItemList` + `BreadcrumbList`

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Cà phê tại Đắk Lắk",
  "description": "Nhà vườn và cửa hàng cà phê tại Đắk Lắk",
  "url": "https://violocal.vn/nong-san/ca-phe/dak-lak",
  "numberOfItems": 34,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "url": "https://violocal.vn/ho-kinh-doanh/ca-phe-buon-me-dak-lak"
    }
    // ...top 10 storefronts only (not all)
  ]
}
```

`itemListElement` capped at 10 entries — this signals the page to Google without
enumerating the full result set (which changes frequently and bloats the JSON-LD).

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Trang chủ",    "item": "https://violocal.vn" },
    { "@type": "ListItem", "position": 2, "name": "Nông sản",     "item": "https://violocal.vn/nong-san" },
    { "@type": "ListItem", "position": 3, "name": "Cà phê",       "item": "https://violocal.vn/nong-san/ca-phe" },
    { "@type": "ListItem", "position": 4, "name": "Đắk Lắk",      "item": "https://violocal.vn/nong-san/ca-phe/dak-lak" }
  ]
}
```

#### Seasonal page: `Event` + `ItemList`

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Mùa thu hoạch cà phê Tây Nguyên 2026",
  "startDate": "2026-10-01",
  "endDate": "2027-01-31",
  "location": {
    "@type": "Place",
    "name": "Tây Nguyên, Việt Nam",
    "address": {
      "@type": "PostalAddress",
      "addressRegion": "Tây Nguyên",
      "addressCountry": "VN"
    }
  },
  "description": "Mùa thu hoạch cà phê Robusta tại Đắk Lắk, Đắk Nông, Gia Lai. Mua trực tiếp từ nhà vườn.",
  "url": "https://violocal.vn/mua-vu/ca-phe-tay-nguyen",
  "organizer": {
    "@type": "Organization",
    "name": "VIO LOCAL",
    "url": "https://violocal.vn"
  }
}
```

`startDate`/`endDate` are injected from `SEASONS` constant (§4.1) using the
current year — not hardcoded.

### 2.5 Canonical Rules

| Page | Canonical |
|---|---|
| Crop × province, page 1 | `https://violocal.vn/nong-san/{crop}/{province}` |
| Crop × province, page 2+ | Page 1 URL |
| Crop national, page 1 | `https://violocal.vn/nong-san/{crop}` |
| Seasonal page | `https://violocal.vn/mua-vu/{season-slug}` |
| Seasonal page (off-season) | Self — keep canonical even when `noindex` off-season |

Seasonal pages are **never** canonicalized to the crop-region page, even off-season.
They serve a different intent (temporal harvest context vs. general crop commerce).

---

## 3. Geo Content Strategy

### 3.1 Province Content Profile

Each Phase 1 province has a content profile — which crops are commercially active enough
to warrant content pages. This is data-driven: derived from actual category distribution
in the storefronts and products tables at launch.

```typescript
// src/services/content/crops.ts

/**
 * Province content profile — computed at build time or from DB, not hardcoded.
 * Crop slugs in this list are eligible for /nong-san/:crop/:province.
 * Only crops that meet THRESHOLDS.cropProvince are included.
 */
export interface ProvinceContentProfile {
  provinceSlug:   string
  activeCrops:    string[]          // crop slugs that meet threshold
  primaryCrop:    string | null     // highest storefrontCount crop (for OG + description)
  landListingTypes: LandType[]      // dominant land_type values in this province
}
```

**Why a computed profile instead of a hardcoded map:**
- Crop relevance changes as storefronts are added
- Hardcoding "Đắk Lắk = coffee" requires manual updates when Đắk Lắk gets durian storefronts
- The DB already has the data; read it, don't replicate it

The profile is queried at page load time — not cached in code. The thin-page threshold
gate (§6) is the only gate needed.

### 3.2 Crop-Region Data Query

A content page pulls from three sources in a single round trip:

```typescript
// src/services/content/queries.ts

export interface CropProvincePageData {
  storefronts:  StorefrontWithCategory[]  // storefronts in this province with this category
  products:     ProductWithStorefront[]   // products in this category in this province
  landListings: LandListingWithCover[]    // land listings with matching land_type
  counts: {
    storefronts:  number
    products:     number
    landListings: number
  }
}

export async function getCropProvincePageData(
  supabase:   SupabaseClient,
  cropDef:    CropDef,
  provinceId: number,
): Promise<CropProvincePageData> {
  const [storefronts, products, landListings] = await Promise.all([
    supabase
      .from('storefronts')
      .select('*, categories!inner(slug)')
      .eq('province_id', provinceId)
      .eq('is_public', true)
      .eq('categories.slug', cropDef.categorySlug)
      .order('is_verified', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('products')
      .select('*, storefronts!inner(province_id, is_public), categories!inner(slug)')
      .eq('storefronts.province_id', provinceId)
      .eq('storefronts.is_public', true)
      .eq('is_available', true)
      .eq('categories.slug', cropDef.categorySlug)
      .order('created_at', { ascending: false })
      .limit(12),

    supabase
      .from('land_listings')
      .select('*, land_listing_images(image_url, sort_order)')
      .eq('province_id', provinceId)
      .eq('is_public', true)
      .eq('moderation_status', 'approved')
      .in('land_type', cropDef.landTypes)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  return {
    storefronts:  storefronts.data ?? [],
    products:     products.data ?? [],
    landListings: landListings.data ?? [],
    counts: {
      storefronts:  storefronts.count ?? 0,
      products:     products.count ?? 0,
      landListings: landListings.data?.length ?? 0,
    },
  }
}
```

### 3.3 Geo-Keyword Density

Vietnamese search queries for crop-region content follow predictable patterns:

```
"mua {crop} {province}"          — e.g. "mua cà phê Đắk Lắk"
"{crop} tại {province}"          — e.g. "cà phê tại Đắk Lắk"
"vườn {crop} {province}"         — e.g. "vườn cà phê Đắk Lắk"
"đất trồng {crop} {province}"    — e.g. "đất trồng cà phê Đắk Lắk"
```

The title formula `{Crop} tại {Province} — {N} nhà vườn và cửa hàng` directly captures
patterns 1 and 2. Pattern 3 is captured by the page's storefront section headings.
Pattern 4 is captured by the land listings section heading and the `/dat-nong-nghiep`
link in the content page footer.

No keyword stuffing. The natural formula captures the query intent because the intent
IS the formula.

### 3.4 District-Level Content Pages

District content pages (`/nong-san/:crop/:province/:district`) are **not built in Phase 1**.
Reasoning:
- District-level crop commerce pages require higher listing density than district-level
  storefront pages to avoid being thin
- Phase 1 provinces do not have enough crop-specific district-level data
- The crop × province page already links to the existing storefront district pages
  via the internal link graph

Add district content pages when `THRESHOLDS.cropDistrict` is added to `thin-page.ts`
and at least one district in a Phase 1 province exceeds it.

---

## 4. Seasonal SEO Strategy

### 4.1 Harvest Calendar

Seasons are hard-coded TypeScript constants. This is intentional:
- Harvest windows are agricultural facts, not DB data
- They change rarely (climate drift is decade-scale)
- Hard-coding prevents accidental misconfiguration

```typescript
// src/services/content/seasons.ts

import type { LandType } from '../../features/land-listings/types'

export interface SeasonDef {
  slug:            string          // URL: /mua-vu/:slug
  label:           string          // Page title component
  cropSlug:        string          // links to /nong-san/:cropSlug
  region:          string          // human-readable region name (used in titles)
  provincesSlugs:  string[]        // which provinces this season covers
  harvestMonths:   number[]        // 1-based (1 = January)
  preSeasonMonths: number[]        // show "upcoming" signal; do NOT index yet
  landTypes:       LandType[]      // relevant land_type values for land listing links
  descriptionTemplate: string      // One human sentence. No AI expansion.
}

export const SEASONS: Record<string, SeasonDef> = {
  'ca-phe-tay-nguyen': {
    slug:           'ca-phe-tay-nguyen',
    label:          'Mùa cà phê Tây Nguyên',
    cropSlug:       'ca-phe',
    region:         'Tây Nguyên',
    provincesSlugs: ['dak-lak', 'lam-dong', 'gia-lai', 'dak-nong'],
    harvestMonths:  [10, 11, 12, 1],    // Oct → Jan (year wraps)
    preSeasonMonths: [8, 9],            // Aug–Sep: "upcoming harvest" signal
    landTypes:      ['cay_lau_nam'],
    descriptionTemplate:
      'Mùa thu hoạch cà phê Robusta tại Tây Nguyên — liên hệ nhà vườn trực tiếp trong mùa vụ.',
  },
  'sau-rieng-mien-nam': {
    slug:           'sau-rieng-mien-nam',
    label:          'Mùa sầu riêng miền Nam',
    cropSlug:       'sau-rieng',
    region:         'miền Nam',
    provincesSlugs: ['dak-lak', 'dong-nai', 'binh-phuoc'],
    harvestMonths:  [4, 5, 6, 7, 8],   // Apr–Aug
    preSeasonMonths: [2, 3],
    landTypes:      ['an_trai'],
    descriptionTemplate:
      'Mùa sầu riêng chín rộ tại miền Nam — mua trực tiếp từ nhà vườn Đắk Lắk, Đồng Nai, Bình Phước.',
  },
  'tieu-binh-phuoc': {
    slug:           'tieu-binh-phuoc',
    label:          'Mùa tiêu Bình Phước',
    cropSlug:       'tieu',
    region:         'Bình Phước',
    provincesSlugs: ['binh-phuoc', 'dak-nong'],
    harvestMonths:  [2, 3, 4],          // Feb–Apr
    preSeasonMonths: [12, 1],
    landTypes:      ['cay_lau_nam'],
    descriptionTemplate:
      'Hồ tiêu Bình Phước thu hoạch tháng 2–4. Mua tiêu hạt, tiêu sọ từ vườn trong mùa.',
  },
  'dieu-dong-nam-bo': {
    slug:           'dieu-dong-nam-bo',
    label:          'Mùa điều Đông Nam Bộ',
    cropSlug:       'dieu',
    region:         'Đông Nam Bộ',
    provincesSlugs: ['binh-phuoc', 'dong-nai'],
    harvestMonths:  [1, 2, 3, 4],       // Jan–Apr
    preSeasonMonths: [11, 12],
    landTypes:      ['cay_lau_nam'],
    descriptionTemplate:
      'Điều Đông Nam Bộ thu hoạch tháng 1–4. Hạt điều thô và điều nhân từ nhà vườn.',
  },
  'rau-da-lat': {
    slug:           'rau-da-lat',
    label:          'Rau Đà Lạt',
    cropSlug:       'rau-cu',
    region:         'Lâm Đồng',
    provincesSlugs: ['lam-dong'],
    harvestMonths:  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // year-round
    preSeasonMonths: [],
    landTypes:      ['rau_mau'],
    descriptionTemplate:
      'Rau sạch Đà Lạt cung cấp quanh năm. Đặt trực tiếp từ nhà vườn và hộ kinh doanh Lâm Đồng.',
  },
}

/** Whether the current month is in this season's harvest window. */
export function isInSeason(season: SeasonDef, monthIndex: number): boolean {
  return season.harvestMonths.includes(monthIndex)
}

/** Whether the current month is in this season's pre-season window. */
export function isPreSeason(season: SeasonDef, monthIndex: number): boolean {
  return season.preSeasonMonths.includes(monthIndex)
}

/**
 * ISO start/end dates for a season's harvest window in the given year.
 * Handles year-wrap (e.g. Oct 2026 → Jan 2027).
 */
export function getSeasonDateRange(
  season: SeasonDef,
  year: number,
): { startDate: string; endDate: string } {
  const months = season.harvestMonths

  // Detect year wrap: consecutive months with a gap larger than 1 indicates wrap
  let startMonth = months[0]
  let endMonth   = months[months.length - 1]
  const wraps = months.some((m, i) => i > 0 && m < months[i - 1])

  let startYear = year
  let endYear   = year

  if (wraps) {
    // Start is the first month after the gap, end is the last month before it
    const gapIdx = months.findIndex((m, i) => i > 0 && m < months[i - 1])
    startMonth = months[gapIdx]
    endMonth   = months[gapIdx - 1]
    // If current month >= startMonth, end is next year
    endYear = year + 1
  }

  return {
    startDate: `${startYear}-${String(startMonth).padStart(2, '0')}-01`,
    endDate:   `${endYear}-${String(endMonth).padStart(2, '0')}-28`,
  }
}
```

### 4.2 Seasonal Page Index State

Seasonal pages change index state based on the current month:

| Current month | State | robots | Rationale |
|---|---|---|---|
| Pre-season month | `noindex` | `noindex, follow` | Exists for early user discovery; not indexed until harvest |
| Harvest month | `indexed` | `index, follow` | Full SEO treatment — content is timely |
| Off-season | `noindex` | `noindex, follow` | Keep URL alive with same-year data; re-indexes next pre-season |

```typescript
export function getSeasonPageState(
  season:     SeasonDef,
  now:        Date,
  threshold:  number,   // minimum storefronts to be non-404
  count:      number,   // actual storefront count
): PageState {
  if (count < threshold) return 'not-found'
  if (count < THRESHOLDS.seasonProvince) return 'noindex'

  const month = now.getMonth() + 1   // 1-based
  if (isInSeason(season, month) || isPreSeason(season, month)) {
    return isInSeason(season, month) ? 'indexed' : 'noindex'
  }
  return 'noindex'   // off-season
}
```

**Year-round seasons** (e.g., `rau-da-lat`) are always `indexed` if the threshold is met.

### 4.3 In-Season Amplification

When a crop × province page is in harvest season, the page adds:

1. **Seasonal badge** in the page header — "🌿 Đang mùa thu hoạch" — visible to users and
   readable by crawlers as inline text (not image-only)
2. **Updated `dateModified`** in the `Event` JSON-LD — set to the date of the last
   product price update in that category
3. **`/mua-vu/:season-slug` link** in the crop × province page header — signals to Google
   that a seasonal page exists for this crop right now

The badge is a `<span>` with text, not a CSS-only visual. Screen readers and crawlers see it.

### 4.4 Pre-Season Landing

During pre-season months the seasonal page renders at `noindex` but is accessible via
direct link and via the crop × province page's "upcoming season" section:

```html
<!-- On /nong-san/ca-phe/dak-lak during August (pre-season for cà phê) -->
<section>
  <h2>Mùa thu hoạch sắp đến</h2>
  <p>Cà phê Tây Nguyên thường thu hoạch từ tháng 10 đến tháng 1.</p>
  <a href="/mua-vu/ca-phe-tay-nguyen">Xem nhà vườn chuẩn bị mùa 2026</a>
</section>
```

This link brings users (and crawlers) to the seasonal page early, building crawl
authority before the harvest starts and the page flips to `indexed`.

---

## 5. Internal Linking Strategy

### 5.1 Link Graph

Content pages connect to — but do not replace — the existing discovery graph.

```
Homepage
  └─ /nong-san  (crop hub)
       ├─ /nong-san/ca-phe  (national)
       │    └─ /nong-san/ca-phe/dak-lak  (crop × province)  ──→  /dak-lak  (storefront province)
       │                                                     ──→  /dak-lak/ca-phe  (category × province)
       │                                                     ──→  /dat-nong-nghiep/dak-lak  (land province)
       │                                                     ──→  /mua-vu/ca-phe-tay-nguyen  (seasonal)
       └─ /mua-vu  (seasonal calendar)
            └─ /mua-vu/ca-phe-tay-nguyen  ──→  /nong-san/ca-phe/dak-lak  (back-link)
                                          ──→  /nong-san/ca-phe/lam-dong  (sibling province)
```

Links flow in both directions between content pages and discovery pages. Neither side
is a dead-end. No link cycles within the content graph itself.

### 5.2 What a Crop × Province Page Links To

Required links on every indexed crop × province page:

```
1. Storefront province discovery
   "Xem tất cả {N} cửa hàng {crop} tại {province}"
   → /ho-kinh-doanh/{province-slug}/{category-slug}

2. Category × province discovery (products and services)
   "Sản phẩm {crop} tại {province}"
   → /{province-slug}/{category-slug}

3. Land listing province discovery (if landListings.count > 0)
   "Đất trồng {crop} tại {province} ({M} mảnh)"
   → /dat-nong-nghiep/{province-slug}

4. Seasonal page (if season is active or upcoming)
   → /mua-vu/{season-slug}

5. National crop page (breadcrumb)
   → /nong-san/{crop-slug}
```

Links 1 and 2 are the primary commerce destinations. They appear as prominent CTAs,
not buried footnotes.

### 5.3 What Links to Crop × Province Pages

The following pages must link to content pages where relevant:

| Source page | Link type | Condition |
|---|---|---|
| Province discovery (`/dak-lak`) | Section: "Nông sản địa phương" | Province has ≥ 1 `activeCrops` |
| Land listing province page (`/dat-nong-nghiep/dak-lak`) | Section: "Mua bán {crop}" | Crop × province is indexed |
| Storefront page | Footer: "Tìm hiểu về {crop} tại {province}" | Storefront category matches a CropDef |
| Seasonal page | Header: "Xem tất cả tỉnh" + individual province links | Seasonal page links to each province's crop page |
| Sitemap | Content sitemap entries | Page is `indexed` state |

**Storefront linking rule:** A storefront whose category is `ca-phe` in Đắk Lắk links
to `/nong-san/ca-phe/dak-lak` in its footer. This creates hundreds of natural inbound
links to the crop content page from the very businesses that populate it.

### 5.4 Seasonal Page Cross-Links

Each seasonal page links to the crop × province pages for every province in its
`provinceSlugs` list — but only if that crop × province page is indexed:

```typescript
// On /mua-vu/ca-phe-tay-nguyen
const provinceLinks = season.provincesSlugs
  .filter(slug => isCropProvinceIndexed(slug, 'ca-phe'))  // threshold check
  .map(slug => ({ slug, province: getProvinceName(slug) }))
```

Seasonal pages also link back to sibling seasonal pages if the crop overlaps:

```
/mua-vu/ca-phe-tay-nguyen → "Xem thêm" → /mua-vu/sau-rieng-mien-nam
```

Condition: only if the sibling page is currently `indexed` (in-season).

### 5.5 Hub Page (`/nong-san`)

The crop hub lists only crops where at least one province meets `THRESHOLDS.cropProvince`.
A crop with no qualifying province is not linked from the hub — it does not exist yet
from a crawl perspective.

```typescript
// /nong-san route loader
const activeCrops = await Promise.all(
  Object.values(CROPS).map(async crop => {
    const counts = await getCropNationalSummary(supabase, crop)
    const qualifying = counts.filter(c => c.storefrontCount >= THRESHOLDS.cropProvince)
    return qualifying.length > 0 ? { crop, qualifying } : null
  })
)
const visibleCrops = activeCrops.filter(Boolean)
// If visibleCrops.length === 0: hub renders as noindex with "Coming soon" placeholder
```

### 5.6 Province Page Integration

Every province discovery page (e.g., `/dak-lak`) adds a "Nông sản địa phương" section:

```html
<!-- On /dak-lak — only shown if ≥ 1 active crop content page exists -->
<section>
  <h2>Nông sản địa phương</h2>
  <ul>
    <li><a href="/nong-san/ca-phe/dak-lak">Cà phê Đắk Lắk — 34 nhà vườn</a></li>
    <li><a href="/nong-san/sau-rieng/dak-lak">Sầu riêng Đắk Lắk — 12 nhà vườn</a></li>
  </ul>
</section>
```

This section is SSR-rendered with live counts from `getCropsForProvince()` — never
cached HTML, because storefront counts change as new businesses register.

---

## 6. Thin-Content Prevention

### 6.1 New Thresholds

Add to `src/services/seo/thin-page.ts`:

```typescript
export const THRESHOLDS = {
  // ... existing thresholds ...

  // Content pages — crop × province
  // Minimum storefronts selling this crop in this province for the page to be indexed.
  // Higher than categoryProvince (3) because content pages claim editorial authority.
  cropProvince:   5,

  // Minimum provinces meeting cropProvince threshold for the national crop page.
  cropNational:   2,

  // Minimum storefronts active during this harvest season (in any province).
  // Lower than cropProvince — seasonal pages are time-bounded so lower density is acceptable.
  seasonProvince: 3,

  // Content page nav: minimum storefronts for a crop to appear in province page nav.
  // Matches cropProvince — never link indexed province page to noindex content page.
  provinceCropNav: 5,
} as const
```

### 6.2 Content Gate per Entity Type

Content pages have a more nuanced thin-page check than discovery pages because they
depend on multiple entity types. The gate checks storefronts primarily:

```typescript
export function resolveCropPageDecision(data: CropProvincePageData): PageDecision {
  const { storefronts: sf, landListings: ll } = data.counts

  // 404: neither storefronts nor land listings — page has nothing to show
  if (sf === 0 && ll === 0) {
    return { state: 'not-found', robots: null, canonical: null, inSitemap: false }
  }

  // noindex: storefronts exist but below threshold (page is thin on commerce)
  if (sf < THRESHOLDS.cropProvince) {
    return {
      state:     'noindex',
      robots:    'noindex, follow',
      canonical: /* self */ null,   // caller injects canonical URL
      inSitemap: false,
    }
  }

  // indexed: minimum storefronts met
  return {
    state:     'indexed',
    robots:    'index, follow',
    canonical: null,
    inSitemap: true,
  }
}
```

**Land listings alone do not qualify a content page for indexing.** A content page with
10 land listings and 2 storefronts is `noindex`. Land listings are supporting context;
storefronts are the commerce anchor.

### 6.3 Seasonal Page Thin Check

Seasonal pages have a time-dimension gate in addition to the count gate:

```
state = 'not-found'  if storefrontCount < THRESHOLDS.seasonProvince
state = 'noindex'    if storefrontCount ≥ threshold AND not in harvest/pre-season months
state = 'noindex'    if storefrontCount ≥ threshold AND in pre-season months
state = 'indexed'    if storefrontCount ≥ threshold AND in harvest months
```

Year-round seasons (`harvestMonths.length === 12`) skip the month check and go
directly to the count gate.

### 6.4 Content Page Thin Sections

When a content page is `indexed` but one of its sections has no data, the section is
omitted entirely — not shown as empty:

```
storefronts.length === 0  → omit "Nhà vườn và cửa hàng" section  (impossible if indexed, but defensive)
products.length    === 0  → omit "Sản phẩm hiện có" section
landListings.length === 0 → omit "Đất trồng" section AND omit land listing link in footer
```

Empty sections ("No land listings found") are thin content inside an otherwise
indexed page. Omitting them keeps the page dense and avoids the appearance of a
partially-filled template.

### 6.5 Anti-Patterns

| Anti-pattern | Why it fails | Prevention |
|---|---|---|
| Generate `/nong-san/ca-phe/ha-noi` | Hà Nội is not a cà phê growing region | `cropDef.provinces` allowlist gate in route loader |
| Seasonal page year in URL slug | Creates new URL each year — old URL becomes 404 | Year in title only, not slug |
| AI-written per-province description | Scales to content farm; Google penalizes | One `descriptionTemplate` per crop, injected with live DB data |
| Content page canonical → storefront discovery | False duplicate signal; destroys topical value | Always `canonical = self` |
| Land listing count as sole threshold signal | Land listings are thin without commerce context | Storefront count is the primary gate |
| Showing all 12+ products in `ItemList` JSON-LD | JSON-LD bloat; top-10 cap is sufficient | Hard cap: `itemListElement.length <= 10` |
| Indexing `/nong-san/ca-phe` before 2 provinces qualify | National page thin without multi-province data | `cropNational: 2` threshold |
| Off-season seasonal page with `index, follow` | Stale temporal content indexed year-round | Month-gate in `getSeasonPageState()` |
| Linking to a `noindex` crop page from province nav | Province (indexed) → crop page (noindex) wastes crawl | `provinceCropNav: 5` guard |

---

## Appendix A: Phase 1 Content Page Eligibility

At Phase 1 launch (Đồng Nai, Bình Phước, Lâm Đồng, Đắk Lắk):

| Crop page | Eligible? | Reason |
|---|---|---|
| `/nong-san/ca-phe/dak-lak` | **Yes** — if ≥ 5 storefronts | Đắk Lắk is Vietnam's primary coffee province |
| `/nong-san/ca-phe/lam-dong` | **Yes** — if ≥ 5 storefronts | Đà Lạt has Arabica storefronts |
| `/nong-san/rau-cu/lam-dong` | **Yes** — if ≥ 5 storefronts | Đà Lạt vegetables are year-round |
| `/nong-san/sau-rieng/dak-lak` | **Conditional** — unlikely at launch | Needs ≥ 5 storefronts |
| `/nong-san/tieu/binh-phuoc` | **Conditional** | Pepper storefronts present but likely thin |
| `/nong-san/dieu/binh-phuoc` | **Conditional** | Cashew common in Bình Phước |
| `/nong-san/dieu/dong-nai` | **Conditional** | Cashew also in Đồng Nai |

Expected content pages at launch: 2–4 indexed pages. This is correct. A focused, high-quality
content graph beats a large thin one. Pages are added automatically as storefronts cross thresholds.

## Appendix B: Sitemap Entries

Add to `src/services/seo/sitemap.ts`:

```typescript
export async function getContentSitemapEntries(supabase: SupabaseClient): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = []
  const siteUrl = getSiteUrl()

  for (const cropDef of Object.values(CROPS)) {
    for (const provinceSlug of cropDef.provinces) {
      const province = await getProvinceBySlug(supabase, provinceSlug)
      if (!province) continue

      const data = await getCropProvincePageData(supabase, cropDef, province.id)
      if (data.counts.storefronts < THRESHOLDS.cropProvince) continue

      entries.push({
        url:          `${siteUrl}/nong-san/${cropDef.slug}/${provinceSlug}`,
        lastmod:      new Date().toISOString(),
        changefreq:   'weekly',
        priority:     0.7,
      })
    }
  }

  return entries
}

export async function getSeasonalSitemapEntries(): Promise<SitemapEntry[]> {
  const siteUrl   = getSiteUrl()
  const now       = new Date()
  const month     = now.getMonth() + 1

  return Object.values(SEASONS)
    .filter(season => isInSeason(season, month))   // only indexed seasons
    .map(season => ({
      url:        `${siteUrl}/mua-vu/${season.slug}`,
      lastmod:    now.toISOString(),
      changefreq: 'daily',   // prices and listing counts change during harvest
      priority:   0.8,       // higher than discovery pages — high commercial intent
    }))
}
```

Add to `buildSitemapIndex()`: `/sitemap-content.xml` covering both crop-region and
seasonal entries.
