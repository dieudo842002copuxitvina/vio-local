# VIO LOCAL — ROUTING ARCHITECTURE
**Version 1.0 | Scalable URL Routing for Hyperlocal Discovery**

---

## 0. ROUTING PHILOSOPHY

### 0.1 Core Principle

**URLs are the API contract between VIO LOCAL and Google.**

Every URL must be:
- **Human-readable** (a person can guess where they are)
- **SEO-optimized** (keywords embedded naturally)
- **Stable** (same URL today and in 5 years)
- **Hierarchical** (location and meaning encoded in path)
- **Scalable** (works for 1k businesses and 1M businesses)

### 0.2 The Five Rules

```
RULE 1: NO UUIDs in URLs
   ❌ /business/c2b8a9f4-3e21-4f67-8b9c-a5d6e7f8a9b0
   ✅ /dong-nai/tan-phu/ca-tuoi-ba-nam

RULE 2: NO query parameters for primary content
   ❌ /search?province=dong-nai&category=ca-tuoi
   ✅ /dong-nai/ca-tuoi   (or category page)

RULE 3: NO deep nesting beyond 4 levels
   ❌ /vn/dong-nai/tan-phu/xa-tan-phu/ap-3/ca-tuoi-ba-nam/products/ca-ro
   ✅ /dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro

RULE 4: URLs encode INTENT, not implementation
   ❌ /api/v1/businesses/12345
   ✅ /dong-nai/tan-phu/ca-tuoi-ba-nam

RULE 5: Type prefixes for special collections
   ✅ /ho-kinh-doanh/...     (household businesses)
   ✅ /dat-nong-nghiep/...   (agricultural land)
   ✅ /danh-muc/...          (categories)
```

### 0.3 Anti-Patterns Forbidden

```
❌ /b/12345                          (opaque ID)
❌ /business?id=12345                (parameter-based)
❌ /vn/dong-nai/tan-phu/businesses/  (redundant)
❌ /en/dong-nai/...                  (multi-language path, Phase 7+)
❌ /v1/dong-nai/...                  (version in URL)
❌ /m/dong-nai/...                   (mobile-specific)
❌ /amp/dong-nai/...                 (AMP variants)
❌ /www/dong-nai/...                 (www subpath)
❌ #section anchors for primary nav  (not crawlable)
```

---

## 1. URL HIERARCHY OVERVIEW

### 1.1 Route Taxonomy

```
ROOT LEVEL (8 routes):
├── /                        # Homepage
├── /search                  # Search interface
├── /danh-muc/[category]     # Category landing pages
├── /ho-kinh-doanh/...       # Household business directory
├── /dat-nong-nghiep/...     # Agricultural land directory
├── /khu-vuc                 # Browse all locations
├── /ve-vio-local            # About page
└── /[province]/...          # Geographic routes (most traffic)

GEOGRAPHIC HIERARCHY (3 levels):
└── /[province]/
    └── /[district]/
        └── /[commune]/           # Optional, only major communes
            └── /[business]/      # Storefront

CROSS-CUTTING ROUTES:
├── /[province]/[crop]            # Crop-region pages
├── /[province]/[district]/dat/   # Land in district
└── /[province]/[district]/[business]/[type]/[slug]  # Sub-entities
```

### 1.2 Route Priority Ranking

```
PRIORITY 1 (Highest SEO Value):
├── Province pages          (63 routes)
├── District pages          (~700 routes)
├── Crop-region pages       (~200 routes)
└── Business storefronts    (scalable)

PRIORITY 2 (Discovery):
├── Category pages          (~150 routes)
├── Major commune pages     (top 100)
└── Household business directory pages

PRIORITY 3 (Functional):
├── Search interface
├── About/info pages
└── Land listing pages

PRIORITY 4 (Excluded from index):
├── User dashboard
├── API routes
└── Admin routes
```

---

## 2. NEXT.JS APP ROUTER STRUCTURE

### 2.1 File System Layout

```
src/app/
├── layout.tsx                           # Root layout
├── page.tsx                             # Homepage (/)
├── not-found.tsx                        # Global 404
├── error.tsx                            # Global error boundary
├── sitemap.ts                           # Sitemap index
├── robots.ts                            # Robots.txt
│
├── (marketing)/                         # Marketing pages group
│   ├── ve-vio-local/page.tsx           # /ve-vio-local
│   ├── lien-he/page.tsx                # /lien-he
│   └── chinh-sach/page.tsx             # /chinh-sach
│
├── search/
│   └── page.tsx                         # /search
│
├── danh-muc/
│   ├── page.tsx                         # /danh-muc (all categories)
│   └── [category]/
│       └── page.tsx                     # /danh-muc/sau-rieng
│
├── ho-kinh-doanh/                       # Household business prefix
│   ├── page.tsx                         # /ho-kinh-doanh
│   ├── [province]/
│   │   ├── page.tsx                     # /ho-kinh-doanh/dong-nai
│   │   └── [district]/
│   │       ├── page.tsx                 # /ho-kinh-doanh/dong-nai/tan-phu
│   │       └── [business]/
│   │           └── page.tsx             # /ho-kinh-doanh/dong-nai/tan-phu/vuon-bo-ba-nam
│
├── dat-nong-nghiep/                     # Agricultural land prefix
│   ├── page.tsx                         # /dat-nong-nghiep
│   ├── [province]/
│   │   ├── page.tsx                     # /dat-nong-nghiep/dong-nai
│   │   └── [district]/
│   │       ├── page.tsx                 # /dat-nong-nghiep/dong-nai/tan-phu
│   │       └── [slug]/
│   │           └── page.tsx             # /dat-nong-nghiep/dong-nai/tan-phu/ruong-1000m2
│
├── khu-vuc/
│   └── page.tsx                         # /khu-vuc (all provinces)
│
├── (auth)/                              # Auth-required group
│   ├── dashboard/
│   │   └── page.tsx                     # /dashboard
│   ├── business/
│   │   ├── new/page.tsx                 # /business/new
│   │   └── [id]/edit/page.tsx           # /business/[id]/edit
│   └── settings/
│       └── page.tsx                     # /settings
│
├── api/                                 # API routes
│   ├── geo/
│   ├── businesses/
│   ├── products/
│   ├── services/
│   ├── land/
│   ├── search/
│   └── auth/
│
└── [province]/                          # Geographic routes (CATCH-ALL)
    ├── page.tsx                         # /dong-nai
    └── [district]/
        ├── page.tsx                     # /dong-nai/tan-phu
        └── [[...slug]]/                 # Catch-all for everything below
            └── page.tsx                 # Handles:
                                         # /dong-nai/tan-phu/[commune]
                                         # /dong-nai/tan-phu/[business]
                                         # /dong-nai/tan-phu/[business]/p/[product]
                                         # /dong-nai/tan-phu/[business]/s/[service]
                                         # /dong-nai/tan-phu/dat/[land-slug]
                                         # /dong-nai/[crop]
```

### 2.2 Why This Structure

**1. Reserved Prefixes Avoid Conflicts**
- `/ho-kinh-doanh/` is reserved (never a province slug)
- `/dat-nong-nghiep/` is reserved
- `/danh-muc/` is reserved
- Province slugs cannot collide with these

**2. Catch-All Route Handles Polymorphic Content**
After `/dong-nai/tan-phu/`, the path can mean:
- A commune (`/dong-nai/tan-phu/xa-tan-phu`)
- A business (`/dong-nai/tan-phu/ca-tuoi-ba-nam`)
- A product sub-route (`/dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro`)
- Land subdirectory (`/dong-nai/tan-phu/dat/ruong-1000m2`)

One catch-all route resolves these intelligently.

**3. Group Routes `(marketing)`, `(auth)`**
Next.js route groups (parentheses) don't appear in URLs but organize code logically.

---

## 3. STOREFRONT ROUTES

### 3.1 Business Storefront URL Pattern

```
CANONICAL FORMAT:
/{province-slug}/{district-slug}/{business-slug}/

EXAMPLES:
/dong-nai/tan-phu/ca-tuoi-ba-nam/
/binh-duong/thu-dau-mot/quan-com-tam-ngon/
/binh-phuoc/dong-xoai/vua-dieu-anh-tam/
```

### 3.2 Storefront Page Resolution

```typescript
// app/[province]/[district]/[[...slug]]/page.tsx

export default async function CatchAllPage({ params }) {
  const { province, district, slug = [] } = params;
  
  // Step 1: Resolve geography first
  const geo = await resolveGeography(province, district);
  if (!geo) return notFound();
  
  // Step 2: No slug → district page (already handled by /district/page.tsx)
  if (slug.length === 0) {
    // Should not reach here, but fallback
    return redirect(`/${province}/${district}/`);
  }
  
  // Step 3: Parse slug pattern
  const [first, second, third] = slug;
  
  // Pattern A: Land subdirectory
  if (first === 'dat' && second) {
    return <LandPage province={geo.province} district={geo.district} landSlug={second} />;
  }
  
  // Pattern B: Crop-region page (e.g., /dong-nai/sau-rieng requires province only — handled at province level)
  
  // Pattern C: Commune page (only if commune exists)
  if (slug.length === 1) {
    const commune = await getCommune(geo.district.id, first);
    if (commune?.is_major) {
      return <CommunePage 
        province={geo.province} 
        district={geo.district} 
        commune={commune} 
      />;
    }
    
    // Pattern D: Business storefront
    const business = await getBusinessBySlug(geo.district.id, first);
    if (business) {
      return <BusinessPage 
        province={geo.province} 
        district={geo.district} 
        business={business} 
      />;
    }
    
    // Pattern E: Check slug history for redirect
    const redirect = await checkSlugHistory(`/${province}/${district}/${first}`);
    if (redirect) {
      return permanentRedirect(redirect.new_path);
    }
    
    return notFound();
  }
  
  // Pattern F: Business + product/service
  // /dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro
  if (slug.length === 3 && (second === 'p' || second === 's')) {
    const business = await getBusinessBySlug(geo.district.id, first);
    if (!business) return notFound();
    
    if (second === 'p') {
      const product = await getProductBySlug(business.id, third);
      if (!product) return notFound();
      return <ProductPage 
        province={geo.province}
        district={geo.district}
        business={business}
        product={product}
      />;
    }
    
    if (second === 's') {
      const service = await getServiceBySlug(business.id, third);
      if (!service) return notFound();
      return <ServicePage 
        province={geo.province}
        district={geo.district}
        business={business}
        service={service}
      />;
    }
  }
  
  return notFound();
}
```

### 3.3 Storefront Metadata Generation

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const business = await resolveBusinessFromParams(params);
  if (!business) return {};
  
  return {
    title: `${business.name} - ${business.category_name}, ${business.district_name}, ${business.province_name} | VIO LOCAL`,
    description: `${business.tagline}. ${business.formatted_address}. Gọi ${formatPhone(business.phone)}.`,
    openGraph: {
      title: business.name,
      description: business.tagline,
      url: `https://violocal.vn/${business.province_slug}/${business.district_slug}/${business.slug}/`,
      type: 'business.business',
      images: [business.hero_image_url]
    },
    alternates: {
      canonical: `https://violocal.vn/${business.province_slug}/${business.district_slug}/${business.slug}/`
    }
  };
}
```

### 3.4 Storefront Sub-Routes

```
PRIMARY:
/dong-nai/tan-phu/ca-tuoi-ba-nam/          # Main storefront

PRODUCT DETAIL:
/dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro-dong/

SERVICE DETAIL:
/dong-nai/tan-phu/ca-tuoi-ba-nam/s/giao-hang-tan-noi/

FORBIDDEN PATTERNS:
❌ /dong-nai/tan-phu/ca-tuoi-ba-nam/products/    # No plural folder
❌ /dong-nai/tan-phu/ca-tuoi-ba-nam/about        # No metadata pages
❌ /dong-nai/tan-phu/ca-tuoi-ba-nam/contact      # Contact is on main page
```

**Why `/p/` and `/s/`?**
- Single character to keep URL short
- Avoids conflict with business slugs (no business named "p" or "s")
- Clear distinction: `p` = product, `s` = service
- Reserved in `reserved_slugs` table

---

## 4. GEOGRAPHIC ROUTES

### 4.1 Province Routes

```
URL: /{province-slug}/
EXAMPLE: /dong-nai/

PURPOSE:
├── SEO landing page for province
├── Lists districts within province
├── Shows top categories in province
├── Aggregate statistics
└── Links to crop-region pages

INDEXED: Yes (high priority)
SITEMAP: Yes
CANONICAL: Self
```

### 4.2 District Routes

```
URL: /{province-slug}/{district-slug}/
EXAMPLE: /dong-nai/tan-phu/

PURPOSE:
├── SEO landing page for district
├── Lists businesses in district
├── Shows communes (top 100 only)
├── Filter by category
└── Map view of district

INDEXED: Yes (if ≥5 businesses)
SITEMAP: Yes (conditional)
CANONICAL: Self
```

### 4.3 Commune Routes (Selective)

```
URL: /{province-slug}/{district-slug}/{commune-slug}/
EXAMPLE: /dong-nai/tan-phu/xa-xuan-hung/

PURPOSE:
├── Hyperlocal discovery
├── Only for major communes (top 100)
└── Smaller communes redirect to district

INDEXED: Yes (if is_major flag is true)
SITEMAP: Yes (conditional)
CANONICAL: Self (or 301 to district if not major)
```

### 4.4 Crop-Region Routes

```
URL: /{province-slug}/{crop-slug}/
EXAMPLE: /dong-nai/sau-rieng/

PURPOSE:
├── Capture queries like "sầu riêng đồng nai"
├── Lists all sầu riêng producers in Đồng Nai
├── Crop-specific SEO
└── Strong hyperlocal long-tail capture

CONFLICT RESOLUTION:
├── /dong-nai/{X}/ → first check if X is a district slug
├── If district: render district page
└── If category slug: render crop-region page

INDEXED: Yes (if ≥3 producers)
SITEMAP: Yes (conditional)
CANONICAL: Self
```

### 4.5 Conflict Resolution: District vs Category

**Problem:** `/dong-nai/tan-phu/` could be a district OR a category slug.

**Solution:** Reserved slug rules and resolution order:

```typescript
async function resolveProvinceSubpath(province: Province, subpath: string) {
  // PRIORITY 1: Check if it's a district in this province
  const district = await db.query(
    'SELECT * FROM districts WHERE province_id = $1 AND slug = $2',
    [province.id, subpath]
  );
  
  if (district) return { type: 'district', entity: district };
  
  // PRIORITY 2: Check if it's a category (crop-region page)
  const category = await db.query(
    `SELECT * FROM categories 
     WHERE slug = $1 
     AND 'business' = ANY(applies_to)`,
    [subpath]
  );
  
  if (category) return { type: 'crop_region', entity: category };
  
  // PRIORITY 3: Check slug history (renames, aliases)
  const alias = await db.query(
    `SELECT * FROM geographic_aliases 
     WHERE entity_type IN ('district', 'province')
     AND alias_slug = $1
     AND is_active = true`,
    [subpath]
  );
  
  if (alias) return { type: 'redirect', target: alias };
  
  return null;
}
```

**Database constraint:** A district slug and a category slug CANNOT be identical. This is enforced at the database level:

```sql
-- Migration: prevent district/category slug conflicts
CREATE OR REPLACE FUNCTION check_slug_conflict()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM categories 
    WHERE slug = NEW.slug 
    AND 'business' = ANY(applies_to)
  ) THEN
    RAISE EXCEPTION 'District slug "%" conflicts with category slug', NEW.slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_districts_slug_check
  BEFORE INSERT OR UPDATE OF slug ON districts
  FOR EACH ROW EXECUTE FUNCTION check_slug_conflict();
```

---

## 5. PRODUCT ROUTES

### 5.1 Product URL Pattern

```
URL: /{province-slug}/{district-slug}/{business-slug}/p/{product-slug}/
EXAMPLE: /dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro-dong/

PURPOSE:
├── Product-specific SEO page
├── Detailed product info
├── Schema.org Product markup
└── Direct contact CTAs

WHY /p/ INSTEAD OF /products/?
├── Shorter URLs
├── Less common as a slug (no business named "p")
└── Distinguishes from sub-business content
```

### 5.2 Product Page Generation

```typescript
// Handled within catch-all route
// app/[province]/[district]/[[...slug]]/page.tsx

if (slug.length === 3 && slug[1] === 'p') {
  const [businessSlug, , productSlug] = slug;
  
  const business = await getBusinessBySlug(district.id, businessSlug);
  if (!business) return notFound();
  
  const product = await getProductBySlug(business.id, productSlug);
  if (!product) return notFound();
  
  // Check status
  if (product.status !== 'published') return notFound();
  
  return <ProductPage 
    province={province} 
    district={district} 
    business={business} 
    product={product} 
  />;
}
```

### 5.3 Product Sitemap Entry

```xml
<url>
  <loc>https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro-dong/</loc>
  <lastmod>2026-01-15T10:30:00Z</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.6</priority>
</url>
```

---

## 6. SERVICE ROUTES

### 6.1 Service URL Pattern

```
URL: /{province-slug}/{district-slug}/{business-slug}/s/{service-slug}/
EXAMPLE: /dong-nai/tan-phu/ca-tuoi-ba-nam/s/giao-hang-tan-noi/

PURPOSE:
├── Service-specific SEO page
├── Service area coverage info
├── Pricing details
└── Direct booking CTAs
```

### 6.2 Service Page Generation

```typescript
// Same pattern as product
if (slug.length === 3 && slug[1] === 's') {
  const [businessSlug, , serviceSlug] = slug;
  
  const business = await getBusinessBySlug(district.id, businessSlug);
  if (!business) return notFound();
  
  const service = await getServiceBySlug(business.id, serviceSlug);
  if (!service) return notFound();
  
  return <ServicePage 
    province={province}
    district={district}
    business={business}
    service={service}
  />;
}
```

---

## 7. LAND LISTING ROUTES

### 7.1 Land Listing Pattern

Land listings have a unique route pattern because:
- They may not be tied to a business
- They have a separate browsing context
- They benefit from a dedicated prefix

```
PRIMARY PATTERN (within district):
/{province-slug}/{district-slug}/dat/{land-slug}/
EXAMPLE: /dong-nai/tan-phu/dat/ruong-1000m2-gan-duong-lon/

CATEGORY PREFIX PATTERN (browse by type):
/dat-nong-nghiep/{province-slug}/
/dat-nong-nghiep/{province-slug}/{district-slug}/
EXAMPLES:
/dat-nong-nghiep/dong-nai/
/dat-nong-nghiep/dong-nai/tan-phu/
```

### 7.2 Why Two Patterns?

**Primary pattern** (`/dong-nai/tan-phu/dat/...`):
- Specific land listing
- Geographic hierarchy first
- SEO for "đất Tân Phú Đồng Nai"

**Category prefix pattern** (`/dat-nong-nghiep/dong-nai/...`):
- Browse all agricultural land in a region
- Capture queries like "đất nông nghiệp đồng nai"
- Functions as a category landing page

```
DECISION TABLE:
"Đất nông nghiệp 1000m² ở Tân Phú"  →  /dong-nai/tan-phu/dat/...    (specific listing)
"Đất nông nghiệp Đồng Nai"          →  /dat-nong-nghiep/dong-nai/   (browse)
"Đất nông nghiệp Tân Phú"           →  /dat-nong-nghiep/dong-nai/tan-phu/ (browse)
```

### 7.3 Land Type Prefixes

```
/dat-nong-nghiep/...     # Đất nông nghiệp (Agricultural)
/dat-tho-cu/...          # Đất thổ cư (Residential)
/dat-rung/...            # Đất rừng (Forestry)
/dat-thuong-mai/...      # Đất thương mại (Commercial)

NOTE: All these prefixes are reserved in `reserved_slugs` table
NOTE: No province can have these slugs
```

### 7.4 Land Listing Resolution

```typescript
// /dong-nai/tan-phu/dat/ruong-1000m2
if (slug[0] === 'dat' && slug[1]) {
  const landSlug = slug[1];
  const land = await getLandBySlug(district.id, landSlug);
  if (!land) return notFound();
  
  return <LandDetailPage 
    province={province}
    district={district}
    land={land}
  />;
}

// /dat-nong-nghiep/dong-nai/tan-phu
// Handled by /dat-nong-nghiep/[province]/[district]/page.tsx
```

---

## 8. HOUSEHOLD BUSINESS ROUTES

### 8.1 Pattern

Household businesses (hộ kinh doanh) are a special Vietnamese business type. They deserve a dedicated namespace:

```
URL PATTERN:
/ho-kinh-doanh/{province-slug}/{district-slug}/{business-slug}/

EXAMPLES:
/ho-kinh-doanh/dong-nai/tan-phu/vuon-bo-ba-nam/
/ho-kinh-doanh/binh-phuoc/dong-xoai/trang-trai-anh-tam/
```

### 8.2 Why a Separate Prefix?

```
ADVANTAGES:
✅ Captures specific queries: "hộ kinh doanh đồng nai"
✅ Verification badge for legitimate household businesses
✅ Different SEO landing pages
✅ Aggregated directory experience
✅ Phase 7+ premium features (verification, certifications)

DISADVANTAGE:
⚠️ Two URLs per business (this one + regular storefront)
⚠️ Risk of duplicate content
```

### 8.3 Duplicate Content Resolution

A business listed as a household business has **TWO URLs**:

```
URL 1: /dong-nai/tan-phu/vuon-bo-ba-nam/           (regular storefront)
URL 2: /ho-kinh-doanh/dong-nai/tan-phu/vuon-bo-ba-nam/  (household directory)
```

**Solution: Canonical points to ONE**

```html
<!-- On /ho-kinh-doanh/dong-nai/tan-phu/vuon-bo-ba-nam/ -->
<link rel="canonical" 
      href="https://violocal.vn/dong-nai/tan-phu/vuon-bo-ba-nam/">

<!-- The regular storefront IS the canonical -->
```

**Why this approach:**
- Primary storefront URL is canonical (preserves SEO)
- Household business URL acts as a directory/filter view
- Google indexes the canonical URL
- Users land on either URL legitimately

### 8.4 Database Flag

```sql
-- businesses table has an opt-in flag
ALTER TABLE businesses ADD COLUMN is_household_business BOOLEAN NOT NULL DEFAULT false;

-- Only flagged businesses appear in /ho-kinh-doanh/ directory
SELECT * FROM businesses 
WHERE is_household_business = true 
  AND status = 'published' 
  AND deleted_at IS NULL;
```

---

## 9. CATEGORY ROUTES

### 9.1 Category Landing Pages

```
URL: /danh-muc/{category-slug}/
EXAMPLES:
/danh-muc/                       # All categories
/danh-muc/sau-rieng/             # Sầu riêng landing
/danh-muc/ca-tuoi/               # Cá tươi landing
/danh-muc/thu-cong-my-nghe/      # Handicrafts landing
```

### 9.2 Category vs Crop-Region

```
DECISION:
/danh-muc/sau-rieng/           # Sầu riêng across all of Vietnam
/dong-nai/sau-rieng/           # Sầu riêng in Đồng Nai

DIFFERENT PAGES, DIFFERENT INTENTS:
├── /danh-muc/sau-rieng/   →   "all sầu riêng producers"
└── /dong-nai/sau-rieng/   →   "sầu riêng in Đồng Nai"

LINK STRUCTURE:
/danh-muc/sau-rieng/   links to →   /{province}/sau-rieng/ for each province
/dong-nai/sau-rieng/   links to →   /danh-muc/sau-rieng/ (parent category)
```

### 9.3 Subcategories (Future)

If categories grow hierarchical:

```
CURRENT (Phase 1-3):
/danh-muc/sau-rieng/

FUTURE (if needed):
/danh-muc/nong-nghiep/sau-rieng/

DEFER UNTIL: Categories show clear hierarchy patterns
```

---

## 10. SEARCH ROUTES

### 10.1 Search Interface

```
URL: /search
PARAMETERS:
?q=cá+tươi          # Search query
&province=dong-nai  # Filter by province (optional)
&category=ca-tuoi   # Filter by category (optional)
&lat=10.95          # User location (for distance)
&lng=107.30
&radius=10          # Search radius in km

INDEXED: NO (noindex via robots meta)
CANONICAL: /search (root, never with params)
```

### 10.2 Why Search Pages Are Not Indexed

```
REASONS:
1. Infinite combinations of params = millions of pages
2. Duplicate content (same results, different URLs)
3. Wastes Google crawl budget
4. Better routes exist for search intent:
   - "cá tươi đồng nai" → /dong-nai/ca-tuoi/  (canonical answer)
   - "sầu riêng" → /danh-muc/sau-rieng/      (canonical answer)
```

### 10.3 Search URL Handling

```typescript
// app/search/page.tsx
export const metadata = {
  title: 'Tìm kiếm | VIO LOCAL',
  description: 'Tìm doanh nghiệp, sản phẩm, dịch vụ tại Việt Nam',
  robots: {
    index: false,           // Don't index search results
    follow: true            // But follow links
  }
};

export default async function SearchPage({ searchParams }) {
  const query = searchParams.q;
  const filters = parseFilters(searchParams);
  
  const results = await search(query, filters);
  
  return <SearchResultsPage results={results} query={query} />;
}
```

### 10.4 Encouraging Canonical Routes

When a search query matches a canonical route, suggest the redirect:

```typescript
// In search results, if query is "cá tươi đồng nai"
// Show banner: "Xem trang tổng hợp: /dong-nai/ca-tuoi/"

if (matchesCanonicalRoute(query)) {
  // Show suggestion banner at top of results
  return (
    <SearchPage 
      banner={`
        💡 Tìm kiếm phù hợp với trang: 
        <a href="/dong-nai/ca-tuoi/">Cá tươi tại Đồng Nai</a>
      `}
      results={results}
    />
  );
}
```

---

## 11. CANONICAL ROUTE RULES

### 11.1 The One Canonical Rule

**Every page has exactly ONE canonical URL pointing to itself.**

```
GOOD:
Page: /dong-nai/tan-phu/ca-tuoi-ba-nam/
Canonical: https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam/

BAD:
Page: /dong-nai/tan-phu/ca-tuoi-ba-nam/
Canonical: https://violocal.vn/         (points to home — WRONG)
```

### 11.2 Trailing Slash Standard

**All URLs end with `/` (except API routes).**

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip static files
  if (pathname.includes('.')) {
    return NextResponse.next();
  }
  
  // Skip root
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // Ensure trailing slash
  if (!pathname.endsWith('/')) {
    const url = request.nextUrl.clone();
    url.pathname = `${pathname}/`;
    return NextResponse.redirect(url, 301);
  }
  
  return NextResponse.next();
}
```

### 11.3 HTTPS Always

```
HTTP → HTTPS: 301 redirect (configured at server/Vercel level)
WWW → non-WWW: 301 redirect (configured at DNS/server level)

CANONICAL FORM:
✅ https://violocal.vn/dong-nai/
❌ http://violocal.vn/dong-nai/
❌ https://www.violocal.vn/dong-nai/
❌ https://VIOLOCAL.VN/dong-nai/
```

### 11.4 Case Sensitivity

```
URLs are lowercase only.

VALID:
/dong-nai/tan-phu/

INVALID (redirect to lowercase):
/DONG-NAI/tan-phu/
/Dong-Nai/Tan-Phu/

IMPLEMENTATION:
middleware redirects uppercase to lowercase (301)
```

### 11.5 Special Characters

```
NO:
- Spaces (use hyphens)
- Underscores
- Vietnamese diacritics (use unaccent slugs)
- Encoded characters

ALLOWED:
- Lowercase ASCII letters (a-z)
- Numbers (0-9)
- Hyphens (-)
- Forward slashes (/)
```

---

## 12. REDIRECT RULES

### 12.1 Redirect Hierarchy

```
TYPE                              CODE   USE CASE
─────────────────────────────────────────────────────────────
Permanent (renamed/moved)         301    Business slug changed
Permanent (consolidated)          301    Two businesses merged
Permanent (district renamed)      301    Admin reorganization
Temporary (maintenance)           302    Avoid 301; rare
Removed (gone)                    410    Business soft-deleted
Not found                         404    Page doesn't exist
```

### 12.2 Slug History Redirects

When a business renames, the old slug must redirect:

```typescript
// middleware.ts (or app middleware)
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check slug history table for redirects
  const redirect = await db.query(
    `SELECT new_full_path, redirect_type
     FROM slug_history
     WHERE old_full_path = $1
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC
     LIMIT 1`,
    [pathname]
  );
  
  if (redirect) {
    const url = request.nextUrl.clone();
    url.pathname = redirect.new_full_path;
    return NextResponse.redirect(url, redirect.redirect_type || 301);
  }
  
  return NextResponse.next();
}
```

### 12.3 Geographic Alias Redirects

```typescript
// /tphcm/quan-1 → 301 → /ho-chi-minh/quan-1
async function checkGeographicAlias(province: string) {
  const alias = await db.query(
    `SELECT p.slug AS canonical_slug
     FROM geographic_aliases ga
     JOIN provinces p ON p.id = ga.entity_id
     WHERE ga.entity_type = 'province'
       AND ga.alias_slug = $1
       AND ga.is_active = true`,
    [province]
  );
  
  return alias?.canonical_slug;
}
```

### 12.4 Common Redirect Patterns

```
PATTERN 1: Trailing slash
/dong-nai     → 301 → /dong-nai/

PATTERN 2: HTTPS
http://violocal.vn/dong-nai/  → 301 → https://violocal.vn/dong-nai/

PATTERN 3: Lowercase
/DONG-NAI/    → 301 → /dong-nai/

PATTERN 4: Removed business
/dong-nai/tan-phu/old-business/  → 410 (Gone)

PATTERN 5: Renamed business
/dong-nai/tan-phu/old-name/  → 301 → /dong-nai/tan-phu/new-name/

PATTERN 6: Geographic alias
/tphcm/quan-1/  → 301 → /ho-chi-minh/quan-1/

PATTERN 7: Reorganized district
/dong-nai/old-district/  → 301 → /dong-nai/new-district/
```

### 12.5 Redirect Loop Prevention

```typescript
// Track redirect chains to prevent infinite loops
const MAX_REDIRECTS = 3;

async function followRedirectChain(path: string, depth = 0): Promise<string | null> {
  if (depth >= MAX_REDIRECTS) {
    // Log loop, return null
    logger.error('Redirect loop detected', { path });
    return null;
  }
  
  const next = await getRedirect(path);
  if (!next) return path;
  if (next === path) return path;  // Self-loop
  
  return followRedirectChain(next, depth + 1);
}
```

---

## 13. SLUG COLLISION PREVENTION

### 13.1 Reserved Slugs (Database-Enforced)

```sql
-- Already defined in DATABASE_ARCHITECTURE.md
INSERT INTO reserved_slugs (slug, reason) VALUES
  -- Top-level routes
  ('api', 'system-route'),
  ('admin', 'system-route'),
  ('dashboard', 'system-route'),
  ('settings', 'system-route'),
  ('login', 'system-route'),
  ('auth', 'system-route'),
  ('search', 'system-route'),
  
  -- Section prefixes
  ('danh-muc', 'category-prefix'),
  ('khu-vuc', 'location-prefix'),
  ('ho-kinh-doanh', 'household-prefix'),
  ('dat-nong-nghiep', 'land-prefix'),
  ('dat-tho-cu', 'land-prefix'),
  ('dat-rung', 'land-prefix'),
  ('dat-thuong-mai', 'land-prefix'),
  ('san-pham', 'product-prefix'),
  ('dich-vu', 'service-prefix'),
  
  -- Within-business prefixes
  ('p', 'product-subprefix'),
  ('s', 'service-subprefix'),
  ('dat', 'land-subprefix'),
  
  -- Marketing pages
  ('ve-vio-local', 'about-page'),
  ('lien-he', 'contact-page'),
  ('chinh-sach', 'policy-page'),
  ('dieu-khoan', 'terms-page'),
  ('faq', 'faq-page'),
  ('huong-dan', 'guide-page'),
  
  -- Web standards
  ('robots.txt', 'web-standard'),
  ('sitemap.xml', 'web-standard'),
  ('favicon.ico', 'web-standard');
```

### 13.2 Slug Uniqueness Constraints

```sql
-- Province slugs: globally unique
ALTER TABLE provinces ADD CONSTRAINT provinces_slug_unique UNIQUE (slug);

-- District slugs: unique within province
ALTER TABLE districts ADD CONSTRAINT districts_slug_unique UNIQUE (province_id, slug);

-- Commune slugs: unique within district
ALTER TABLE communes ADD CONSTRAINT communes_slug_unique UNIQUE (district_id, slug);

-- Business slugs: unique within district
ALTER TABLE businesses ADD CONSTRAINT businesses_slug_unique UNIQUE (district_id, slug);

-- Product slugs: unique within business
ALTER TABLE products ADD CONSTRAINT products_slug_unique UNIQUE (business_id, slug);

-- Service slugs: unique within business
ALTER TABLE services ADD CONSTRAINT services_slug_unique UNIQUE (business_id, slug);
```

### 13.3 Slug Generation with Conflict Resolution

```sql
-- Helper: ensure slug doesn't conflict with district names or reserved words
CREATE OR REPLACE FUNCTION generate_unique_business_slug(
  base_slug TEXT,
  target_district_id INTEGER
) RETURNS TEXT AS $$
DECLARE
  candidate TEXT := base_slug;
  counter INTEGER := 2;
BEGIN
  WHILE 
    -- Check if slug is reserved
    EXISTS (SELECT 1 FROM reserved_slugs WHERE slug = candidate)
    OR
    -- Check if slug conflicts with a district
    EXISTS (
      SELECT 1 FROM districts d
      JOIN businesses b ON b.district_id = d.id
      WHERE b.district_id = target_district_id
        AND d.slug = candidate
    )
    OR
    -- Check if business slug exists in district
    EXISTS (
      SELECT 1 FROM businesses
      WHERE district_id = target_district_id
        AND slug = candidate
        AND deleted_at IS NULL
    )
  LOOP
    candidate := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;
```

### 13.4 Category vs Geographic Conflicts

```sql
-- A category slug used in /{province}/{category}/ pattern
-- cannot be the same as a district slug in that province
CREATE OR REPLACE FUNCTION check_category_geo_conflict()
RETURNS TRIGGER AS $$
BEGIN
  -- When adding a category that applies to businesses,
  -- ensure no district has the same slug
  IF NEW.applies_to @> ARRAY['business'] THEN
    IF EXISTS (
      SELECT 1 FROM districts 
      WHERE slug = NEW.slug
    ) THEN
      RAISE EXCEPTION 'Category slug "%" conflicts with district name', NEW.slug;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_categories_geo_check
  BEFORE INSERT OR UPDATE OF slug ON categories
  FOR EACH ROW EXECUTE FUNCTION check_category_geo_conflict();
```

---

## 14. URL VALIDATION AT INPUT

### 14.1 Slug Generation Pipeline (Frontend)

```typescript
// When user creates a business name
function previewBusinessUrl(
  businessName: string,
  provinceSlug: string,
  districtSlug: string
): string {
  // Step 1: Normalize Vietnamese name to slug
  let slug = normalizeVietnameseSlug(businessName);
  
  // Step 2: Show preview URL
  return `/${provinceSlug}/${districtSlug}/${slug}/`;
}

// Real-time validation as user types
async function validateBusinessSlug(slug: string, districtId: number) {
  // Client-side checks
  if (slug.length > 100) return { valid: false, reason: 'Quá dài' };
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return { valid: false, reason: 'Định dạng không hợp lệ' };
  }
  
  // Server-side checks (debounced API call)
  const response = await fetch('/api/businesses/check-slug', {
    method: 'POST',
    body: JSON.stringify({ slug, district_id: districtId })
  });
  
  return response.json();
}
```

### 14.2 Server-Side Validation

```typescript
// app/api/businesses/check-slug/route.ts
export async function POST(req: Request) {
  const { slug, district_id } = await req.json();
  
  // Reserved slug check
  const isReserved = await db.query(
    'SELECT 1 FROM reserved_slugs WHERE slug = $1',
    [slug]
  );
  if (isReserved) {
    return Response.json({ 
      valid: false, 
      reason: 'Slug này được hệ thống dành riêng' 
    });
  }
  
  // Existing business check
  const exists = await db.query(
    `SELECT 1 FROM businesses 
     WHERE district_id = $1 
       AND slug = $2 
       AND deleted_at IS NULL`,
    [district_id, slug]
  );
  if (exists) {
    return Response.json({ 
      valid: false, 
      reason: 'Đã có doanh nghiệp với tên tương tự trong huyện này',
      suggestion: await generateAlternative(slug, district_id)
    });
  }
  
  // District name conflict
  const districtConflict = await db.query(
    'SELECT 1 FROM districts WHERE id = $1 AND slug = $2',
    [district_id, slug]
  );
  if (districtConflict) {
    return Response.json({
      valid: false,
      reason: 'Slug trùng với tên huyện'
    });
  }
  
  return Response.json({ valid: true });
}
```

---

## 15. PAGINATION & FILTERING

### 15.1 Pagination Strategy

**No `?page=N` parameters for primary content.**

```
WRONG (parameter-based):
/dong-nai/tan-phu/?page=2
/dong-nai/tan-phu/?page=3

RIGHT (path-based):
/dong-nai/tan-phu/                    # Page 1 (canonical)
/dong-nai/tan-phu/page/2/             # Page 2
/dong-nai/tan-phu/page/3/             # Page 3
```

### 15.2 Pagination SEO

```html
<!-- /dong-nai/tan-phu/ -->
<link rel="canonical" href="https://violocal.vn/dong-nai/tan-phu/">
<link rel="next" href="https://violocal.vn/dong-nai/tan-phu/page/2/">

<!-- /dong-nai/tan-phu/page/2/ -->
<link rel="canonical" href="https://violocal.vn/dong-nai/tan-phu/page/2/">
<link rel="prev" href="https://violocal.vn/dong-nai/tan-phu/">
<link rel="next" href="https://violocal.vn/dong-nai/tan-phu/page/3/">

<!-- Last page -->
<link rel="canonical" href="https://violocal.vn/dong-nai/tan-phu/page/5/">
<link rel="prev" href="https://violocal.vn/dong-nai/tan-phu/page/4/">
```

### 15.3 Filtering: Use Routes, Not Parameters

**When filtering by category, use route instead of parameter:**

```
WRONG:
/dong-nai/tan-phu/?category=ca-tuoi

RIGHT:
/dong-nai/tan-phu/ca-tuoi/          (category filter as path)

ROUTE RESOLUTION:
/dong-nai/tan-phu/ca-tuoi/
  → 1. Try business slug "ca-tuoi" → not found
  → 2. Try category slug "ca-tuoi" → found
  → 3. Render: district + category filter
```

**When parameters are unavoidable (search, complex filters):**
- Mark with `noindex`
- Don't include in sitemap
- Use canonical to clean version

---

## 16. API ROUTES (SEPARATE NAMESPACE)

### 16.1 API Route Structure

```
/api/
├── auth/
│   ├── request-otp/route.ts          # POST /api/auth/request-otp
│   ├── verify-otp/route.ts           # POST /api/auth/verify-otp
│   └── refresh/route.ts              # POST /api/auth/refresh
│
├── businesses/
│   ├── route.ts                      # GET/POST /api/businesses
│   └── [id]/
│       ├── route.ts                  # GET/PATCH/DELETE /api/businesses/[id]
│       ├── products/route.ts         # GET/POST /api/businesses/[id]/products
│       └── services/route.ts         # GET/POST /api/businesses/[id]/services
│
├── products/
│   ├── route.ts                      # GET /api/products
│   └── [id]/route.ts                 # GET/PATCH/DELETE /api/products/[id]
│
├── services/
│   ├── route.ts
│   └── [id]/route.ts
│
├── land/
│   ├── route.ts
│   └── [id]/route.ts
│
├── geo/
│   ├── provinces/route.ts            # GET /api/geo/provinces
│   ├── districts/route.ts            # GET /api/geo/districts
│   ├── communes/route.ts             # GET /api/geo/communes
│   └── locate/route.ts               # GET /api/geo/locate?lat=&lng=
│
├── search/
│   └── route.ts                      # GET /api/search
│
└── uploads/
    └── image/route.ts                # POST /api/uploads/image
```

### 16.2 API Rules

```
✅ ALL API routes start with /api/
✅ Numeric IDs in API (internal)
✅ UUIDs for public references (business.public_id)
✅ JSON only (no XML)
✅ RESTful conventions

❌ NO HTML responses from /api/*
❌ NO breaking changes (use versioning if needed)
❌ NO public traffic to API routes via robots.txt

❌ DO NOT USE PUBLIC URLs IN API:
   /api/businesses/12345         ✅ (internal ID)
   /api/businesses/ca-tuoi-ba-nam ❌ (slug is for /[province]/[district]/...)
```

### 16.3 API Indexing Rules

```
robots.txt:
Disallow: /api/

Meta tags (defensive):
<meta name="robots" content="noindex, nofollow">

If somehow indexed:
return Response.json(data, {
  headers: {
    'X-Robots-Tag': 'noindex, nofollow'
  }
});
```

---

## 17. FUTURE SCALABILITY RULES

### 17.1 Designed for 1M+ Businesses

**Sitemap Strategy:**

```
At 1,000 businesses:
└── /sitemap.xml (single file, ~5,000 URLs)

At 10,000 businesses:
└── /sitemap.xml (index)
    ├── /sitemap-businesses-dong-nai.xml
    ├── /sitemap-businesses-binh-duong.xml
    └── ... one per province

At 100,000 businesses:
└── /sitemap.xml (index)
    ├── /sitemap-businesses-dong-nai-1.xml  (split by 5k chunks)
    ├── /sitemap-businesses-dong-nai-2.xml
    └── ...

At 1M+ businesses:
└── /sitemap.xml (top-level index)
    ├── /sitemap-by-province.xml (sub-index per province)
    └── Sub-indexes split sitemaps further
```

### 17.2 Designed for Administrative Changes

```
If Vietnam reorganizes districts (rare but possible):
1. Add geographic alias for old name
2. Update business district_id (if boundary changed)
3. Add to slug_history for 301 redirects
4. Regenerate affected sitemaps
5. Old URLs continue working via redirects
```

### 17.3 Designed for New Entity Types

If future entity types are added (e.g., events, jobs):

```
RESERVED SLUG SPACE:
├── /su-kien/...           # Future: events
├── /tuyen-dung/...        # Future: jobs
├── /tin-tuc/...           # Future: news
└── /hop-tac-xa/...        # Future: cooperatives

ALL RESERVED IN reserved_slugs TABLE NOW
PREVENTS slug conflicts in future
```

### 17.4 Multi-Language (Phase 7+)

**DO NOT** add language to URL path now. If/when needed:

```
OPTION A: Subdomain (preferred)
en.violocal.vn/dong-nai/tan-phu/...

OPTION B: Path prefix (less preferred)
violocal.vn/en/dong-nai/tan-phu/...

DEFER UNTIL: Validated demand from English speakers
```

### 17.5 Performance at Scale

```
URL RESOLUTION SPEED:
├── Province lookup:    O(1) via slug index
├── District lookup:    O(1) via composite (province_id, slug) index
├── Business lookup:    O(1) via composite (district_id, slug) index
└── Product lookup:     O(1) via composite (business_id, slug) index

TOTAL: 3-4 indexed queries per page load
TARGET: < 30ms slug resolution
```

---

## 18. ERROR ROUTES

### 18.1 404 Strategy

```typescript
// app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h1>Không tìm thấy trang</h1>
      <p>Trang bạn yêu cầu không tồn tại hoặc đã bị xóa.</p>
      
      {/* Provide useful alternatives */}
      <nav>
        <a href="/">Trang chủ</a>
        <a href="/search">Tìm kiếm</a>
        <a href="/khu-vuc">Tất cả khu vực</a>
        <a href="/danh-muc">Tất cả danh mục</a>
      </nav>
    </div>
  );
}
```

### 18.2 Soft 404 Prevention

```
SCENARIO: Geographic page with no businesses
SOLUTION: Show meaningful content, not "empty list"

CODE:
if (district.business_count === 0) {
  return <DistrictEmptyState 
    district={district}
    province={province}
    nearbyDistricts={await getNearbyDistricts(district.id)}
  />;
}

NOT:
return <EmptyList />;  // Looks like 404 to Google
```

### 18.3 410 Gone for Removed Businesses

```typescript
// When a business is permanently deleted (rare)
if (business.deleted_at) {
  return Response.json(null, { 
    status: 410,  // Gone
    headers: {
      'Cache-Control': 'public, max-age=2592000'  // 30 days
    }
  });
}
```

---

## 19. ROUTE TESTING

### 19.1 Routes That Must Work

```
✅ /                                          (homepage)
✅ /dong-nai/                                 (province)
✅ /dong-nai/tan-phu/                         (district)
✅ /dong-nai/tan-phu/ca-tuoi-ba-nam/          (business)
✅ /dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro/  (product)
✅ /dong-nai/tan-phu/dat/ruong-1000m2/        (land)
✅ /dong-nai/sau-rieng/                       (crop-region)
✅ /danh-muc/sau-rieng/                       (category)
✅ /ho-kinh-doanh/dong-nai/tan-phu/vuon-bo/   (household)
✅ /dat-nong-nghiep/dong-nai/                 (land directory)
✅ /search                                    (search)
```

### 19.2 Routes That Must Redirect

```
/dong-nai              → 301 → /dong-nai/
/DONG-NAI/             → 301 → /dong-nai/
http://violocal.vn/    → 301 → https://violocal.vn/
/tphcm/quan-1/         → 301 → /ho-chi-minh/quan-1/
/old-business-name/    → 301 → /new-business-name/
```

### 19.3 Routes That Must Return 404

```
❌ /nonexistent-province/
❌ /dong-nai/nonexistent-district/
❌ /dong-nai/tan-phu/nonexistent-business/
❌ /api/businesses/nonexistent-id/
```

### 19.4 Routes That Must Be Excluded from Indexing

```
🚫 /api/*                  (X-Robots-Tag: noindex)
🚫 /dashboard/*            (noindex)
🚫 /settings/*             (noindex)
🚫 /search?q=*             (noindex)
🚫 /business/new           (noindex)
🚫 /admin/*                (disallowed via robots.txt)
```

---

## 20. SUMMARY TABLE

| Concept | Implementation |
|---|---|
| URL Format | `/{province}/{district}/{slug}/` |
| Sub-entities | `/p/{slug}/` for products, `/s/{slug}/` for services |
| Land | `/{province}/{district}/dat/{slug}/` |
| Household biz | `/ho-kinh-doanh/{province}/{district}/{slug}/` |
| Crop-region | `/{province}/{crop}/` |
| Category | `/danh-muc/{category}/` |
| Trailing slash | Required (301 redirect if missing) |
| Case | Lowercase (301 redirect if uppercase) |
| Special chars | Hyphens only |
| Query params | Only for search/filters, noindex |
| Pagination | `/page/N/` path, not `?page=N` |
| Slug uniqueness | Within scope (district for businesses) |
| Slug conflicts | Reserved table + DB constraints |
| Renames | 301 via slug_history |
| Removed | 410 Gone |
| Not found | 404 with helpful alternatives |

---

## 21. FINAL DIRECTIVES

### 21.1 The URL Contract

**URLs are contracts with users and search engines.** Once published, they should never break.

```
RULE 1: URLs are permanent
RULE 2: Renames go through 301 redirects, not direct changes
RULE 3: Slug history preserves SEO authority forever
RULE 4: New entity types don't disrupt existing routes
```

### 21.2 The Simplicity Rule

**If a URL needs explanation, it's wrong.**

```
✅ GOOD: /dong-nai/tan-phu/ca-tuoi-ba-nam/
   → "Cá Tươi Bà Năm in Tân Phú, Đồng Nai"
   → Self-explanatory

❌ BAD: /b/12345?province=1&district=251
   → Requires translation
   → Loses keywords
   → Unstable IDs
```

### 21.3 The Conflict Prevention Rule

**Slug conflicts are bugs, not features.**

```
- Reserved slugs in database (enforced)
- Triggers prevent invalid slug creation
- Unique constraints at appropriate scope
- Validation at API and UI layers
```

### 21.4 The Scalability Rule

**Design for 1M+ businesses today.**

```
- No URL pattern that requires renumbering at scale
- No structure that gets slow with growth
- No nesting deeper than 4 levels
- No query parameters for primary content
```

### 21.5 The SEO Rule

**Every URL is a ranking opportunity.**

```
- Keywords in path
- Geographic context embedded
- Canonical points to itself
- Crawlable and indexable (or explicitly noindex)
```

---

**END OF ROUTING ARCHITECTURE v1.0**

*URLs are not implementation details. They are infrastructure. They are SEO. They are the contract between VIO LOCAL and millions of future users. Design them once, design them right, and they will serve for years.*