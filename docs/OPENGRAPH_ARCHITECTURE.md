# OpenGraph Architecture — VIO LOCAL

## The Problem with Generic OG

A marketplace that renders the same OG image (a logo on a white background) for every page gets the same click-through rate on every page: low. The goal is **entity-specific previews that make the content immediately recognizable before the user taps**.

On a Vietnamese mobile screen:
- A Facebook share of a storefront should look like a business card.
- A TikTok bio link to a land listing should show the land, the area, and the price at a glance.
- A Zalo message with a product link should show the product image in the thumbnail.

Achieving this requires different OG metadata per entity type — not a global template.

---

## Architecture Overview

```
Single set of <meta> tags per page
       │
       ├── og:*          ← read by Facebook, Zalo, LinkedIn, most crawlers
       └── twitter:*     ← read by TikTok (and Twitter/X)
```

One canonical code path: `ogToHeadMeta(og: OgMeta)` in `src/services/seo/og.ts` converts a typed `OgMeta` object into the full meta array. Every entity's `seo.ts` builds an `OgMeta` and passes it to this function.

No per-platform branch logic in the application layer — Facebook and Zalo both read `og:*`, TikTok reads `twitter:*`. The same tag set serves all three.

---

## Tag Architecture

### Required tags — every page, no exceptions

```html
<!-- Core identity -->
<meta property="og:title"       content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url"         content="{canonical absolute URL}">
<meta property="og:type"        content="{type}">
<meta property="og:locale"      content="vi_VN">
<meta property="og:site_name"   content="VIO LOCAL">

<!-- Image -->
<meta property="og:image"        content="{absolute image URL}">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type"   content="image/webp">
<meta property="og:image:alt"    content="{descriptive alt text}">

<!-- Twitter / TikTok -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="{same as og:title}">
<meta name="twitter:description" content="{same as og:description}">
<meta name="twitter:image"       content="{same as og:image}">
<meta name="twitter:image:alt"   content="{same as og:image:alt}">
```

### Why `og:image:width` and `og:image:height` are required

Without explicit dimensions, Facebook and Zalo must download the image to determine layout before rendering the card. This causes a rendering delay and sometimes results in broken previews on slow connections. Declaring `1200` and `630` lets the platform pre-allocate the card space.

### Why `og:url` must match `<link rel="canonical">`

Facebook's cache key is `og:url`, not the page URL. If `og:url` differs from canonical, Facebook creates a separate cache entry for each URL variant that shares the same `og:url` — causing count divergence (likes, comments) across URL variants. Rule: `og:url` = canonical = `<link rel="canonical">`.

---

## Per-Entity OG Specification

### Storefronts — `/ho-kinh-doanh/:slug`

```
og:type     business.business
og:image    storefronts/{id}/cover.webp → transformed 1200×630
            fallback: storefronts/{id}/avatar.webp → transformed 1200×630
twitter:card  summary_large_image
```

**Title formula:**
```
{business_name} — {district or province} | VIO LOCAL
```
Examples:
```
Cà Phê Buôn Me — Buôn Ma Thuột, Đắk Lắk | VIO LOCAL
Vườn Sầu Riêng Gia Đình — Xuân Lộc, Đồng Nai | VIO LOCAL
```

**Description formula (max 160 chars):**
```
{owner description, truncated}. Tại {geo}. {contact nudge}.
```
Example:
```
Cà phê Robusta và Arabica từ nông trại gia đình Cư M'gar.
Tại Buôn Ma Thuột, Đắk Lắk. Liên hệ qua Zalo hoặc gọi trực tiếp.
```

**og:type = "business.business":**
Facebook-specific extended type. Renders a richer card with a map pin icon. Does not require `og:latitude/longitude` to be valid — omit geo coordinates until PostGIS is added. The card will render without coordinates; it just won't show a map pin.

**og:image alt text:**
```
{business_name} tại {district}, {province}
```

---

### Products — `/san-pham/:slug`

```
og:type     website
og:image    products/{id}/0.webp → transformed 1200×630
twitter:card  summary_large_image
```

**Title formula:**
```
{title} tại {district or province} | VIO LOCAL
```
Examples:
```
Cà Phê Robusta 1kg Đắk Lắk tại Cư M'gar, Đắk Lắk | VIO LOCAL
Sầu Riêng Ri6 Xuân Lộc tại Xuân Lộc, Đồng Nai | VIO LOCAL
```

**Description formula:**
```
{price_text, if any}. {short description or title repeated with context}.
Từ {business_name}. Liên hệ để đặt hàng.
```

**Why not `og:type = "product"`:**
`og:type = "product"` is a Facebook extension that requires `product:price:amount` and `product:price:currency` for the rich product card. VIO LOCAL uses `price_text` (free-form: "850 triệu", "Thương lượng") — a numeric price is not available. Using `og:type = "product"` without the required price fields produces a broken Facebook card. Use `website` instead.

---

### Services — `/dich-vu/:slug`

```
og:type     website
og:image    services/{id}/0.webp → transformed 1200×630
twitter:card  summary_large_image
```

**Title formula:**
```
{title} tại {district or province} | VIO LOCAL
```

**Description formula:**
```
{service_area_text, if any}. {short description}.
Từ {business_name}. Gọi hoặc nhắn Zalo để tư vấn.
```

---

### Land Listings — `/dat-nong-nghiep/:slug`

```
og:type     website
og:image    land-listings/{id}/0.webp → transformed 1200×630
twitter:card  summary_large_image
```

**Title formula:**
```
{title} tại {district}, {province} | VIO LOCAL
```
Example:
```
Đất Vườn Sầu Riêng 2ha Xuân Lộc tại Xuân Lộc, Đồng Nai | VIO LOCAL
```

**Description formula:**
```
{land_area_text} · {land_type_label} · {legal_status_text}. Giá: {price_text}.
Vị trí: {geo}. Liên hệ chủ đất trực tiếp.
```
Example:
```
2 hectares · Đất cây ăn trái · Sổ đỏ đầy đủ. Giá: 1.2 tỷ.
Vị trí: Xuân Lộc, Đồng Nai. Liên hệ chủ đất trực tiếp.
```

**og:image alt text:**
```
{title} — {land_type_label} tại {district}, {province}
```

---

### Discovery Pages — `/:province`, `/:province/:district`, `/dat-nong-nghiep/:province`

```
og:type     website
og:image    platform default OG image (public/images/og-default.webp)
            OR: top storefront's cover image in the area
twitter:card  summary  ← no single dominant image; summary card is cleaner
```

**Title formula:**
```
Hộ kinh doanh tại {province_name_full} — {N} kết quả | VIO LOCAL
Hộ kinh doanh tại {district_name_full}, {province} — {N} kết quả | VIO LOCAL
Đất nông nghiệp {province_name_full} — {N} tin đăng | VIO LOCAL
```

**Why `twitter:card = "summary"` for discovery pages:**
`summary_large_image` requires a compelling single image. A discovery page represents many businesses — no single image represents the page. `summary` renders a small thumbnail + text, which is more honest about the page's content.

---

## Image Composition Rules

### Dimensions and aspect ratio

| Dimension | Value | Used for |
|---|---|---|
| OG image size | 1200 × 630 px | All entity pages |
| Aspect ratio | 1.91 : 1 | Facebook native, TikTok native |
| Zalo safe zone | 630 × 630 px centered | Thumbnail crop in chat |
| Min file size | — | No minimum |
| Max file size | 8 MB | Facebook limit |
| Format | WebP | Supabase Transform output |
| Quality | 80 | Supabase Transform `quality=` param |

### Supabase Transform URL

All OG images are generated on-demand by the Supabase Storage Transform API:

```
{SUPABASE_URL}/storage/v1/render/image/public/media/{path}
  ?width=1200
  &height=630
  &resize=cover    ← crops to exact dimensions (centre crop)
  &quality=80
  &format=webp
```

**`resize=cover` is deliberate.** It crops the image to exactly 1200×630. The alternative `resize=contain` adds letterbox bars (grey/black padding) which looks broken in Facebook cards and Zalo previews.

Implementation: `buildOgImageUrl(storagePath)` in `src/services/seo/og.ts`.

### Source image priority per entity

| Entity | Primary | Fallback |
|---|---|---|
| Storefront | `storefronts/{id}/cover.webp` | `storefronts/{id}/avatar.webp` |
| Product | `products/{id}/0.webp` (cover) | platform default |
| Service | `services/{id}/0.webp` (cover) | platform default |
| Land listing | `land-listings/{id}/0.webp` (cover) | platform default |
| Discovery page | platform default | — |

**Why cover image, not avatar:**
Avatar images are square (profile photo). When transformed to 1200×630, the Transform API crops the sides, potentially hiding the face. Cover images are already captured at landscape ratio — they transform cleanly.

### Zalo safe zone

Zalo renders link previews as a square thumbnail in chat and some feed surfaces. The thumbnail is a centre crop of the OG image. Content outside the centre 630×630 area may be hidden.

```
┌────────────────────────────────────────────────────────┐
│  ← 285px →  ┌──────────────────────┐  ← 285px →      │
│             │   ZALO SAFE ZONE     │                   │
│   1200px    │     630 × 630px      │                   │
│   total     │   Business name,     │                   │
│             │   price, key detail  │                   │
│             └──────────────────────┘                   │
└────────────────────────────────────────────────────────┘
```

**Implication for photo uploads:** When a storefront owner uploads a cover image, the upload UI should recommend landscape photos with the main subject centred. Future enhancement: add a crop preview that shows the Zalo safe zone.

### Platform default OG image

When no entity-specific image is available (draft storefront, listing without photos, discovery pages), serve `public/images/og-default.webp` at 1200×630. This image should:
- Use the platform's brand colours
- Include the VIO LOCAL wordmark
- Include the platform tagline in Vietnamese
- Have all important content within the Zalo safe zone

---

## Platform-Specific Behaviour

### Facebook

| Signal | Behaviour |
|---|---|
| `og:type = "business.business"` | Renders map pin icon, business card layout |
| `og:image:width/height` | Required for correct card sizing without download |
| Cache duration | 24 hours (default); force re-scrape via Sharing Debugger |
| Cache key | `og:url` value, not the request URL |
| Scraping agent | `facebookexternalhit/1.1` |
| Image format support | JPEG, WebP, PNG — WebP preferred (smaller) |
| Min image size | 200×200 px (will not render smaller) |
| Max image size | 8MB |

**Force re-scrape** after a storefront updates their cover image:
```
https://developers.facebook.com/tools/debug/?q={encoded page URL}
```
Facebook's CDN caches OG images separately from meta tags. The image URL is deterministic (`storefronts/{id}/cover.webp`) — Facebook re-fetches if the image URL changes. If the image content changes without a URL change, Facebook may serve the old version for up to 24 hours.

### TikTok

| Signal | Behaviour |
|---|---|
| `twitter:card = "summary_large_image"` | Wide image preview in bio link |
| `twitter:title` | Displayed as link preview title |
| `twitter:description` | Displayed as link preview subtitle |
| `twitter:image` | Full 1200×630 image in preview |
| Scraping agent | `TikTokBot` (also scrapes og:* as fallback) |
| Bio link | One link; shown as card with image + title |
| Video description links | Clickable; OG preview shown when user clicks |

**TikTok reads `twitter:*` first, then falls back to `og:*`.** Keep both in sync — `ogToHeadMeta()` automatically writes both from the same `OgMeta` source.

**TikTok is the highest-priority sharing channel for VIO LOCAL.** Rural Vietnam TikTok adoption is very high. A storefront owner sharing their page in a TikTok video description can drive significant discovery. The `summary_large_image` card makes the business name and cover photo visible without tapping.

### Zalo

| Signal | Behaviour |
|---|---|
| `og:title` | Link preview title in chat and feed |
| `og:description` | Link preview subtitle |
| `og:image` | Full 1200×630 shown on tap; thumbnail = centre crop |
| `og:url` | Required for de-duplication in Zalo feed |
| Scraping agent | `ZaloBot` (undocumented; reads og:* protocol) |
| Chat preview | Square thumbnail + title + domain |
| Zalo feed share | Full 1200×630 card |
| `twitter:*` support | Not confirmed — use og:* as canonical |

**Zalo is the primary contact channel for the platform.** Storefront pages show Zalo URLs in contact sections. When a user shares a land listing via Zalo, the OG image appears as a square thumbnail in the chat. The Zalo safe zone rule (630×630 centred) ensures the key information is not cropped.

**Zalo OA (Official Accounts):** If VIO LOCAL has a Zalo OA, link sharing from the OA benefits from a larger preview card. This is a future consideration — the OG tag implementation is the same regardless.

---

## Geo-Aware Metadata

Location signals must appear in title AND description — not just in the page content. Crawlers and sharing platforms only see the meta tags, not the page body.

### Title geo insertion rule

| Entity | Geo in title | Example |
|---|---|---|
| Storefront | district + province | `… — Buôn Ma Thuột, Đắk Lắk \| VIO LOCAL` |
| Product | district or province (where available) | `… tại Cư M'gar, Đắk Lắk \| VIO LOCAL` |
| Service | district or province | `… tại Xuân Lộc, Đồng Nai \| VIO LOCAL` |
| Land listing | district + province | `… tại Xuân Lộc, Đồng Nai \| VIO LOCAL` |
| Province page | province full name | `Hộ kinh doanh tại Đắk Lắk \| VIO LOCAL` |
| District page | district full name + province | `Hộ kinh doanh tại Xuân Lộc, Đồng Nai \| VIO LOCAL` |

**Use `name_full` not `name` in meta.** `name` for Đắk Lắk districts might be abbreviations; `name_full` is the unabbreviated form that matches how users search ("Buôn Hồ" vs "Thị xã Buôn Hồ"). The title uses short form; descriptions use full form.

### Description geo signal

Every description should include `tại {location}` — Vietnamese users scan for the location word. Search engines use it for local intent classification.

```
Correct:   "Cà phê Robusta 1kg. Tại Cư M'gar, Đắk Lắk."
Incorrect: "Cà phê Robusta 1kg sản xuất tại địa phương."  ← "địa phương" is not indexable
```

### og:locale

Always `vi_VN`. This signals to Facebook and other platforms:
- Language: Vietnamese
- Region: Vietnam
- Character encoding expectations: UTF-8 with diacritics

Do not use `vi` (no region variant). `vi_VN` is the standard for Vietnam-targeted content.

---

## Dynamic Generation Pattern (TanStack Start)

```typescript
// src/routes/ho-kinh-doanh/$slug.tsx

import { buildStorefrontMeta } from '../../features/storefronts/utils/seo'
import { ogToHeadMeta } from '../../services/seo/og'

export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
  loader: async ({ params, context }) => {
    const storefront = await getStorefrontBySlug(context.supabase, params.slug)
    if (!storefront) throw notFound()

    const geo     = await resolveGeo(context.supabase, storefront)
    const meta    = buildStorefrontMeta({ storefront, geo })

    return {
      storefront,
      geo,
      // Pre-built head meta array — no computation in the component
      headMeta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
        { name: 'robots',      content: meta.robots },
        { name: 'canonical',   content: meta.canonical },
        ...ogToHeadMeta(meta.og),
      ],
    }
  },

  head: ({ loaderData }) => ({
    meta: loaderData.headMeta,
  }),
})
```

**All OG computation happens in the loader (server-side), never in a component.** This ensures crawlers see the full meta tags without executing JavaScript.

---

## Duplicate OG Prevention

### One canonical OG tag set per URL

No page should have multiple `og:title` or `og:image` tags. TanStack Start's `head()` API replaces, not appends — but the parent route's `head()` and the child route's `head()` can both inject meta. Guard against this by moving all meta computation to the leaf route loader.

### og:url must equal canonical

```
og:url                 = canonical URL
<link rel="canonical"> = canonical URL
```

If a storefront page is accessed via a URL with a `?ref=facebook` parameter, the canonical and `og:url` should both strip the parameter and point to the clean URL. The robots.txt `Disallow: /*?ref=` prevents crawling of the dirty URL, but a user who shares the URL will get the correct OG card because `og:url` points to the clean version.

### Discovery pages: no individual entity OG

Province and district discovery pages use the platform default image — they never show a single storefront's image as the OG image. Doing so would misrepresent the page (it shows many storefronts, not one).

---

## Anti-Patterns

| Anti-pattern | Why | Fix |
|---|---|---|
| Same OG image for all pages (logo on white) | Every share looks identical; no content signal | Entity-specific images via Supabase Transform |
| `resize=contain` in Transform URL | Letterbox bars look broken in Facebook cards | Use `resize=cover` — crop, don't pad |
| `og:url` = request URL (with params) | Each param variant gets its own FB cache entry | `og:url` always = canonical, no params |
| `og:type = "product"` without price fields | Broken Facebook product card | Use `website` for listings |
| Relative URL in `og:image` | Ignored by all platforms — must be absolute | Always prefix with `getSiteUrl()` |
| Omitting `og:image:width/height` | Platform downloads image before rendering card | Always declare `width=1200 height=630` |
| Different title in og:title vs `<title>` | Facebook shows og:title; Google shows `<title>` | Keep them identical — build from same formula |
| Vietnamese text without diacritics in og:title | "Cửa hàng" truncated to "Ca hng" looks corrupt | UTF-8 + diacritics required; `og:locale = "vi_VN"` |
| Dynamic OG generation in React component | Crawlers see blank meta until JS executes | Always compute in route loader (SSR) |
| Missing `twitter:card` | TikTok falls back to `og:*` with no layout hint | Always set `twitter:card = "summary_large_image"` |
| Using `og:image` path without bucket prefix | Supabase Transform URL breaks silently | Always include full `/storage/v1/render/…` path |
