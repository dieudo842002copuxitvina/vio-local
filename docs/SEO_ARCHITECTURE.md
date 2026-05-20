# VIO LOCAL — SEO ARCHITECTURE
**Version 1.0 | Hyperlocal Commerce Discovery for Vietnam**

---

## 0. SEO PHILOSOPHY

### 0.1 Core Principle

**VIO LOCAL IS NOT A MARKETPLACE. VIO LOCAL IS AN INDEXING ENGINE FOR RURAL VIETNAMESE BUSINESSES.**

This distinction is critical for SEO strategy:

```
MARKETPLACE SEO:
- Focus: Selling products online
- Keywords: "buy X", "order X", "X price"
- User intent: Transaction
- Content: Product listings, reviews, checkout

VIO LOCAL SEO:
- Focus: Finding local businesses
- Keywords: "X near me", "X in {province}", "X {district}"
- User intent: Discovery + direct contact
- Content: Business storefronts, geographic landing pages, verified info
```

### 0.2 The Three Pillars of VIO LOCAL SEO

```
PILLAR 1: GEOGRAPHIC SPECIFICITY
└─ Every page encodes location
└─ "Sầu riêng Đồng Nai" ≠ "Sầu riêng nationwide"
└─ Enables hyperlocal long-tail keywords

PILLAR 2: BUSINESS IDENTITY
└─ Each storefront is a unique entity
└─ Structured data proves legitimacy
└─ Breadcrumbs show location hierarchy

PILLAR 3: INTERNAL GRAPH
└─ Location pages link to business pages
└─ Business pages link up to location pages
└─ Category pages link to all instances
└─ Authority flows naturally through the graph
```

### 0.3 Success Metrics (Phase 2-4)

```
Phase 2 (SEO Infrastructure):
├─ 100+ storefronts indexed by Google
├─ Lighthouse SEO > 95 on all pages
└─ Open Graph previews work on FB/Zalo

Phase 3 (Discovery Engine):
├─ Category pages indexed
├─ Category pages rank for generic + location queries
└─ First organic discovery referral from Google

Phase 4 (Geographic Hardening):
├─ Province/district pages rank top 5 for "{category} {province}"
├─ 10,000+ pages indexed
└─ Hyperlocal long-tail queries show VIO LOCAL results
```

---

## 1. URL ARCHITECTURE (SEO-FIRST DESIGN)

### 1.1 URL Structure Rules

Every URL must answer: **Who? What? Where?**

```
STOREFRONT:
  /{province}/{district}/{business}
  /dong-nai/tan-phu/ca-tuoi-ba-nam
  ├─ Who: Cá Tươi Bà Năm (business name)
  ├─ What: Cá tươi (category implicit in name)
  └─ Where: Tân Phú, Đồng Nai (geography)

CATEGORY LANDING:
  /danh-muc/{category}
  /danh-muc/sau-rieng
  ├─ What: Sầu riêng (crop)
  └─ Breadcrumb: All businesses → Filter by category

GEOGRAPHIC LANDING:
  /{province}
  /{province}/{district}
  /dong-nai
  /dong-nai/tan-phu
  ├─ Where: Location
  └─ Breadcrumb: All businesses → Filter by location

CROP-REGION:
  /{province}/{crop}
  /dong-nai/sau-rieng
  ├─ What: Sầu riêng (crop)
  ├─ Where: Đồng Nai (province)
  └─ Intent: "Sầu riêng ở Đồng Nai"

HOUSEHOLD BUSINESS:
  /ho-kinh-doanh/{province}/{district}/{householdbiz}
  /ho-kinh-doanh/dong-nai/tan-phu/vuon-bo-ba-nam
  ├─ Category: Household business (hộ kinh doanh)
  ├─ Where: Tân Phú, Đồng Nai
  └─ Distinction: Supports verification + special treatment
```

### 1.2 Why This URL Structure Wins SEO

**Advantage 1: Semantic Clarity**
Google understands the hierarchy:
- `/dong-nai/` = all businesses in Đồng Nai
- `/dong-nai/tan-phu/` = subset in Tân Phú
- `/dong-nai/tan-phu/ca-tuoi-ba-nam` = specific business

**Advantage 2: Keyword Embedding**
- URL slug itself is a ranking factor
- "ca-tuoi" (fresh fish) in the slug signals relevance
- "dong-nai" (province name) signals geographic relevance

**Advantage 3: Breadcrumb Structure**
- Natural breadcrumbs from URL path
- Shows search engines the hierarchy
- Users understand where they are

**Advantage 4: Long-Tail Capture**
- `{crop}-{region}` pages capture "sầu riêng đồng nai" queries
- Not every business gets indexed individually
- Category + location combination does the work

### 1.3 URL Constraints

```
✅ ALLOWED:
  /dong-nai/tan-phu/ca-tuoi-ba-nam
  /danh-muc/sau-rieng
  /dong-nai/sau-rieng
  /ho-kinh-doanh/dong-nai/tan-phu/vuon-bo-ba-nam

❌ FORBIDDEN:
  /business?id=12345                    (parameter-based, not SEO)
  /b/ca-tuoi-ba-nam                     (no location, loses geographic signal)
  /store/business_name/business_id      (redundant, unclear intent)
  /search?q=ca-tuoi&location=dong-nai   (parameter-heavy, not indexable)
  /en/dong-nai/tan-phu                  (multi-language path, Phase 7+)
  /api/businesses/{id}                  (not for humans, robots blocked)
```

---

## 2. METADATA STRATEGY

### 2.1 Meta Tags Are Ranking Signals

Google uses page titles and meta descriptions in ranking. Every page must have unique, compelling metadata.

### 2.2 Page Title Formula

**LENGTH:** 50-60 characters (fits in search snippet)

**FORMULA:**

```
STOREFRONT (Business):
  {Business Name} - {Category}, {District}, {Province} | VIO LOCAL
  "Cá Tươi Bà Năm - Cá tươi tươi, Tân Phú, Đồng Nai | VIO LOCAL"

GEOGRAPHIC LANDING (District):
  {District} - {Province} | Doanh nghiệp, Sản phẩm & Dịch vụ
  "Tân Phú - Đồng Nai | Doanh nghiệp, Sản phẩm & Dịch vụ"

GEOGRAPHIC LANDING (Province):
  {Province} | Khám phá Doanh nghiệp & Nông sản
  "Đồng Nai | Khám phá Doanh nghiệp & Nông sản"

CROP-REGION:
  {Crop} tại {Region} | Mua bán trực tiếp
  "Sầu riêng tại Đồng Nai | Mua bán trực tiếp"

CATEGORY LANDING:
  {Category} - Liên hệ trực tiếp | VIO LOCAL
  "Sầu riêng - Liên hệ trực tiếp | VIO LOCAL"
```

### 2.3 Meta Description Formula

**LENGTH:** 150-160 characters (full snippet)

**FORMULA:**

```
STOREFRONT:
  {Business} - {Description}. {Address}. {Phone}. Liên hệ ngay.
  
  "Cá Tươi Bà Năm - Cá sông tươi sống, nuôi tự nhiên. 
   Ấp 3, Xã Tân Phú, Huyện Tân Phú, Đồng Nai. 
   Gọi 0912 345 678."

GEOGRAPHIC LANDING (District):
  Tìm doanh nghiệp, dịch vụ, sản phẩm tại {District}, {Province}. 
  {Count} cửa hàng, nông sản, dịch vụ. Quét mã để liên hệ trực tiếp.
  
  "Tìm doanh nghiệp, dịch vụ, sản phẩm tại Huyện Tân Phú, Đồng Nai. 
   45 cửa hàng, nông sản, dịch vụ. Quét mã để liên hệ trực tiếp."

CROP-REGION:
  {Crop} tại {Region}. Liên hệ trực tiếp với nhà sản xuất. 
  {Count} nhà cung cấp được xác minh. Mua bán không qua trung gian.
  
  "Sầu riêng tại Đồng Nai. Liên hệ trực tiếp với nhà sản xuất. 
   23 nhà cung cấp được xác minh. Mua bán không qua trung gian."
```

### 2.4 Dynamic vs Static Meta Tags

**DYNAMIC (Generated from Database):**

```typescript
// Storefront page
export async function generateMetadata({ params }) {
  const business = await getBusiness(params.province, params.district, params.slug);
  
  return {
    title: `${business.name} - ${business.category}, ${business.district_name}, ${business.province_name} | VIO LOCAL`,
    description: `${business.name} - ${business.description}. ${business.formatted_address}. Gọi ${business.phone}.`,
    openGraph: {
      title: business.name,
      description: business.tagline,
      url: `https://violocal.vn/${business.province_slug}/${business.district_slug}/${business.slug}`,
      type: 'business.business'
    }
  };
}
```

**STATIC (Hardcoded for Category/Location Pages):**

```typescript
// Category landing page
export const metadata = {
  title: 'Sầu riêng - Liên hệ trực tiếp | VIO LOCAL',
  description: 'Sầu riêng tại Việt Nam. Liên hệ trực tiếp với nhà sản xuất. Không qua trung gian.'
};
```

### 2.5 Avoid Duplicate Meta Tags

**DANGER ZONE: Duplicated titles across pages**

```
❌ WRONG:
Page 1: "Doanh nghiệp - VIO LOCAL"
Page 2: "Doanh nghiệp - VIO LOCAL"
→ Google penalizes duplicate titles

✅ RIGHT:
Page 1: "Tân Phú - Đồng Nai | Doanh nghiệp & Dịch vụ"
Page 2: "Mỹ Phước - Bình Dương | Doanh nghiệp & Dịch vụ"
→ Each unique, each keyword-rich
```

---

## 3. STRUCTURED DATA STRATEGY

### 3.1 Schema.org Types Used

```
LocalBusiness          → Businesses (storefronts)
Product                → Products, Services
BreadcrumbList         → Navigation hierarchy
FAQPage                → Common questions (Phase 7+)
NewsArticle            → Blog posts (if added, Phase 7+)
AggregateOffer         → Products with multiple sellers
```

### 3.2 LocalBusiness Schema (Storefront)

**Every business storefront must include this:**

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam#business",
  
  "name": "Cá Tươi Bà Năm",
  "url": "https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam",
  
  "description": "Cá tươi sông Đồng Nai nuôi tự nhiên. Cá rô, cá trê, cá lóc tươi sống.",
  
  "image": [
    "https://violocal.vn/media/ca-tuoi-ba-nam/hero-1200.jpg",
    "https://violocal.vn/media/ca-tuoi-ba-nam/hero-400.jpg"
  ],
  
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Đường Tỉnh Lộ 2, số 123",
    "addressLocality": "Ấp 3, Xã Tân Phú",
    "addressRegion": "Huyện Tân Phú",
    "addressRegionProvince": "Tỉnh Đồng Nai",
    "postalCode": "76000",
    "addressCountry": "VN"
  },
  
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 10.8231,
    "longitude": 107.1921
  },
  
  "telephone": "+84912345678",
  "email": "ca@example.com",
  
  "sameAs": [
    "https://facebook.com/cabanam",
    "https://zalo.me/84912345678"
  ],
  
  "priceRange": "₫₫",
  
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Monday",
      "opens": "06:00",
      "closes": "18:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "06:00",
      "closes": "17:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Sunday",
      "opens": "07:00",
      "closes": "17:00"
    }
  ]
}
```

### 3.3 BreadcrumbList Schema (Navigation)

Every page must include breadcrumbs via Schema.org:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "VIO LOCAL",
      "item": "https://violocal.vn/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Tỉnh Đồng Nai",
      "item": "https://violocal.vn/dong-nai/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Huyện Tân Phú",
      "item": "https://violocal.vn/dong-nai/tan-phu/"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Cá Tươi Bà Năm",
      "item": "https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam"
    }
  ]
}
```

**Why breadcrumbs matter:**
- Google shows breadcrumbs in search results (RichResults)
- Guides search engines through hierarchy
- Improves CTR from search results

### 3.4 Product Schema (for product/service listings)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Cá Rô Đồng",
  "url": "https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro-dong",
  "description": "Cá rô đồng tươi sống, nuôi tự nhiên từ sông Đồng Nai.",
  
  "image": "https://violocal.vn/media/ca-ro-dong-1200.jpg",
  
  "brand": {
    "@type": "Brand",
    "name": "Cá Tươi Bà Năm"
  },
  
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "VND",
    "priceRange": "50000-80000",
    "availability": "https://schema.org/InStock"
  }
}
```

### 3.5 Validation & Testing

```
✅ Test all structured data with:
   - Google Rich Results Test
   - Schema.org validator
   - Lighthouse SEO audit

❌ Common mistakes:
   - Missing required fields
   - Wrong data types
   - Inconsistent with page content
   - Out-of-date information
```

---

## 4. CANONICAL STRATEGY

### 4.1 Canonical URL Purpose

Tells Google which version of a page is "official" (avoids duplicate content penalties).

### 4.2 Canonical Rules

**RULE 1: One canonical per page, points to itself**

```html
<!-- On /dong-nai/tan-phu/ca-tuoi-ba-nam -->
<link rel="canonical" href="https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam">

<!-- NOT to homepage -->
<!-- NOT to category page -->
<!-- NOT to province page -->
```

**RULE 2: Include trailing slash consistently**

```html
<!-- All VIO LOCAL URLs have trailing slash -->
<link rel="canonical" href="https://violocal.vn/dong-nai/">
<link rel="canonical" href="https://violocal.vn/dong-nai/tan-phu/">
<link rel="canonical" href="https://violocal.vn/dong-nai/tan-phu/">
```

**RULE 3: HTTPS always**

```html
<!-- Always HTTPS, never HTTP -->
<link rel="canonical" href="https://violocal.vn/dong-nai/">
<!-- NOT http://violocal.vn/dong-nai -->
```

**RULE 4: Never canonical to parameter version**

```html
<!-- ✅ Canonical: clean URL -->
<link rel="canonical" href="https://violocal.vn/search/sau-rieng">

<!-- ❌ DON'T: canonical to ?param version -->
<!-- NOT rel="canonical" href="https://violocal.vn/search?q=sau-rieng" -->
```

### 4.3 Redirect Strategy

When business renames:
```
OLD URL: /dong-nai/tan-phu/ca-tuoi-ba-nam
NEW URL: /dong-nai/tan-phu/ca-tuoi-ba-nam-2

Redirect: 301 (permanent) from old → new
Canonical on new URL: points to itself
```

Preserves SEO authority through rename.

---

## 5. BREADCRUMB STRATEGY

### 5.1 Visual Breadcrumbs

Every page shows breadcrumbs in the UI:

```
HOME > ĐỒNG NAI > TÂN PHÚ > CÁ TƯƠI BÀ NĂM

Each segment is a clickable link (except current page)
```

### 5.2 Breadcrumb HTML (Semantic)

```html
<nav aria-label="Breadcrumb">
  <ol itemscope itemtype="https://schema.org/BreadcrumbList">
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="https://violocal.vn/">
        <span itemprop="name">VIO LOCAL</span>
      </a>
      <meta itemprop="position" content="1" />
    </li>
    
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="https://violocal.vn/dong-nai/">
        <span itemprop="name">Tỉnh Đồng Nai</span>
      </a>
      <meta itemprop="position" content="2" />
    </li>
    
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="https://violocal.vn/dong-nai/tan-phu/">
        <span itemprop="name">Huyện Tân Phú</span>
      </a>
      <meta itemprop="position" content="3" />
    </li>
    
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <span itemprop="name">Cá Tươi Bà Năm</span>
      <meta itemprop="position" content="4" />
    </li>
  </ol>
</nav>
```

### 5.3 Authority Flow Through Breadcrumbs

Breadcrumbs create natural internal links:

```
Province page
  ↓ links to
District page
  ↓ links to
Business pages (30+)
  ↓ links back to
District page
  ↓ links back to
Province page
```

This creates a **link graph** where authority flows naturally:
- Links from 30+ business pages → strengthen district page
- District page authority → strengthen province page
- Province page authority → strengthen all district pages (via links)

---

## 6. INTERNAL LINKING STRATEGY

### 6.1 Link Architecture

```
HOMEPAGE
  ├── Links to: Top 20 provinces
  ├── Links to: Top 10 categories
  └── Links to: Top 20 businesses (newest)

PROVINCE PAGE (/dong-nai)
  ├── Links to: All districts in province
  ├── Links to: All major products in province
  ├── Links back: To homepage
  └── Links to: Category pages filtered by province

DISTRICT PAGE (/dong-nai/tan-phu)
  ├── Links to: All businesses in district (20 per page, paginated)
  ├── Links to: All communes in district (if major enough)
  ├── Links back: To parent province
  ├── Links back: To homepage (via breadcrumb)
  └── Links to: Category pages filtered by district

BUSINESS STOREFRONT (/dong-nai/tan-phu/ca-tuoi-ba-nam)
  ├── Links to: Products (internal)
  ├── Links to: Services (internal)
  ├── Links back: To district page
  ├── Links back: To province page (via breadcrumb)
  ├── Links to: Related businesses (same category, same district)
  └── Links to: Category page (ca-tuoi)

CATEGORY PAGE (/danh-muc/sau-rieng)
  ├── Links to: All instances of category across all districts
  ├── Links to: Top 5 regions where category is popular
  └── Links back: To homepage

CROP-REGION PAGE (/dong-nai/sau-rieng)
  ├── Links to: All sầu riêng businesses in Đồng Nai
  ├── Links to: All sầu riêng products in Đồng Nai
  ├── Links back: To province page
  ├── Links back: To category page
  └── Links to: Related regions (if significant)
```

### 6.2 Anchor Text Guidelines

Anchor text is a ranking signal. Use natural, keyword-rich text:

```html
<!-- ❌ BAD: Generic anchor -->
<a href="/dong-nai/tan-phu/">Click here</a>

<!-- ✅ GOOD: Keyword-rich, natural -->
<a href="/dong-nai/tan-phu/">Doanh nghiệp tại Huyện Tân Phú, Đồng Nai</a>

<!-- ✅ GOOD: Brand + location -->
<a href="/dong-nai/tan-phu/ca-tuoi-ba-nam/">Cá Tươi Bà Năm</a>

<!-- ✅ GOOD: Category + location -->
<a href="/dong-nai/sau-rieng/">Sầu riêng ở Đồng Nai</a>
```

### 6.3 Related Businesses Section

Each business page shows 5-10 related businesses:

```typescript
// On /dong-nai/tan-phu/ca-tuoi-ba-nam, show:
// - Other fish businesses in Tân Phú
// - Not just random businesses
// - Creates deep internal linking

const relatedBusinesses = await db.query(`
  SELECT * FROM businesses
  WHERE category_id = $currentCategory
    AND district_id = $currentDistrict
    AND id != $currentBusinessId
    AND status = 'published'
  ORDER BY published_at DESC
  LIMIT 10
`);
```

---

## 7. SITEMAP ARCHITECTURE

### 7.1 Sitemap Index

Main sitemap points to subsitemaps:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://violocal.vn/sitemap-core.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://violocal.vn/sitemap-provinces.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://violocal.vn/sitemap-districts.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://violocal.vn/sitemap-communes.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://violocal.vn/sitemap-categories.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://violocal.vn/sitemap-crop-regions.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://violocal.vn/sitemap-businesses-dong-nai.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://violocal.vn/sitemap-businesses-binh-duong.xml</loc>
  </sitemap>
  <!-- ... one per province ... -->
</sitemapindex>
```

### 7.2 Core Pages Sitemap

```xml
<!-- /sitemap-core.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://violocal.vn/</loc>
    <lastmod>2026-01-15T10:30:00Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://violocal.vn/danh-muc/</loc>
    <lastmod>2026-01-15T10:30:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://violocal.vn/search/</loc>
    <lastmod>2026-01-15T10:30:00Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
```

### 7.3 Geographic Sitemaps

```xml
<!-- /sitemap-provinces.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://violocal.vn/dong-nai/</loc>
    <lastmod>2026-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://violocal.vn/binh-duong/</loc>
    <lastmod>2026-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <!-- ... all 63 provinces ... -->
</urlset>

<!-- /sitemap-districts.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://violocal.vn/dong-nai/tan-phu/</loc>
    <lastmod>2026-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://violocal.vn/dong-nai/xuan-loc/</loc>
    <lastmod>2026-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... all ~700 districts ... -->
</urlset>
```

### 7.4 Business Sitemaps (by Province)

```xml
<!-- /sitemap-businesses-dong-nai.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam/</loc>
    <lastmod>2026-01-14T10:30:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://violocal.vn/dong-nai/xuan-loc/rau-sach-binh/</loc>
    <lastmod>2026-01-10T08:15:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <!-- ... all businesses in Đồng Nai ... -->
</urlset>
```

**Why by province?**
- URL limit: 50k per sitemap file
- Đồng Nai might have 500 businesses → split at province level
- Logical grouping for crawlers

---

## 8. INDEXING PRIORITIES

### 8.1 What Gets Indexed (Crawl Budget)

Google has limited crawl budget. Prioritize:

```
PRIORITY 1: Business Storefronts (Core Value)
├─ Recently published (first 1000 businesses)
├─ Recently updated
└─ High traffic (measured by views/month)

PRIORITY 2: Geographic Landing Pages
├─ Province pages (63 total)
├─ District pages (700 total)
├─ High-traffic communes (top 100)
└─ Crop-region pages (popular crops × provinces)

PRIORITY 3: Category Pages
├─ Category landing pages
└─ Category filtered by region

PRIORITY 4: Everything Else
├─ Products/services
├─ Internal search results
└─ User profiles
```

### 8.2 What Gets Noindexed (Save Crawl Budget)

```html
<!-- Don't waste crawl budget on these -->

<!-- Search results (parameter-based, duplicate content) -->
<meta name="robots" content="noindex, follow">

<!-- User account pages (private) -->
<meta name="robots" content="noindex, follow">

<!-- Print versions -->
<meta name="robots" content="noindex, follow">

<!-- Calendar/archive pages (if added) -->
<meta name="robots" content="noindex, follow">
```

### 8.3 Robots.txt Rules

```
User-agent: *
Allow: /

# Crawl-delay for aggressive bots
Crawl-delay: 1

# Disallow inefficient paths
Disallow: /api/
Disallow: /admin/
Disallow: /dashboard/
Disallow: /search/
Disallow: /*?
Disallow: /*&
Disallow: /*/page/2

# Allow Google to crawl everything else
Allow: /

Sitemap: https://violocal.vn/sitemap.xml
```

---

## 9. THIN PAGE PREVENTION

### 9.1 What Is a Thin Page?

```
A page with so little content that Google considers it low-quality.

Examples of Thin Pages on VIO LOCAL:
❌ Province page with 0 businesses (empty region)
❌ District page with 3 businesses (too sparse)
❌ Category page with 1 instance (no critical mass)
❌ Crop-region page with 0 sellers (no inventory)
```

### 9.2 Thin Page Rules

```
Minimum Content Requirements:

Province Page:
  ✅ PUBLISH if: ≥10 businesses OR ≥5 districts with content
  ❌ DON'T PUBLISH if: <3 businesses AND no sub-districts

District Page:
  ✅ PUBLISH if: ≥5 businesses OR actively growing
  ❌ DON'T PUBLISH if: 0-2 businesses (too thin)

Category Page:
  ✅ PUBLISH if: ≥20 instances across all regions
  ❌ DON'T PUBLISH if: <10 instances total

Crop-Region Page (/dong-nai/sau-rieng):
  ✅ PUBLISH if: ≥3 active sellers in region
  ❌ DON'T PUBLISH if: 0-1 seller
```

### 9.3 Preventing Thin Pages at Scale

```sql
-- Only generate landing pages for regions with sufficient content
CREATE OR REPLACE FUNCTION should_generate_page(
  entity_type VARCHAR,
  entity_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  count INTEGER;
BEGIN
  CASE entity_type
    WHEN 'province' THEN
      SELECT COUNT(*) INTO count FROM businesses
      WHERE province_id = entity_id AND status = 'published' AND deleted_at IS NULL;
      RETURN count >= 10;
    
    WHEN 'district' THEN
      SELECT COUNT(*) INTO count FROM businesses
      WHERE district_id = entity_id AND status = 'published' AND deleted_at IS NULL;
      RETURN count >= 5;
    
    WHEN 'crop_region' THEN
      SELECT COUNT(*) INTO count FROM businesses
      WHERE province_id = (entity_id / 10000)  -- Extract province from composite ID
        AND category_id = (entity_id % 10000)  -- Extract category
        AND status = 'published'
        AND deleted_at IS NULL;
      RETURN count >= 3;
  END CASE;
END;
$$ LANGUAGE plpgsql;
```

### 9.4 Thin Page Content Guidelines

If you must have a thin page (in early growth), add value:

```html
<!-- /dong-nai/tan-phu (3 businesses) -->
<article>
  <h1>Khám phá doanh nghiệp tại Huyện Tân Phú, Đồng Nai</h1>
  
  <!-- Thin content: add context -->
  <p>Huyện Tân Phú là một trong những huyện lớn của Tỉnh Đồng Nai, 
     nằm ở phía tây bắc tỉnh, với diện tích 1,134 km². Đây là một 
     trung tâm nông nghiệp sinh thái, nổi tiếng với sản xuất cá tươi 
     và nông sản hữu cơ.</p>
  
  <!-- Add local info -->
  <section>
    <h2>Về Huyện Tân Phú</h2>
    <ul>
      <li>Diện tích: 1,134 km²</li>
      <li>Dân số: ~150,000</li>
      <li>Đặc sản: Cá sông, rau sạch, nông sản hữu cơ</li>
    </ul>
  </section>
  
  <!-- Show businesses -->
  <section>
    <h2>Doanh nghiệp tại Tân Phú</h2>
    <!-- 3 businesses listed -->
  </section>
</article>
```

---

## 10. GEO SEO STRATEGY

### 10.1 Core Geo SEO Keywords

```
INTENT: Find local business

KEYWORD TYPES:

1. LOCATION + PRODUCT
   "cá tươi đồng nai"         → Many suppliers
   "sầu riêng bình phước"      → Agricultural discovery
   "thợ điện huyện tân phú"    → Local services

2. LOCATION + BUSINESS NAME
   "cá tươi bà năm"           → Brand discovery
   "quán ăn sài gòn"          → Business discovery

3. LOCATION + SERVICE
   "sửa xe tân phú"           → Service discovery
   "thợ hàn đồng nai"         → Craft services

4. HYPERLOCAL
   "cửa hàng gần đây"         → Proximity search
   "doanh nghiệp quanh đây"   → General local discovery
```

### 10.2 Geo SEO Content Structure

Each geographic page should include:

```html
<!-- Province Page: /dong-nai -->
<h1>Doanh nghiệp tại Tỉnh Đồng Nai</h1>

<section id="overview">
  <h2>Giới thiệu về Tỉnh Đồng Nai</h2>
  <p>Tỉnh Đồng Nai là một trong những trung tâm kinh tế của 
     Việt Nam, nằm ở phía Đông TP.HCM. Tỉnh có nền nông nghiệp 
     phát triển mạnh với sản xuất cá, rau sạch, sầu riêng.</p>
</section>

<section id="statistics">
  <h2>Thống kê Doanh nghiệp</h2>
  <ul>
    <li>1,234 doanh nghiệp được liệt kê</li>
    <li>5,678 sản phẩm nông sản</li>
    <li>910 dịch vụ</li>
  </ul>
</section>

<section id="districts">
  <h2>Các Huyện tại Đồng Nai</h2>
  <ul>
    <li><a href="/dong-nai/tan-phu/">Huyện Tân Phú (45 doanh nghiệp)</a></li>
    <li><a href="/dong-nai/xuan-loc/">Huyện Xuân Lộc (67 doanh nghiệp)</a></li>
    <!-- ... -->
  </ul>
</section>

<section id="popular-products">
  <h2>Sản phẩm phổ biến tại Đồng Nai</h2>
  <ul>
    <li><a href="/dong-nai/sau-rieng/">Sầu riêng</a></li>
    <li><a href="/dong-nai/ca-tuoi/">Cá tươi</a></li>
    <li><a href="/dong-nai/rau-sach/">Rau sạch</a></li>
  </ul>
</section>

<section id="businesses">
  <h2>Doanh nghiệp tại Đồng Nai</h2>
  <!-- List of businesses -->
</section>
```

### 10.3 Geographic Keyword Targeting

**Page Strategy:**

```
/dong-nai/
  ├─ Keywords: "đồng nai", "doanh nghiệp đồng nai", "sản phẩm đồng nai"
  └─ CTA: Link to districts and categories

/dong-nai/tan-phu/
  ├─ Keywords: "tân phú", "doanh nghiệp tân phú", "tân phú đồng nai"
  └─ CTA: Link to businesses

/dong-nai/sau-rieng/
  ├─ Keywords: "sầu riêng đồng nai", "sầu riêng tân phú"
  └─ CTA: Link to sầu riêng sellers in province

/ho-kinh-doanh/dong-nai/tan-phu/
  ├─ Keywords: "hộ kinh doanh tân phú", "nhà sản xuất tân phú"
  └─ CTA: Link to verified household businesses
```

### 10.4 Competitor SEO Analysis

```
COMPETITOR: Facebook Groups / Marketplace
└─ No structured data
└─ No geographic hierarchy
└─ No permanent URLs
└─ Bad for SEO

VIO LOCAL ADVANTAGE:
✅ Structured data (LocalBusiness schema)
✅ Permanent geographic URLs
✅ Indexed by Google
✅ Long-tail keyword coverage
✅ Authority flows through geographic graph
```

---

## 11. IMPLEMENTATION CHECKLIST

### 11.1 Phase 2 SEO (Weeks 10-13)

```
TECHNICAL SEO:
☐ All storefronts have unique title tags
☐ All storefronts have unique meta descriptions
☐ All storefronts include LocalBusiness schema
☐ All pages include BreadcrumbList schema
☐ Canonical URLs set correctly
☐ robots.txt configured
☐ Sitemaps generated and submitted
☐ Lighthouse SEO score > 95

CONTENT:
☐ Province pages created (63)
☐ District pages created (~700)
☐ Category pages created (~150)
☐ Each page has 100+ words of unique content
☐ Geographic keywords naturally included

LINKS:
☐ Homepage links to top provinces
☐ Province pages link to districts
☐ District pages link to businesses
☐ Businesses link back (breadcrumb)
☐ Category pages link to instances

MONITORING:
☐ Google Search Console verified
☐ Bing Webmaster Tools verified
☐ Sitemaps submitted
☐ Google Analytics 4 configured
☐ Core Web Vitals monitoring enabled
```

### 11.2 Phase 3 SEO (Discovery Engine)

```
SEARCH OPTIMIZATION:
☐ Category pages optimized for generic queries
☐ Crop-region pages created and indexed
☐ Internal search excluded from index (noindex)
☐ Search results cached for performance

CONTENT:
☐ FAQ schema added (future)
☐ More local context added to pages
☐ Reviews/ratings schema (Phase 7+)

MONITORING:
☐ Track rankings for priority keywords
☐ Monitor organic traffic growth
☐ Identify zero-result queries
☐ A/B test title/description variants
```

### 11.3 Phase 4+ SEO (Maturity)

```
ADVANCED:
☐ Local citation building (Yelp, Yellow Pages)
☐ Backlink acquisition strategy
☐ Local news integration
☐ Review generation strategy
☐ Mobile-first indexing optimization
```

---

## 12. SEO ANTI-PATTERNS TO AVOID

### 12.1 Keyword Stuffing

```html
<!-- ❌ WRONG: Stuffing keywords -->
<title>Cá tươi Đồng Nai - cá tươi đồng nai - cá tươi - 
       cá - đồng nai - sông - tươi | VIO LOCAL</title>

<!-- ✅ RIGHT: Natural, descriptive -->
<title>Cá Tươi Bà Năm - Cá sông tươi tại Tân Phú, Đồng Nai | VIO LOCAL</title>
```

### 12.2 Duplicate Content

```html
<!-- ❌ WRONG: Multiple pages with identical content -->
Page 1: "Doanh nghiệp - VIO LOCAL"
Page 2: "Doanh nghiệp - VIO LOCAL"

<!-- ✅ RIGHT: Each unique -->
Page 1: "Tân Phú - Doanh nghiệp tại Huyện Tân Phú, Đồng Nai"
Page 2: "Mỹ Phước - Doanh nghiệp tại Huyện Mỹ Phước, Bình Dương"
```

### 12.3 Hidden Text / Hidden Links

```html
<!-- ❌ WRONG: Hiding keywords from users -->
<p style="color: white; font-size: 1px;">cá tươi đồng nai</p>

<!-- ✅ RIGHT: All content visible to users -->
<p>Cá tươi sông Đồng Nai, nuôi tự nhiên, tươi sống.</p>
```

### 12.4 Cloaking / Misleading Redirects

```html
<!-- ❌ WRONG: Different content for bots vs users -->
<!-- Bot sees: "cá tươi" -->
<!-- User sees: Completely different page -->

<!-- ✅ RIGHT: Same content for all -->
<!-- Bot and user see identical page -->
```

### 12.5 Excessive Internal Links

```html
<!-- ❌ WRONG: Too many internal links (dilutes authority) -->
<a href="/dong-nai/">Link 1</a>
<a href="/dong-nai/">Link 2</a>
<a href="/dong-nai/">Link 3</a>
<!-- ... 20 more identical links ... -->

<!-- ✅ RIGHT: 5-10 well-placed, relevant internal links -->
<a href="/dong-nai/">Doanh nghiệp tại Đồng Nai</a>
<a href="/dong-nai/tan-phu/">Tân Phú, Đồng Nai</a>
```

---

## 13. MONITORING & MEASUREMENT

### 13.1 Key Metrics (Phase 2+)

```
Baseline (End of Phase 1):
  ├─ 0 organic sessions/month (no SEO work yet)
  ├─ 0 search impressions
  └─ 0 pages indexed

Target (End of Phase 2):
  ├─ 100+ pages indexed by Google
  ├─ 50+ search impressions/month
  ├─ Lighthouse SEO > 95
  └─ Rich Results showing in search

Target (End of Phase 3):
  ├─ 1,000+ pages indexed
  ├─ 5,000+ organic sessions/month
  ├─ Rankings for 50+ keywords
  └─ Category pages ranking top 10

Target (End of Phase 4):
  ├─ 10,000+ pages indexed
  ├─ 50,000+ organic sessions/month
  ├─ Rankings for 500+ keywords
  └─ Province pages ranking top 5 for local queries
```

### 13.2 Tools & Dashboards

```
Google Search Console:
  ├─ Coverage report (indexed vs not indexed)
  ├─ Performance (impressions, clicks, CTR, position)
  ├─ Mobile Usability
  └─ Core Web Vitals

Google Analytics 4:
  ├─ Organic traffic by landing page
  ├─ Organic traffic by device
  ├─ Conversion (business storefront views)
  └─ Geographic data (where traffic comes from)

Lighthouse CI:
  ├─ SEO score on every deploy
  ├─ Reject if score < 90
  └─ Track improvements over time

Custom Dashboard:
  ├─ Pages indexed by province/district
  ├─ Top keywords by traffic
  ├─ Pages with no traffic (optimization opportunity)
  └─ Zero-result search queries (content gap)
```

### 13.3 Weekly SEO Review

```
Every Friday:
  ☐ Check indexation (are new pages being indexed?)
  ☐ Monitor Core Web Vitals (any regressions?)
  ☐ Review top landing pages (are they performing?)
  ☐ Check for rank improvements (tracking top 50 keywords)
  ☐ Review error reports (crawl errors, mobile issues)

Monthly:
  ☐ Analyze organic traffic trends
  ☐ Identify zero-result queries (content opportunities)
  ☐ Audit pages with low CTR (improve titles/descriptions)
  ☐ Check for duplicate content issues
  ☐ Review backlink profile

Quarterly:
  ☐ Comprehensive SEO audit
  ☐ Competitor analysis
  ☐ Keyword gap analysis
  ☐ Content strategy review
```

---

## 14. SUMMARY TABLE

| Element | Strategy | Notes |
|---------|----------|-------|
| URL Structure | `/{province}/{district}/{slug}` | Geographic hierarchy in URL |
| Title Tags | 50-60 chars, unique per page | Generated dynamically |
| Meta Descriptions | 150-160 chars, compelling CTA | Dynamic for storefronts |
| Structured Data | LocalBusiness + BreadcrumbList | Required on all pages |
| Canonical URLs | Points to itself, with trailing slash | Prevents duplicates |
| Breadcrumbs | Visual + schema.org markup | Navigation hierarchy |
| Internal Links | Authority flows geographic → business | 5-10 per page |
| Sitemap | Dynamic generation by type | 50k limit per file |
| Indexing | Crawl budget prioritization | Businesess > geography > categories |
| Thin Pages | Minimum 3-5 businesses per page | Prevent low-quality pages |
| Geo Keywords | Location + product/service | Natural integration |
| Redirects | 301 on renames, aliases on changes | Preserve SEO authority |

---

## 15. FINAL DIRECTIVES

### 15.1 SEO is Not Optional

This is not a post-launch feature. SEO is built in from Phase 0:

```
Phase 0: Set up structured data framework
Phase 1: All storefronts properly tagged
Phase 2: Geographic pages indexed
Phase 3: Category pages optimized
Phase 4: Hyperlocal long-tail captured
```

### 15.2 Monitor Continuously

SEO is not "set it and forget it":

- New pages must be monitored for indexing (24-48 hours)
- Renames must be redirected (preserve authority)
- Changes must be measured (did CTR improve?)

### 15.3 Content Quality Over Quantity

Do not create pages for the sake of having pages:

- Thin pages hurt authority
- Better to have 100 quality pages than 10,000 thin pages
- Minimum standards: 3+ businesses per geographic page

### 15.4 User Experience is SEO

Google prioritizes pages with good UX:

```
Core Web Vitals:
  ├─ LCP (Largest Contentful Paint): < 2.5s
  ├─ FID (First Input Delay): < 100ms
  └─ CLS (Cumulative Layout Shift): < 0.1

Mobile Usability:
  ├─ Touch targets ≥ 44px
  ├─ Text readable without zoom
  └─ No interstitials blocking content
```

---

**END OF SEO ARCHITECTURE v1.0**

*VIO LOCAL succeeds when a farmer in Đồng Nai can search "sầu riêng gần đây" and find their storefront on Google. This SEO architecture makes that possible — not through tricks, but through fundamentals: proper URLs, structured data, geographic hierarchy, and genuine value.*