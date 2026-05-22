# Storefront SEO Implementation

This document covers the **implementation layer** for storefront page SEO.  
For site-wide SEO strategy, see [`SEO_ARCHITECTURE.md`](SEO_ARCHITECTURE.md).  
For URL structure and routing, see [`STOREFRONT_ROUTING.md`](STOREFRONT_ROUTING.md).

---

## 1. Scope

Every storefront at `/ho-kinh-doanh/:slug` must produce five things:

```
1. <title>            → Google SERP + browser tab
2. <meta description> → Google SERP snippet
3. <link canonical>   → deduplication signal
4. <meta robots>      → index gate for drafts
5. OpenGraph + Twitter Card → Facebook + TikTok link preview
6. JSON-LD LocalBusiness   → Google rich results + Maps
```

All six are generated from a single function:  
→ [`src/features/storefronts/utils/seo.ts`](../src/features/storefronts/utils/seo.ts) — `buildStorefrontMeta()`

---

## 2. Title Formula

**Max 60 characters.** Google truncates at ~60.

```
{business_name} tại {district}, {province} | VIO LOCAL
```

| Storefront | Output |
|---|---|
| "Vườn Bơ Bà Năm" in Xuân Lộc, Đồng Nai | `Vườn Bơ Bà Năm tại Xuân Lộc, Đồng Nai \| VIO LOCAL` |
| "Cá Tươi Anh Hai" in Đắk Lắk (no district) | `Cá Tươi Anh Hai tại Đắk Lắk \| VIO LOCAL` |
| No geo attached | `Vườn Bơ Bà Năm \| VIO LOCAL` |

**Why "tại" not "–":**  
"Tại" is the Vietnamese preposition for location. Google's Vietnamese crawlers understand it as a geo signal, not punctuation. A dash gives zero geo signal.

**Avoid:**
- Keyword repetition: `Vườn bơ bơ bơ Đồng Nai`
- Generic suffix: `| Trang chủ` (says nothing)
- UUID: `Vườn Bơ Bà Năm (ID: 4f8a2b)`

---

## 3. Meta Description Formula

**150–155 characters.** Built from three parts:

```
[owner description, truncated] + [location string] + [contact nudge]
```

| Field | Example |
|---|---|
| Owner description | "Bơ sáp tươi từ vườn nhà, thu hoạch mỗi sáng." |
| Location string | "Huyện Xuân Lộc, Tỉnh Đồng Nai" |
| Contact nudge | "Liên hệ qua Zalo." |
| **Final** | "Bơ sáp tươi từ vườn nhà, thu hoạch mỗi sáng. Huyện Xuân Lộc, Tỉnh Đồng Nai. Liên hệ qua Zalo." |

**Contact nudge priority:**
1. Zalo → "Liên hệ qua Zalo." ← most used in rural Vietnam
2. Phone → "Gọi 0912 345 678."
3. Facebook → "Nhắn tin Facebook."
4. None → "Xem thông tin liên hệ."

This makes the description a **call-to-action**, not a data dump. It also embeds the geo name (location string) which is a SERP ranking factor.

**Avoid:**
- Repeating the title word-for-word
- Ending mid-sentence (truncation artifact)
- Generic: "Tìm hiểu thêm về hộ kinh doanh này"

---

## 4. OpenGraph Tags

Used by: Facebook, Zalo, LinkedIn, TikTok (as fallback).

```html
<!-- Identity -->
<meta property="og:site_name"   content="VIO LOCAL" />
<meta property="og:type"        content="business.business" />
<meta property="og:locale"      content="vi_VN" />

<!-- Content -->
<meta property="og:title"       content="Vườn Bơ Bà Năm tại Xuân Lộc, Đồng Nai | VIO LOCAL" />
<meta property="og:description" content="Bơ sáp tươi từ vườn nhà... Liên hệ qua Zalo." />
<meta property="og:url"         content="https://violocal.vn/ho-kinh-doanh/vuon-bo-ba-nam" />

<!-- Image -->
<meta property="og:image"       content="https://cdn.violocal.vn/sf/cover/vuon-bo-ba-nam.jpg" />
<meta property="og:image:alt"   content="Vườn Bơ Bà Năm — ảnh bìa" />
```

**`og:type = "business.business"`** (not `"website"`)  
Facebook uses this type to render a richer preview with the address visible in the card.  
Zalo ignores it. TikTok ignores it. But it costs nothing and helps on Facebook.

**`og:locale = "vi_VN"`**  
Tells Facebook the language is Vietnamese. Without this, Facebook may show the link preview in wrong script or classify the content incorrectly.

---

## 5. Twitter / TikTok Card

TikTok reads `twitter:card` meta tags (it does not have its own system).  
Twitter/X also reads these. Use `summary_large_image` always for storefronts.

```html
<meta name="twitter:card"        content="summary_large_image" />
<meta name="twitter:title"       content="Vườn Bơ Bà Năm tại Xuân Lộc, Đồng Nai | VIO LOCAL" />
<meta name="twitter:description" content="Bơ sáp tươi từ vườn nhà... Liên hệ qua Zalo." />
<meta name="twitter:image"       content="https://cdn.violocal.vn/sf/cover/vuon-bo-ba-nam.jpg" />
```

**`summary_large_image` vs `summary`:**  
`summary_large_image` renders the cover image full-width in the TikTok link preview.  
`summary` renders a small thumbnail. For a storefront, the cover image IS the first impression — always use large.

---

## 6. OG Image Strategy

Image selection order (falls through if null):

```
1. storefront.cover_image_url   ← landscape, designed for sharing
2. storefront.avatar_url        ← square logo/avatar
3. /images/og-default.jpg       ← platform fallback
```

**Required dimensions for full-bleed previews:**

| Platform | Minimum | Recommended | Aspect |
|---|---|---|---|
| Facebook | 600×315 | 1200×630 | 1.91:1 |
| TikTok   | 200×200 | 1200×630 | Any (crops to square on mobile) |
| Zalo     | 300×157 | 1200×630 | 1.91:1 |

**Practical rule:** Upload cover images at **1200×630px minimum**.  
Avatar images at **400×400px minimum** (displayed square).

**Avoid:**
- Images under 200×200 (Facebook rejects them from preview)
- Images with text overlays (Facebook may suppress text-heavy images)
- Storing raw user-uploaded images without resizing (serves 4MB images as OG image)

---

## 7. Structured Data (JSON-LD LocalBusiness)

Embedded as `<script type="application/ld+json">` in the `<head>`.

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://violocal.vn/ho-kinh-doanh/vuon-bo-ba-nam#business",

  "name": "Vườn Bơ Bà Năm",
  "url": "https://violocal.vn/ho-kinh-doanh/vuon-bo-ba-nam",
  "description": "Bơ sáp tươi từ vườn nhà, thu hoạch mỗi sáng.",

  "telephone": "+84912345678",

  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Huyện Xuân Lộc",
    "addressRegion": "Tỉnh Đồng Nai",
    "addressCountry": "VN"
  },

  "image": [
    "https://cdn.violocal.vn/sf/cover/vuon-bo-ba-nam.jpg",
    "https://cdn.violocal.vn/sf/avatar/vuon-bo-ba-nam.jpg"
  ],

  "sameAs": [
    "https://www.facebook.com/vuonboba",
    "https://www.tiktok.com/@vuonboba"
  ]
}
```

**Field rules:**

| Field | Rule |
|---|---|
| `@id` | `{canonical}#business` — stable identifier, not the page URL itself |
| `telephone` | Format as `+84{digits without leading 0}` |
| `address.addressCountry` | Always `"VN"` |
| `address.addressRegion` | Use `province.name_full` ("Tỉnh Đồng Nai", not "Đồng Nai") |
| `address.addressLocality` | Use `district.name_full` ("Huyện Xuân Lộc", not "xuan-loc") |
| `sameAs` | Only Facebook and TikTok — not Zalo (no stable public profile URL format) |
| `image` | Array with cover first, avatar second — Google uses first image for rich result |

**What NOT to include in structured data:**

```
❌ openingHours     — we don't collect this
❌ priceRange       — no pricing model yet
❌ aggregateRating  — no review system yet
❌ hasMap           — no lat/lng on storefronts yet
```

Empty/null fields with no data hurt more than omitting them. `buildLocalBusinessSchema()` only adds fields that have real values.

---

## 8. Index Gate

**`is_public = false`** (draft) → `noindex, nofollow`  
**`is_public = true`** (published) → `index, follow`

```html
<!-- Draft storefront -->
<meta name="robots" content="noindex, nofollow" />

<!-- Published storefront -->
<meta name="robots" content="index, follow" />
```

**Why `nofollow` on drafts** (not just `noindex`):  
`noindex` alone still allows Google to follow links on the page. A draft storefront shouldn't pass link equity to its social profile links until it's published.

**Additional noindex triggers (handled at route level, not in `seo.ts`):**

| Condition | Robots |
|---|---|
| Storefront not found (404) | Page is 404, no meta needed |
| Storefront owner === viewer (preview mode) | `noindex, nofollow` |
| Province/district with 0 storefronts | `noindex, follow` (geo page) |

---

## 9. Canonical URL

Always the storefront's own URL. Never points to a discovery page or homepage.

```html
<link rel="canonical" href="https://violocal.vn/ho-kinh-doanh/vuon-bo-ba-nam" />
```

**Canonical ≠ redirect.** If the storefront slug changes:
- The OLD slug URL gets a **301 redirect** → new URL
- The NEW URL has canonical pointing to itself
- The canonical does NOT point from new → old

---

## 10. Integration with TanStack Start

`buildStorefrontMeta()` returns a plain object. Wire it into TanStack Start's `useHead()`:

```typescript
// src/routes/ho-kinh-doanh/$slug.tsx
import { useHead } from '@unhead/react'
import { buildStorefrontMeta } from '~/features/storefronts/utils/seo'

export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
  loader: async ({ params }) => {
    const storefront = await getStorefrontBySlug(params.slug)
    if (!storefront) throw notFound()

    const geo = await resolveStorefrontGeo(storefront)
    const meta = buildStorefrontMeta({ storefront, geo })
    return { storefront, geo, meta }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const { meta } = loaderData
    return {
      meta: [
        { name: 'description',          content: meta.description },
        { name: 'robots',                content: meta.robots },
        // OpenGraph
        { property: 'og:title',          content: meta.openGraph.title },
        { property: 'og:description',    content: meta.openGraph.description },
        { property: 'og:url',            content: meta.openGraph.url },
        { property: 'og:image',          content: meta.openGraph.image },
        { property: 'og:image:alt',      content: meta.openGraph.imageAlt },
        { property: 'og:type',           content: meta.openGraph.type },
        { property: 'og:locale',         content: meta.openGraph.locale },
        { property: 'og:site_name',      content: meta.openGraph.siteName },
        // Twitter / TikTok
        { name: 'twitter:card',          content: meta.twitter.card },
        { name: 'twitter:title',         content: meta.twitter.title },
        { name: 'twitter:description',   content: meta.twitter.description },
        { name: 'twitter:image',         content: meta.twitter.image },
      ],
      links: [
        { rel: 'canonical', href: meta.canonical },
      ],
      script: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(meta.structuredData),
        },
      ],
      title: meta.title,
    }
  },
  component: StorefrontPage,
})
```

---

## 11. Discovery Pages (Province / District)

This document covers storefront pages only. Discovery pages (`/:province-slug`, `/:province-slug/:segment`) use a different but simpler formula:

```typescript
// Province page title
`Hộ kinh doanh tại ${province.name_full} | VIO LOCAL`

// District page title  
`Hộ kinh doanh tại ${district.name_full}, ${province.name} | VIO LOCAL`
```

Discovery page structured data uses `ItemList` schema (list of storefronts), not `LocalBusiness`. Implementation deferred to discovery feature build.

---

## 12. Anti-patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| Same title on every storefront | Duplicate metadata penalty | Dynamic title from `buildTitle()` |
| Description = title repeated | Wasted SERP real estate | Different copy, includes contact CTA |
| `og:type = "website"` | Loses Facebook rich business card | Use `"business.business"` |
| No `og:locale` | Facebook may misclassify language | Always `"vi_VN"` |
| `sameAs` with Zalo number URL | No stable Zalo profile URL format | Only Facebook + TikTok in `sameAs` |
| Structured data with empty fields | Schema validation warnings | Omit fields with no data |
| `noindex` on published pages | De-indexes valid storefronts | Gate only on `is_public = false` |
| OG image 200×200 | Facebook rejects tiny previews | Minimum 1200×630 for cover |
| `twitter:card = "summary"` | Small preview on TikTok | Always `"summary_large_image"` |
