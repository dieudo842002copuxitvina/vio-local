# Storefront Routing Architecture

VIO LOCAL routing strategy: SEO-first, hyperlocal-aware, zero UUID URLs.

---

## 1. Route Map

```
/ho-kinh-doanh/:slug              → Individual storefront (canonical)
/:province-slug                   → Province discovery page
/:province-slug/:segment          → District OR category (resolved server-side)
```

### Full examples

| URL | Page type |
|-----|-----------|
| `/ho-kinh-doanh/vuon-bo-ba-nam` | Storefront page |
| `/dong-nai` | Province browse — all storefronts in Đồng Nai |
| `/dong-nai/xuan-loc` | District browse — Xuân Lộc, Đồng Nai |
| `/dong-nai/vuon-bo` | Category browse — vườn bơ in Đồng Nai |
| `/lam-dong/da-lat` | District browse — Đà Lạt, Lâm Đồng |

---

## 2. Route Resolution

The `/:province-slug/:segment` route is **ambiguous by design**: `segment` may be
a district slug or a category slug. Resolution happens in the route loader, not the URL.

```
Request: /dong-nai/xuan-loc
  1. Look up province where slug = 'dong-nai'           → province_id = 75
  2. Look up district where province_id = 75
                         AND slug = 'xuan-loc'           → found → render DistrictPage
  3. If not found → look up category where slug = 'xuan-loc'
                 → found → render CategoryInProvincePage
  4. If neither → 404
```

The route file handles both cases from one loader:

```
src/routes/$provinceSlug/$segment.tsx   ← single file, two render branches
```

This keeps URLs flat and clean without requiring a `/[province]/huyen/[district]` prefix.

---

## 3. Storefront Canonical URL

```
/ho-kinh-doanh/:slug
```

**Rules:**
- This is the ONLY canonical URL for a storefront. All other mentions of the storefront
  (search results, geo discovery cards) link here.
- Geographic discovery pages (`/dong-nai`, `/dong-nai/xuan-loc`) list storefronts
  but are NOT canonical — they are `<link rel="canonical">` pointing back to themselves,
  listing cards that link to `/ho-kinh-doanh/:slug`.
- The prefix `ho-kinh-doanh` is hardcoded in Vietnamese. It is never transliterated
  or localised to a query parameter.

**Why `/ho-kinh-doanh/` not `/store/`:**
- Target audience reads Vietnamese. Vietnamese URL builds trust and brand alignment.
- Avoids English-pattern URLs that signal generic SaaS rather than local platform.
- Consistent with the geo-first naming strategy (`/dong-nai`, `/lam-dong`).

---

## 4. Geo Discovery Routes

```
/:province-slug
/:province-slug/:district-or-category-slug
```

**Purpose:** These are browse/filter pages, not entity pages. They are canonical for
themselves (a list of storefronts matching that location).

**URL construction rules:**
- Province slug = `slugify_vn(province.name)` — e.g., `dong-nai`, `lam-dong`
- District slug = `slugify_vn(district.name)` scoped to province
- These slugs come directly from the `provinces.slug` and `districts.slug` DB columns

**No UUID, no ID parameter in geo URLs.** The slug IS the identifier on the frontend.
The DB lookup resolves slug → ID server-side.

---

## 5. Slug Rules and Collision Prevention

### Storefront slugs

- Globally unique (enforced by `UNIQUE(slug)` constraint on `storefronts` table)
- Generated from `business_name` via `slugify_vn()` algorithm
- On collision: append numeric suffix (`vuon-bo-ba-nam-2`, `vuon-bo-ba-nam-3`)
- Owner can customise slug on creation; cannot be changed after first publish
  (a rename creates a 301 redirect alias, it does not update the slug column)

### Slug generation algorithm (matches DB `slugify_vn()`)

```
"Vườn Bơ Bà Năm"
  → unaccent → "Vuon Bo Ba Nam"
  → replace Đ/đ → (unchanged here)
  → lowercase → "vuon bo ba nam"
  → [^a-z0-9]+ → '-' → "vuon-bo-ba-nam"
  → trim hyphens → "vuon-bo-ba-nam"
```

### Slug collision resolution

```typescript
async function generateUniqueSlug(base: string): Promise<string> {
  let slug = slugifyVn(base)
  let suffix = 1
  while (await slugExists(slug)) {
    slug = `${slugifyVn(base)}-${++suffix}`
  }
  return slug
}
```

---

## 6. Redirect Strategy

All redirects are **301 Permanent**. Never use 302 for slug changes.

| Scenario | From | To | HTTP |
|----------|------|----|------|
| Storefront slug rename | `/ho-kinh-doanh/old-slug` | `/ho-kinh-doanh/new-slug` | 301 |
| Province name change | `/tinh-dak-lak` | `/dak-lak` | 301 |
| District merge | `/dong-nai/tan-phu-2` | `/dong-nai/tan-phu` | 301 |

**Implementation:** Old slugs are stored in `geographic_aliases` (for geo) and a
`storefront_aliases` table (for storefronts — to be added). The route loader checks
aliases first on 404 and returns a 301 before rendering the page.

```
Request: /ho-kinh-doanh/old-slug
  1. Try storefronts where slug = 'old-slug' → not found
  2. Try storefront_aliases where alias_slug = 'old-slug' and is_active = true
     → found → redirect 301 to /ho-kinh-doanh/:current-slug
  3. 404
```

---

## 7. SEO Metadata Strategy

### Storefront page (`/ho-kinh-doanh/:slug`)

```html
<title>{business_name} — {district_name}, {province_name} | VIO LOCAL</title>
<meta name="description" content="{description truncated to 155 chars}" />
<link rel="canonical" href="https://violocal.vn/ho-kinh-doanh/{slug}" />
<meta property="og:title" content="{business_name}" />
<meta property="og:image" content="{cover_image_url ?? avatar_url}" />
```

**Indexed:** Only when `is_public = true`. Draft storefronts get `noindex`.

```html
<!-- Draft storefronts -->
<meta name="robots" content="noindex, nofollow" />
```

### Province discovery page (`/:province-slug`)

```html
<title>Hộ kinh doanh tại {province_name} | VIO LOCAL</title>
<meta name="description"
  content="Khám phá các hộ kinh doanh địa phương tại {province_name}. ..." />
<link rel="canonical" href="https://violocal.vn/{province-slug}" />
```

### District discovery page (`/:province-slug/:district-slug`)

```html
<title>Hộ kinh doanh tại {district_name}, {province_name} | VIO LOCAL</title>
<link rel="canonical" href="https://violocal.vn/{province-slug}/{district-slug}" />
```

---

## 8. Internal Linking Strategy

**Storefront card → Storefront page**
All cards everywhere link to `/ho-kinh-doanh/:slug` (canonical).

**Storefront page → Geo page**
Each storefront page links back to its district and province discovery pages,
creating a crawlable internal link graph:

```
/ho-kinh-doanh/vuon-bo-ba-nam
  → "Hộ kinh doanh tại Xuân Lộc" → /dong-nai/xuan-loc
  → "Hộ kinh doanh tại Đồng Nai" → /dong-nai
```

**Province home → District pages**
Province pages list districts that have at least one `is_public = true` storefront.
Empty districts are excluded to avoid thin-content geo pages.

```sql
select d.slug, d.name, count(s.id) as storefront_count
from districts d
join storefronts s on s.district_id = d.id and s.is_public = true
where d.province_id = :province_id
group by d.id
having count(s.id) > 0
order by storefront_count desc;
```

---

## 9. TanStack Router File Structure

```
src/routes/
├── ho-kinh-doanh/
│   └── $slug.tsx               ← /ho-kinh-doanh/:slug (storefront page)
├── $provinceSlug/
│   ├── index.tsx               ← /:province-slug (province discovery)
│   └── $segment.tsx            ← /:province-slug/:segment (district or category)
└── __root.tsx
```

Route loader for `$segment.tsx` resolves the ambiguity:

```typescript
// routes/$provinceSlug/$segment.tsx
export const Route = createFileRoute('/$provinceSlug/$segment')({
  loader: async ({ params }) => {
    const province = await getProvinceBySlug(params.provinceSlug)
    if (!province) throw notFound()

    const district = await getDistrictBySlug(province.id, params.segment)
    if (district) return { type: 'district', province, district }

    const category = await getCategoryBySlug(params.segment)
    if (category) return { type: 'category', province, category }

    throw notFound()
  },
  component: ProvinceSegmentPage,
})
```

---

## 10. Anti-patterns to Avoid

| Anti-pattern | Why | Alternative |
|---|---|---|
| `/store/123abc` | UUID leaks internals, zero SEO value | `/ho-kinh-doanh/slug` |
| `/stores?id=123` | Parameter-heavy, not crawlable | Slug-based path |
| `/vn/dong-nai/...` | Locale prefix adds depth with no benefit | `/:province-slug` |
| `/shop/dong-nai/quan/xuan-loc/...` | 4+ levels of nesting | `/:province-slug/:segment` |
| Separate `/district/` namespace | Breaks flat URL goal | Resolve ambiguity in loader |
| 302 for slug changes | Search engines don't consolidate PageRank | Always 301 |
