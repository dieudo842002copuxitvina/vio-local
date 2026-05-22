# Listing SEO — Products & Services

SEO implementation for `/san-pham/:slug` and `/dich-vu/:slug` pages.  
For storefront page SEO, see [`STOREFRONT_SEO.md`](STOREFRONT_SEO.md).  
For site-wide SEO strategy, see [`SEO_ARCHITECTURE.md`](SEO_ARCHITECTURE.md).

---

## 1. Why Products and Services Use Different SEO

Products and services diverge at the **search intent** level:

```
PRODUCT intent:    "bơ sáp đắk lắk"       → find & buy seasonal agricultural goods
SERVICE intent:    "sấy nông sản đồng nai"  → find a provider to call
```

Different intent = different title formula, different structured data type, different description copy.  
This is why `categories.type = 'product' | 'service'` is enforced at the DB level — it's not cosmetic.

---

## 2. URL Canonical Structure

```
Products:  /san-pham/:slug        e.g. /san-pham/bo-sap-dak-lak
Services:  /dich-vu/:slug         e.g. /dich-vu/say-nong-san-dong-nai
```

**Slug recommendation for products**: include the province/crop at creation time.  
`"Bơ Sáp"` → `bo-sap` (generic, will collide) vs `bo-sap-dak-lak` (unique, geo-enriched).

**Slug recommendation for services**: include the service type and location.  
`"Sấy Nông Sản"` → `say-nong-san` (will collide) vs `say-nong-san-dong-nai` (better).

These aren't enforced by the DB — the slug generator in `utils/` must embed geo context.

---

## 3. Product Title Formula

**Max 60 characters.**

```
{title} – {category} tại {district}, {province} | VIO LOCAL
```

| Field state | Title output |
|---|---|
| title + district + province | `Bơ Sáp Xanh – Trái cây tại Xuân Lộc, Đồng Nai \| VIO LOCAL` |
| title + province only | `Bơ Sáp Xanh – Trái cây tại Đắk Lắk \| VIO LOCAL` |
| title + harvest_season + province | `Bơ Sáp Đắk Lắk (vụ tháng 6-8) \| VIO LOCAL` ← seasonal variant |
| title only (no geo) | `Bơ Sáp Xanh – Liên hệ trực tiếp \| VIO LOCAL` |

**Seasonal title variant** (use when `harvest_season` is set):  
Embed the season to capture searches like "bơ sáp tháng 7":
```
{title} (vụ {harvest_season}) – {province} | VIO LOCAL
```

---

## 4. Service Title Formula

```
{title} – {category} tại {province} | VIO LOCAL
```

| Field state | Title output |
|---|---|
| title + province | `Sấy Nông Sản – Dịch vụ nông nghiệp tại Đồng Nai \| VIO LOCAL` |
| title + service_area_text | `Máy Gặt Đập Liên Hợp – Phục vụ Bình Phước và lân cận \| VIO LOCAL` |
| title only | `Kho Lạnh Cho Thuê – Liên hệ báo giá \| VIO LOCAL` |

---

## 5. Product Meta Description Formula

**150–155 chars. Three parts: product context + geo + contact.**

```
[price_text or harvest or quantity hint] + [geo string] + [storefront name + contact nudge]
```

**Priority for the first part:**
1. `harvest_season` — most distinctive signal for agricultural products
2. `price_text` — if available
3. `quantity_text` — if available
4. `description` (truncated)

**Examples:**

```
Bơ sáp thu hoạch tháng 6-8 hàng năm. Huyện Xuân Lộc, Tỉnh Đồng Nai.
Từ Vườn Bơ Bà Năm — liên hệ Zalo.
→ 118 chars ✓

Cà phê Robusta 200.000đ/kg. Huyện Ea H'leo, Tỉnh Đắk Lắk.
Từ Trang Trại Cà Phê Năm Mười — gọi 0912 345 678.
→ 111 chars ✓
```

**Never use:**
- "Mua ngay" / "Đặt hàng" — no cart, no order button
- Generic: "Sản phẩm chất lượng cao"
- Repeating the title verbatim

---

## 6. Service Meta Description Formula

```
[service coverage] + [geo string] + [contact nudge]
```

```
Dịch vụ sấy nông sản cho thuê, phục vụ toàn tỉnh Đồng Nai.
Tỉnh Đồng Nai. Từ Cơ Sở Sấy Anh Tú — liên hệ Zalo để báo giá.
→ 123 chars ✓
```

If `service_area_text` is set, lead with it — it answers "does this service cover my area?" directly in the SERP snippet.

---

## 7. OpenGraph Tags

Products and services use the same OG structure as storefronts, with one difference: `og:type`.

```html
<!-- Product page -->
<meta property="og:type"  content="product" />
<meta property="og:title" content="Bơ Sáp Xanh (vụ tháng 6-8) – Đắk Lắk | VIO LOCAL" />

<!-- Service page -->
<meta property="og:type"  content="website" />
<!-- og:type = "service" is not an official OG type; fall back to "website" -->
```

**OG image selection** (same priority as storefronts):
1. First image in `product_images` / `service_images` ordered by `sort_order`
2. Storefront `cover_image_url`
3. Storefront `avatar_url`
4. Platform default `/images/og-default.jpg`

**For TikTok/Twitter:**
```html
<meta name="twitter:card" content="summary_large_image" />
```
Always `summary_large_image` — product photos need the full viewport on TikTok share.

---

## 8. JSON-LD Structured Data

### Product schema

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://violocal.vn/san-pham/bo-sap-dak-lak#product",

  "name": "Bơ Sáp Xanh",
  "url": "https://violocal.vn/san-pham/bo-sap-dak-lak",
  "description": "Bơ sáp thu hoạch tháng 6-8 hàng năm tại Đắk Lắk.",

  "image": [
    "https://cdn.violocal.vn/products/bo-sap-1.jpg"
  ],

  "brand": {
    "@type": "Brand",
    "name": "Vườn Bơ Bà Năm"
  },

  "offers": {
    "@type": "Offer",
    "availability": "https://schema.org/InStock",
    "priceCurrency": "VND",
    "seller": {
      "@type": "LocalBusiness",
      "@id": "https://violocal.vn/ho-kinh-doanh/vuon-bo-ba-nam#business"
    }
  }
}
```

**`offers.price` rule:** Do NOT include a numeric price. Use `Offer` only for availability and seller. If you include `price: 0`, Google may display "0₫" in rich results.

**`offers.availability`:**
- `is_available = true`  → `"https://schema.org/InStock"`
- `is_available = false` → `"https://schema.org/OutOfStock"`

**Seasonal note:** Schema.org has no standard field for harvest season. Put it in `description` — Google reads natural language in the description field.

### Service schema

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://violocal.vn/dich-vu/say-nong-san-dong-nai#service",

  "name": "Sấy Nông Sản",
  "url": "https://violocal.vn/dich-vu/say-nong-san-dong-nai",
  "description": "Dịch vụ sấy nông sản cho thuê. Phục vụ toàn tỉnh Đồng Nai.",

  "areaServed": {
    "@type": "State",
    "name": "Tỉnh Đồng Nai",
    "addressCountry": "VN"
  },

  "provider": {
    "@type": "LocalBusiness",
    "@id": "https://violocal.vn/ho-kinh-doanh/co-so-say-anh-tu#business"
  }
}
```

**`areaServed`:** Use `province.name_full` if the service has a `province_id`. If `service_area_text` is richer (multi-province), put the text in `description` instead — `areaServed` must be a known schema.org area type.

---

## 9. Index Gate

| Condition | `robots` |
|---|---|
| `is_available = true` + storefront `is_public = true` | `index, follow` |
| `is_available = false` + storefront `is_public = true` | `index, follow` (still indexable — seasonal products should stay indexed) |
| Storefront `is_public = false` (any availability) | `noindex, nofollow` |

**Why index unavailable products?**  
A product like "Bơ sáp vụ tháng 6-8" that is out of season in December should stay indexed because:
1. It will be available again next season
2. Its URL has accumulated any backlinks/authority
3. It ranks for seasonal discovery queries year-round

Use a `noticeLabel` in the UI ("Hết mùa vụ — liên hệ để đặt trước") instead of deindexing.

---

## 10. Canonical URL

Same rule as storefronts: canonical always points to itself.

```html
<!-- /san-pham/bo-sap-dak-lak -->
<link rel="canonical" href="https://violocal.vn/san-pham/bo-sap-dak-lak" />

<!-- /dich-vu/say-nong-san-dong-nai -->
<link rel="canonical" href="https://violocal.vn/dich-vu/say-nong-san-dong-nai" />
```

Discovery pages that **list** products are NOT canonical for the product — they're canonical for themselves.

---

## 11. Internal Linking Architecture

### Product page links out to:
```
→ Storefront page:          /ho-kinh-doanh/{storefront.slug}
→ Province discovery:       /{province.slug}
→ District discovery:       /{province.slug}/{district.slug}
→ Category discovery:       /danh-muc/{category.slug}
→ Related products:         other products from same storefront (3-5 cards)
→ Nearby similar:           other products in same district + category (3-5 cards)
```

### Service page links out to:
```
→ Storefront page:          /ho-kinh-doanh/{storefront.slug}
→ Province discovery:       /{province.slug}
→ Service category:         /dich-vu/danh-muc/{category.slug}
→ Other services:           other services from same storefront
```

### Why "nearby similar" matters for SEO:
```
User lands on: /san-pham/bo-sap-dak-lak
User sees:     "Sản phẩm tương tự tại Đắk Lắk"
User clicks:   /san-pham/ca-phe-buon-ma-thuot

→ 2 pages indexed from 1 organic landing
→ Internal link passes PageRank to the second product
→ Google sees topical relevance between the two pages
```

---

## 12. Discovery Page SEO (Category + Geo)

Discovery pages that **list** products/services by category or location:

```
/danh-muc/trai-cay              → all fruit products
/dong-nai/danh-muc/trai-cay     → fruit products in Đồng Nai
/dich-vu/van-chuyen             → all transport services
```

**Title formula for discovery pages:**
```
[Products]:  {category.name} tại {location} | VIO LOCAL
[Services]:  Dịch vụ {category.name} tại {location} | VIO LOCAL
```

**Thin page prevention:**  
A discovery page for a category in a location should only be rendered (and indexed) if there are ≥ 3 available listings. Below 3, `noindex` — the page has zero value to a searcher.

```sql
-- Check before rendering a discovery page
select count(*) from products
where province_id = :province_id
  and category_id = :category_id
  and is_available = true;
-- If count < 3 → noindex
```

---

## 13. Anti-patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| `/san-pham/123` or `/listing/abc` | UUID/numeric URL, zero SEO | `/san-pham/bo-sap-dak-lak` |
| Same description for all products in a category | Duplicate content | Dynamic description from `description` + geo + season |
| `og:type = "product"` on services | Misclassified rich result | Services use `og:type = "website"` |
| `offers.price = 0` in JSON-LD | Google shows "0₫" in SERP | Omit `price` field entirely |
| Deindexing unavailable/out-of-season products | Lost PageRank + seasonal ranking | Keep indexed, update UI label |
| Discovery pages with 1-2 listings | Thin content penalty | `noindex` if < 3 listings |
| Geo in slug but not in title/description | Keyword not reinforced | Always echo geo in title AND description |
| Product title = storefront name | Duplicate title with storefront page | Product title is the product name, not the business |
