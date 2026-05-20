# VIO LOCAL — GEOGRAPHIC SYSTEM
**Version 1.0 | Hyperlocal Infrastructure for Vietnam**

---

## 0. GEOGRAPHIC SYSTEM PHILOSOPHY

### 0.1 Core Principle

**The geographic system is the foundation of VIO LOCAL.**

It is not a feature — it is infrastructure. Every business, product, service, and land listing lives at a specific point in Vietnamese geography. The platform succeeds or fails based on how well geography is modeled, indexed, and served.

### 0.2 Design Imperatives

1. **Geographic hierarchies are STABLE** but Vietnam has had administrative reorganizations. Design for change.
2. **SEO DEPENDS ON GEOGRAPHY** — URLs encode location. Renames must not break SEO.
3. **SCALE WITH LOCATION** — At 100k+ businesses, queries must still be fast via geographic indexes.
4. **VIETNAMIZATION IS FIRST-CLASS** — Vietnamese place names, diacritics, cultural naming patterns.
5. **NO HARDCODED DATA IN FRONTEND** — All geographic data comes from the API/database.

### 0.3 Success Metrics

```
Geographic System Succeeds When:
✅ A user can find nearby businesses in < 200ms
✅ A business name can be queried across provinces without conflict
✅ A province rename doesn't break existing URLs
✅ SEO ranking transfers correctly through redirects
✅ Hyperlocal queries ("cá tươi tại Huyện Tân Phú") work
✅ Frontend never hardcodes province/district lists
```

---

## 1. GEOGRAPHIC HIERARCHY

### 1.1 The Vietnamese Administrative Structure

```
VIETNAM (Quốc gia)
├── REGION (Vùng) [not a data level, just grouping]
│   ├── North (Miền Bắc)
│   ├── Central (Miền Trung)
│   └── South (Miền Nam)
│
└── PROVINCE (Tỉnh / Thành phố) [63 total]
    ├── DISTRICT (Huyện / Quận / Thị xã) [~700 total]
    │   ├── COMMUNE (Xã / Phường / Thị trấn) [~11,000 total]
    │   └── VILLAGE (Ấp / Thôn) [not indexed in DB]
    │
    └── METROPOLITAN (Thành phố / Huyện in a city)
        └── DISTRICT → WARD (Quận / Phường) [alternative structure]
```

### 1.2 Two Structural Patterns

**PATTERN A: Traditional Rural (Most Common)**
```
Tỉnh Đồng Nai (Province)
  └── Huyện Tân Phú (District)
      └── Xã Tân Phú (Commune)
          └── Ấp 3 (Village) — not in DB
```

**PATTERN B: Metropolitan (Ho Chi Minh, Hanoi, Danang)**
```
Thành phố Hồ Chí Minh (City / Province-equivalent)
  └── Quận 1 (District)
      └── Phường Bến Nghé (Ward = Commune)
```

### 1.3 Why Three Levels (Province/District/Commune)

```
Province (63 entries):
  ✅ Grouping mechanism
  ✅ Top-level SEO pages (/dong-nai)
  ✅ Regional statistics

District (~700 entries):
  ✅ Mid-level SEO pages (/dong-nai/tan-phu)
  ✅ Majority of business listings
  ✅ Hyperlocal search scope

Commune (~11,000 entries):
  ✅ Ultra-local discovery
  ✅ "Businesses near me" accuracy
  ✅ Village-level granularity
  ⚠️  Only generate pages for top 100 by business count (Phase 4)
```

**Village Level (NOT in DB):**
- Too granular (50,000+ hamlets/villages)
- No value for discoverability
- Store as free text in address field (e.g., "Ấp 3, Xã Tân Phú")

---

## 2. GEOGRAPHIC DATA SCHEMA

### 2.1 `provinces` Table Structure

```sql
CREATE TABLE provinces (
  -- Identity
  id              SMALLINT PRIMARY KEY,            -- GSO official code (1-97)
  code_iso        VARCHAR(10),                     -- "VN-01"
  
  -- Names
  name            VARCHAR(100) NOT NULL UNIQUE,    -- "Đồng Nai"
  name_with_type  VARCHAR(150) NOT NULL,           -- "Tỉnh Đồng Nai"
  name_viet_only  VARCHAR(100) NOT NULL,           -- "Tỉnh Đông Nai" if spelling varies
  
  -- URL slug
  slug            VARCHAR(100) NOT NULL UNIQUE,    -- "dong-nai"
  slug_aliases    TEXT[],                          -- Old names that mapped here
  
  -- Type
  type            VARCHAR(20) NOT NULL,
    -- 'tinh' (Tỉnh)
    -- 'thanh-pho-truc-thuoc' (Thành phố trực thuộc)
    -- Examples: 'Tỉnh Đồng Nai', 'Thành phố Hà Nội', 'Thành phố Hồ Chí Minh'
  
  -- Geography
  region          VARCHAR(20) NOT NULL,            -- 'bac' | 'trung' | 'nam'
  center_lat      DOUBLE PRECISION NOT NULL,       -- For map centering
  center_lng      DOUBLE PRECISION NOT NULL,
  center_location GEOGRAPHY(Point, 4326) NOT NULL,
  
  -- Bounding box (for map viewport)
  bbox            JSONB NOT NULL,
  /* {
    "min_lat": 10.2,
    "min_lng": 106.5,
    "max_lat": 12.1,
    "max_lng": 108.9,
    "zoom_level": 8
  } */
  
  -- Boundary polygon (for visualization)
  boundary        GEOGRAPHY(MultiPolygon, 4326),   -- Optional, large
  
  -- Cached statistics (updated nightly)
  stats           JSONB NOT NULL DEFAULT '{}',
  /* {
    "business_count": 1234,
    "product_count": 5678,
    "service_count": 910,
    "land_count": 234,
    "last_updated": "2026-01-15T10:30:00Z"
  } */
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provinces_slug ON provinces(slug);
CREATE INDEX idx_provinces_type ON provinces(type);
CREATE INDEX idx_provinces_location ON provinces USING GIST(center_location);
CREATE INDEX idx_provinces_boundary ON provinces USING GIST(boundary);
```

### 2.2 `districts` Table Structure

```sql
CREATE TABLE districts (
  -- Identity
  id              INTEGER PRIMARY KEY,             -- GSO official code
  code_iso        VARCHAR(10),                     -- "VN-01-001"
  
  -- Hierarchy
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  
  -- Names
  name            VARCHAR(100) NOT NULL,           -- "Tân Phú"
  name_with_type  VARCHAR(150) NOT NULL,           -- "Huyện Tân Phú"
  name_viet_only  VARCHAR(100) NOT NULL,
  
  -- URL slug (unique within province, not globally)
  slug            VARCHAR(100) NOT NULL,           -- "tan-phu"
  slug_aliases    TEXT[],                          -- Old names
  
  -- Type
  type            VARCHAR(20) NOT NULL,
    -- 'huyen' | 'quan' | 'thi-xa' | 'thanh-pho' | 'thanh-pho-chu-luc'
  
  -- Geography
  center_lat      DOUBLE PRECISION NOT NULL,
  center_lng      DOUBLE PRECISION NOT NULL,
  center_location GEOGRAPHY(Point, 4326) NOT NULL,
  
  bbox            JSONB NOT NULL,
  boundary        GEOGRAPHY(MultiPolygon, 4326),
  
  -- Distance to province center (cached for quick sorting)
  distance_to_province_center_km DOUBLE PRECISION,
  
  -- Cached stats
  stats           JSONB NOT NULL DEFAULT '{}',
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: slug unique within province
  UNIQUE(province_id, slug)
);

CREATE INDEX idx_districts_province ON districts(province_id);
CREATE INDEX idx_districts_slug ON districts(province_id, slug);
CREATE INDEX idx_districts_type ON districts(type);
CREATE INDEX idx_districts_location ON districts USING GIST(center_location);
CREATE INDEX idx_districts_boundary ON districts USING GIST(boundary);
```

### 2.3 `communes` Table Structure

```sql
CREATE TABLE communes (
  -- Identity
  id              INTEGER PRIMARY KEY,             -- GSO official code
  code_iso        VARCHAR(10),
  
  -- Hierarchy (denormalized for query speed)
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  district_id     INTEGER NOT NULL REFERENCES districts(id),
  
  -- Names
  name            VARCHAR(100) NOT NULL,           -- "Tân Phú"
  name_with_type  VARCHAR(150) NOT NULL,           -- "Xã Tân Phú"
  
  -- URL slug (unique within district, not globally)
  slug            VARCHAR(100) NOT NULL,           -- "xa-tan-phu"
  slug_aliases    TEXT[],
  
  -- Type
  type            VARCHAR(20) NOT NULL,
    -- 'xa' | 'phuong' | 'thi-tran'
  
  -- Geography
  center_lat      DOUBLE PRECISION NOT NULL,
  center_lng      DOUBLE PRECISION NOT NULL,
  center_location GEOGRAPHY(Point, 4326) NOT NULL,
  
  boundary        GEOGRAPHY(MultiPolygon, 4326),
  
  -- Cached stats
  business_count  INTEGER NOT NULL DEFAULT 0,
  
  -- Decision: only generate SEO pages for top 100 communes
  is_major        BOOLEAN NOT NULL DEFAULT false,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(district_id, slug)
);

CREATE INDEX idx_communes_district ON communes(district_id);
CREATE INDEX idx_communes_province ON communes(province_id);
CREATE INDEX idx_communes_slug ON communes(district_id, slug);
CREATE INDEX idx_communes_is_major ON communes(is_major) WHERE is_major = true;
CREATE INDEX idx_communes_location ON communes USING GIST(center_location);
```

### 2.4 Why GSO Official Codes as Primary Keys

```
GSO = Tổng cục Thống kê (General Statistics Office)

✅ ADVANTAGES:
  - Official Vietnamese government source
  - Stable across database versions
  - Used by Vietnamese apps (universal reference)
  - Enables data linking with external Vietnamese datasets
  - No ambiguity (prevents duplicate provinces)

⚠️  CONSIDERATIONS:
  - Vietnam has reorganized boundaries (e.g., Tây Ninh lost a district)
  - Our PK must never change (immutable)
  - If a district is split, old code goes to history table
  - New code becomes new PK
```

---

## 3. SLUG NORMALIZATION SYSTEM

### 3.1 Vietnamese Diacritic Normalization

Vietnamese has many diacritics. Slugs must be ASCII-safe but searchable.

```
ORIGINAL:              SLUG:
─────────────────────────────────────
Tỉnh Đồng Nai     →    dong-nai
Huyện Tân Phú     →    tan-phu
Xã Tân Phú        →    xa-tan-phu
Huyện Xuân Lộc    →    xuan-loc
Phường Bến Nghé   →    phuong-ben-nghe
```

### 3.2 Slug Generation Algorithm

```sql
-- Database function for slug generation
CREATE OR REPLACE FUNCTION normalize_vietnamese_slug(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Step 1: Lowercase
  result := lower(input_text);
  
  -- Step 2: Remove Vietnamese diacritics using unaccent
  result := unaccent(result);
  
  -- Step 3: Handle special Vietnamese characters
  -- Đ/đ -> d (already handled by unaccent, but ensure)
  result := replace(result, 'đ', 'd');
  result := replace(result, 'Đ', 'd');
  
  -- Step 4: Remove type prefix (optional - handle in app or not)
  -- "tinh dong-nai" -> "dong-nai" (if type prefix included)
  -- For now, don't strip - let callers pass cleaned names
  
  -- Step 5: Replace spaces and punctuation with hyphens
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  
  -- Step 6: Remove leading/trailing hyphens
  result := trim(both '-' from result);
  
  -- Step 7: Limit to 100 characters
  result := substring(result, 1, 100);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;
```

### 3.3 Slug Collision Resolution

**Within Scope (unique within province/district):**

```sql
-- Check if slug exists in province
SELECT COUNT(*) FROM districts
WHERE province_id = $province_id
  AND slug = $slug;

-- If collision, append number
-- Example: "tan-phu" exists, so new one becomes "tan-phu-2"
```

**Collision Algorithm:**

```typescript
// Application layer
async function ensureUniqueDistrictSlug(
  baseSlug: string,
  provinceId: number
): Promise<string> {
  let candidate = baseSlug;
  let counter = 2;
  
  while (await slugExists(candidate, provinceId)) {
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return candidate;
}
```

### 3.4 Reserved Slugs

```sql
CREATE TABLE reserved_slugs (
  slug            VARCHAR(50) PRIMARY KEY,
  reason          VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with system routes
INSERT INTO reserved_slugs (slug, reason) VALUES
  ('api', 'system-route'),
  ('admin', 'system-route'),
  ('dashboard', 'system-route'),
  ('search', 'system-route'),
  ('auth', 'system-route'),
  ('login', 'system-route'),
  ('khu-vuc', 'location-prefix'),
  ('danh-muc', 'category-prefix'),
  ('san-pham', 'product-prefix'),
  ('dich-vu', 'service-prefix'),
  ('bat-dong-san', 'land-prefix'),
  ('trang-chu', 'homepage'),
  ('ve-chung-toi', 'about-page'),
  ('lien-he', 'contact-page'),
  ('faq', 'faq-page'),
  ('chinh-sach', 'policy-page');
```

---

## 4. GEOGRAPHIC ALIAS SYSTEM

### 4.1 Why Aliases Matter

Vietnam's administrative boundaries change. Districts are renamed, reorganized, merged.

```
Historical Examples:
- "Huyện Phước Long" (Bình Phước) → "Huyện Phước Long, Bình Phước"
- "Huyện Long Thành" (Đồng Nai) → boundaries changed, split off areas
- Province boundaries shifted after wars (historical data)

Current Aliases Needed:
- Alternative name spellings ("Thành phố Hồ Chí Minh" vs "TP HCM")
- Old official names before 2009 reorganization
- Colloquial names used by locals
```

### 4.2 `geographic_aliases` Table

```sql
CREATE TABLE geographic_aliases (
  id              BIGSERIAL PRIMARY KEY,
  
  -- What entity this aliases
  entity_type     VARCHAR(20) NOT NULL,           -- 'province' | 'district' | 'commune'
  entity_id       INTEGER NOT NULL,
  
  -- The old name or alternate name
  alias_slug      VARCHAR(100) NOT NULL,
  alias_name      VARCHAR(150) NOT NULL,
  
  -- Why this alias exists
  reason          VARCHAR(50) NOT NULL,
    -- 'old-name' (pre-reorganization)
    -- 'colloquial' (local usage)
    -- 'alternate-spelling' (variant)
    -- 'merged-into' (district merged, redirect)
  
  -- When does this alias expire (if ever)?
  -- NULL = permanent (colloquial, alternate spellings)
  -- Filled = temporary (until users transition to new name)
  expires_at      TIMESTAMPTZ,
  
  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT true,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aliases_entity ON geographic_aliases(entity_type, entity_id);
CREATE INDEX idx_aliases_slug ON geographic_aliases(alias_slug);
CREATE INDEX idx_aliases_active ON geographic_aliases(is_active) WHERE is_active = true;
```

### 4.3 Alias Resolution Logic

**When a URL is requested with an old slug:**

```typescript
// Next.js middleware / app router
async function resolveGeographicAlias(
  type: 'province' | 'district' | 'commune',
  slug: string
): Promise<{ entity: Entity; redirect: boolean }> {
  
  // Step 1: Try direct slug match
  const direct = await db.query(
    `SELECT * FROM ${type}s WHERE slug = $1`,
    [slug]
  );
  if (direct) return { entity: direct, redirect: false };
  
  // Step 2: Try alias lookup
  const alias = await db.query(
    `SELECT ga.entity_id, g.slug
     FROM geographic_aliases ga
     JOIN ${type}s g ON g.id = ga.entity_id
     WHERE ga.entity_type = $1
       AND ga.alias_slug = $2
       AND ga.is_active = true`,
    [type, slug]
  );
  
  if (alias) return { entity: alias, redirect: true };
  
  // Step 3: Not found
  return null;
}
```

### 4.4 Example Aliases for Vietnam

```sql
-- Ho Chi Minh City variants
INSERT INTO geographic_aliases (entity_type, entity_id, alias_slug, alias_name, reason)
VALUES ('province', $hochiminh_id, 'tphcm', 'TP HCM', 'colloquial');
INSERT INTO geographic_aliases (entity_type, entity_id, alias_slug, alias_name, reason)
VALUES ('province', $hochiminh_id, 'sai-gon', 'Sài Gòn', 'colloquial');
INSERT INTO geographic_aliases (entity_type, entity_id, alias_slug, alias_name, reason)
VALUES ('province', $hochiminh_id, 'thanh-pho-ho-chi-minh', 'Thành phố Hồ Chí Minh', 'full-name');

-- 2009 administrative reorganization (old district names that no longer exist)
INSERT INTO geographic_aliases (entity_type, entity_id, alias_slug, alias_name, reason, expires_at)
VALUES (
  'district',
  $new_district_id,
  'old-district-name',
  'Huyện Cũ',
  'merged-into',
  now() + INTERVAL '5 years'  -- Auto-remove after 5 years
);
```

---

## 5. SEO ROUTING STRATEGY

### 5.1 URL Structure (Canonical)

```
PROVINCE:
  /dong-nai
  /dong-nai/
  
DISTRICT:
  /dong-nai/tan-phu
  /dong-nai/tan-phu/
  
COMMUNE (only major, top 100):
  /dong-nai/tan-phu/xuan-hung
  /dong-nai/tan-phu/xuan-hung/
  
BUSINESS:
  /dong-nai/tan-phu/ca-tuoi-ba-nam
  
PRODUCT:
  /dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro-dong
  
SERVICE:
  /dong-nai/tan-phu/ca-tuoi-ba-nam/s/giao-hang-nhanh
  
LAND:
  /dong-nai/tan-phu/dat/ruong-1000m2
```

### 5.2 Routing Rules (Next.js App Router)

```
app/
├── page.tsx                                    # Homepage
├── search/page.tsx                             # Search page
├── [province]/
│   ├── page.tsx                                # Province page
│   ├── [district]/
│   │   ├── page.tsx                            # District page
│   │   ├── [commune]/
│   │   │   ├── page.tsx                        # Commune page
│   │   │   ├── [[...slug]]/page.tsx            # Business/Product/Service/Land
│   │   │   └── dat/[slug]/page.tsx             # Land listings
│   │   └── [[...slug]]/page.tsx                # Business/Product/Service
│   └── layout.tsx                              # Province layout
└── api/
    └── geo/
        ├── provinces.ts
        ├── districts.ts
        └── communes.ts
```

### 5.3 Route Matching Algorithm

**When accessing `/{province}/{district}/{slug}`:**

```typescript
// app/[province]/[district]/[[...slug]]/page.tsx
export default async function LocationPage(props) {
  const { province, district, slug } = props.params;
  
  // Step 1: Resolve province (with alias support)
  const prov = await resolveGeographic('province', province);
  if (!prov) return notFound();
  
  // Step 2: Resolve district within province
  const dist = await resolveGeographic('district', district, { province_id: prov.id });
  if (!dist) return notFound();
  
  // Step 3: If no slug → district page
  if (!slug || slug.length === 0) {
    return <DistrictPage province={prov} district={dist} />;
  }
  
  // Step 4: If slug is a commune name → try commune page
  // Check if first slug segment is a commune
  const commune = await resolveGeographic('commune', slug[0], { district_id: dist.id });
  if (commune && (!slug[1])) {
    return <CommunePage province={prov} district={dist} commune={commune} />;
  }
  
  // Step 5: Try as business/product/service/land listing
  const [baseSlug, type, subslug] = slug; // ['ca-tuoi-ba-nam'] or ['ca-tuoi-ba-nam', 'p', 'ca-ro']
  
  if (type === 'p') {
    // Product
    return <ProductPage province={prov} district={dist} 
                        businessSlug={baseSlug} productSlug={subslug} />;
  } else if (type === 's') {
    // Service
    return <ServicePage ... />;
  } else if (baseSlug === 'dat') {
    // Land listing
    return <LandPage province={prov} district={dist} landSlug={slug[1]} />;
  } else {
    // Business
    return <BusinessPage province={prov} district={dist} businessSlug={baseSlug} />;
  }
}
```

### 5.4 Slug Resolution with Database

```sql
-- Reusable function: get business with full geographic context
CREATE OR REPLACE FUNCTION get_business_by_slug(
  province_slug VARCHAR,
  district_slug VARCHAR,
  business_slug VARCHAR
) RETURNS TABLE (
  business_id BIGINT,
  province_id SMALLINT,
  district_id INTEGER,
  business_name VARCHAR,
  -- more columns
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id, p.id, d.id, b.name
  FROM businesses b
  JOIN districts d ON b.district_id = d.id
  JOIN provinces p ON b.province_id = p.id
  WHERE p.slug = $1
    AND d.slug = $2
    AND b.slug = $3
    AND b.status = 'published'
    AND b.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;
```

### 5.5 Trailing Slash Handling

```typescript
// Middleware: normalize trailing slashes
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // All geographic pages accept trailing slash
  // Canonical form: WITH trailing slash for SEO consistency
  if (path !== '/' && !path.endsWith('/')) {
    return NextResponse.redirect(`${path}/`);
  }
  
  return NextResponse.next();
}

// Config: apply to geographic routes only
export const config = {
  matcher: ['/:province', '/:province/:district', '/:province/:district/:slug*'],
};
```

---

## 6. NEARBY DISCOVERY STRATEGY

### 6.1 PostGIS Queries for Proximity

**Core Query: Find nearby businesses**

```sql
-- Find all businesses within radius of user location
-- Optimized with PostGIS GIST index
SELECT 
  b.id, b.public_id, b.name, b.slug,
  d.province_id, d.id as district_id,
  p.slug as province_slug,
  d.slug as district_slug,
  ST_Distance(b.location, $user_location::geography) / 1000 AS distance_km
FROM businesses b
JOIN districts d ON b.district_id = d.id
JOIN provinces p ON d.province_id = p.id
WHERE b.status = 'published'
  AND b.deleted_at IS NULL
  AND ST_DWithin(
    b.location,
    $user_location::geography,
    $radius_meters
  )
ORDER BY b.location <-> $user_location::geography  -- PostGIS spacial ordering
LIMIT 20;
```

**Why this is fast:**
- `ST_DWithin` uses GIST index to eliminate candidates
- `<->` operator orders remaining results by distance
- No full table scan; index narrows to ~5-10% of rows first

### 6.2 Hierarchical Nearby (Province → District → Commune)

When a user is at GPS coordinates, we can infer administrative location:

```sql
-- Find which province/district/commune user is in
WITH nearby_geo AS (
  SELECT 
    p.id as province_id, p.name as province_name, p.slug as province_slug,
    d.id as district_id, d.name as district_name, d.slug as district_slug,
    c.id as commune_id, c.name as commune_name, c.slug as commune_slug,
    ST_Distance(c.center_location, $user_location::geography) / 1000 AS dist_to_center
  FROM communes c
  JOIN districts d ON c.district_id = d.id
  JOIN provinces p ON d.province_id = p.id
  WHERE ST_DWithin(c.boundary, $user_location::geography, 1000)  -- 1km buffer
  ORDER BY dist_to_center ASC
  LIMIT 1
)
SELECT * FROM nearby_geo;
```

### 6.3 Fallback to Administrative Center

If user is in a rural area with no commune boundary:

```sql
-- Fall back to nearest district center
WITH closest_district AS (
  SELECT 
    d.id, d.slug, p.id as province_id, p.slug as province_slug,
    ST_Distance(d.center_location, $user_location::geography) / 1000 AS dist
  FROM districts d
  JOIN provinces p ON d.province_id = p.id
  ORDER BY d.center_location <-> $user_location::geography
  LIMIT 1
)
SELECT 
  p.slug as province_slug,
  d.slug as district_slug,
  dist as distance_km
FROM closest_district cd
JOIN districts d ON cd.id = d.id
JOIN provinces p ON d.province_id = p.id;
```

### 6.4 Search with Geographic Weighting

Text search results ranked by relevance + distance:

```sql
SELECT 
  b.id, b.name, b.slug,
  ts_rank(b.search_vector, query) as relevance,
  ST_Distance(b.location, $user_location::geography) / 1000 as distance_km,
  -- Combined score: relevance + inverse distance
  (ts_rank(b.search_vector, query) * 10 + (100 / (distance_km + 1))) as combined_score
FROM businesses b,
     plainto_tsquery('vietnamese', unaccent($query)) as query
WHERE b.status = 'published'
  AND b.deleted_at IS NULL
  AND b.search_vector @@ query
ORDER BY combined_score DESC, distance_km ASC
LIMIT 20;
```

### 6.5 Caching Nearby Results

Pre-compute and cache results for popular locations:

```sql
-- Cache: nearby businesses for each district center
CREATE TABLE cached_nearby_by_location (
  center_location GEOGRAPHY(Point, 4326) PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id),
  
  -- Cached results (JSONB for flexibility)
  nearby_within_5km JSONB NOT NULL,
  nearby_within_10km JSONB NOT NULL,
  nearby_within_25km JSONB NOT NULL,
  
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Refresh nightly
CREATE OR REPLACE FUNCTION refresh_nearby_cache()
RETURNS VOID AS $$
BEGIN
  -- For each district center
  TRUNCATE cached_nearby_by_location;
  
  INSERT INTO cached_nearby_by_location
  SELECT 
    d.center_location,
    d.id,
    json_agg(jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'distance_km', ROUND(
        ST_Distance(b.location, d.center_location)::numeric / 1000, 2
      )
    )) FILTER (WHERE ST_DWithin(b.location, d.center_location, 5000)) as nearby_5km,
    -- similar for 10km, 25km
  FROM districts d
  LEFT JOIN businesses b ON 
    b.status = 'published' 
    AND b.deleted_at IS NULL
    AND b.location IS NOT NULL
  GROUP BY d.id, d.center_location;
END;
$$ LANGUAGE plpgsql;
```

---

## 7. HYPERLOCAL SEO STRATEGY

### 7.1 URL Structure is SEO

Every storefront URL encodes location:

```
OLD (BAD for SEO):
/business/ca-tuoi-ba-nam
/b/12345
/store?id=ca-tuoi-ba-nam

NEW (GOOD for SEO):
/dong-nai/tan-phu/ca-tuoi-ba-nam
├─ "dong-nai"   → province signal
├─ "tan-phu"    → district signal
└─ "ca-tuoi-ba-nam" → business name
```

**Google understands the hierarchy.** It learns that "cá tươi" (fresh fish) businesses in "Tân Phú" district are similar — contextually linked.

### 7.2 Structured Data (Schema.org)

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Cá Tươi Bà Năm",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Đường Tỉnh Lộ 2, số 123",
    "addressLocality": "Xã Tân Phú",
    "addressRegion": "Huyện Tân Phú",
    "addressRegionProvince": "Tỉnh Đồng Nai",
    "addressCountry": "VN",
    "postalCode": "76000"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 10.8231,
    "longitude": 107.1921
  }
}
```

### 7.3 Geographic Landing Pages Generate SEO Authority

**Province Page (`/dong-nai/`):**
- Ranks for: "cửa hàng tại Đồng Nai", "doanh nghiệp Đồng Nai", "sản phẩm nông sản Đồng Nai"
- Backlinks from: all 750+ district pages in the province
- Internal linking: builds authority for the province brand

**District Page (`/dong-nai/tan-phu/`):**
- Ranks for: "cá tươi tại Huyện Tân Phú, Đồng Nai", "cửa hàng Tân Phú"
- Backlinks from: 10-50 business pages in the district
- Feeds authority up to province page

**Business Page:**
- Ranks for: "Cá Tươi Bà Năm", "cá tươi Tân Phú", "cá Tân Phú Đồng Nai"
- Geographic specificity ensures hyperlocal intent match

### 7.4 SEO Meta Tags by Level

**Province Page Meta:**
```html
<title>Doanh nghiệp tại Tỉnh Đồng Nai | VIO LOCAL</title>
<meta name="description" 
      content="Khám phá 1,234 doanh nghiệp, sản phẩm và dịch vụ tại Tỉnh Đồng Nai. 
               Nông sản, thủ công, dịch vụ, bất động sản được cập nhật hàng ngày.">
<meta property="og:title" content="Doanh nghiệp Tỉnh Đồng Nai - VIO LOCAL">
<meta property="og:url" content="https://violocal.vn/dong-nai/">
```

**District Page Meta:**
```html
<title>Doanh nghiệp Huyện Tân Phú, Tỉnh Đồng Nai | VIO LOCAL</title>
<meta name="description" 
      content="Tìm cửa hàng, dịch vụ, sản phẩm nông sản tại Huyện Tân Phú, Đồng Nai. 
               Quét mã QR để liên hệ trực tiếp các doanh nhân địa phương.">
```

**Business Page Meta:**
```html
<title>Cá Tươi Bà Năm - Tân Phú, Đồng Nai | VIO LOCAL</title>
<meta name="description" 
      content="Cá tươi sông Đồng Nai nuôi tự nhiên. Cá rô, cá trê, cá lóc tươi sống. 
               Ấp 3, Xã Tân Phú, Huyện Tân Phú, Đồng Nai. Gọi 0912 345 678.">
```

### 7.5 Breadcrumb Schema (Required)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "VIO LOCAL",
      "item": "https://violocal.vn"
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

---

## 8. GEOGRAPHIC INDEXING STRATEGY

### 8.1 Index Types for Geographic Queries

| Query Type | Index | Query |
|----------|--------|---------|
| Nearby businesses | GIST on `location` | `ST_DWithin(location, point, 5000)` |
| Location in boundary | GIST on `boundary` | `ST_Contains(boundary, point)` |
| Distance ordering | GiST spatial index | `<->` operator |
| Slug lookup | B-tree on `slug` | `WHERE slug = $1` |
| Hierarchy traversal | B-tree on `province_id`, `district_id` | `WHERE district_id = $1` |

### 8.2 Composite Index Strategy

```sql
-- Frequently accessed together: province + district + status
CREATE INDEX idx_businesses_geo_status
  ON businesses(province_id, district_id, status)
  WHERE deleted_at IS NULL AND status = 'published';

-- For list views: geography + sorting
CREATE INDEX idx_businesses_geo_distance
  ON businesses(location)
  WHERE deleted_at IS NULL AND status = 'published';

-- For rapid district pagination
CREATE INDEX idx_businesses_district_published
  ON businesses(district_id, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;
```

### 8.3 Covering Indexes (Include Additional Columns)

```sql
-- Covering index: includes all data needed for list view
CREATE INDEX idx_districts_list_covering
  ON districts(province_id, status)
  INCLUDE (id, name, slug, center_location)
  WHERE is_deleted = false;
```

### 8.4 Index Maintenance

```sql
-- Analyze table statistics (monthly)
ANALYZE provinces;
ANALYZE districts;
ANALYZE communes;
ANALYZE businesses;

-- Check index health
SELECT 
  schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- Unused indexes
ORDER BY idx_scan ASC;

-- Reindex if needed (rarely necessary)
REINDEX INDEX idx_businesses_location;
```

---

## 9. ADMINISTRATIVE CHANGE MANAGEMENT

### 9.1 How to Handle District Reorganization

**Scenario: Huyện X is split into two new districts**

```sql
-- Step 1: Create new district entries
INSERT INTO districts (id, code_iso, province_id, name, slug, ...)
VALUES
  (NEW_DISTRICT_ID_1, 'VN-XX-NEW1', province_id, 'Huyện Y', 'huyen-y', ...),
  (NEW_DISTRICT_ID_2, 'VN-XX-NEW2', province_id, 'Huyện Z', 'huyen-z', ...);

-- Step 2: Add geographic aliases for old district
INSERT INTO geographic_aliases (entity_type, entity_id, alias_slug, alias_name, reason, expires_at)
VALUES
  ('district', NEW_DISTRICT_ID_1, 'huyen-x', 'Huyện X (cũ)', 'split-into', 
   now() + INTERVAL '2 years'),
  ('district', NEW_DISTRICT_ID_2, 'huyen-x', 'Huyện X (cũ)', 'split-into',
   now() + INTERVAL '2 years');

-- Step 3: Migrate businesses to appropriate new districts
-- (Manual review per business, OR use geographic boundaries)
UPDATE businesses
SET district_id = NEW_DISTRICT_ID_1
WHERE district_id = OLD_DISTRICT_ID
  AND ST_Contains(
    (SELECT boundary FROM districts WHERE id = NEW_DISTRICT_ID_1),
    location
  );

-- Step 4: Update cached statistics
SELECT refresh_geographic_counts();

-- Step 5: Regenerate sitemaps (cron job handles)
-- Old /huyen-x URLs now redirect via alias to /huyen-y or /huyen-z
-- (Middleware detects alias, returns 301 redirect)
```

### 9.2 Merge Districts

**Scenario: Huyện X merges into Huyện Y**

```sql
-- Step 1: Create alias
INSERT INTO geographic_aliases (entity_type, entity_id, alias_slug, alias_name, reason)
VALUES ('district', NEW_DISTRICT_ID, 'huyen-x', 'Huyện X (hợp nhất)', 'merged-into');

-- Step 2: Migrate businesses
UPDATE businesses
SET district_id = NEW_DISTRICT_ID
WHERE district_id = OLD_DISTRICT_ID;

-- Step 3: Archive old district (soft delete or keep for history)
UPDATE districts
SET is_archived = true
WHERE id = OLD_DISTRICT_ID;

-- Step 4: Recompute stats
SELECT refresh_geographic_counts();
```

### 9.3 Rename District

**Scenario: Huyện A is renamed to Huyện B**

```sql
-- Step 1: Update the main record
UPDATE districts
SET name = 'Huyện B',
    name_with_type = 'Huyện B',
    slug = 'huyen-b',
    updated_at = now()
WHERE id = district_id;

-- Step 2: Add alias for old name (for redirects)
INSERT INTO geographic_aliases (entity_type, entity_id, alias_slug, alias_name, reason)
VALUES ('district', district_id, 'huyen-a', 'Huyện A (cũ)', 'old-name');

-- Step 3: All URLs with /huyen-a/* now 301 redirect to /huyen-b/*
-- (Middleware handles this via alias lookup)
```

### 9.4 Geographic Boundaries Update

When Vietnam redraws district boundaries:

```sql
-- Update boundary polygon
UPDATE districts
SET boundary = ST_GeomFromGeoJSON($new_boundary_geojson),
    updated_at = now()
WHERE id = $district_id;

-- Re-assign businesses that crossed the new boundary
UPDATE businesses
SET district_id = $new_district_id
WHERE ST_Contains(
  (SELECT boundary FROM districts WHERE id = $new_district_id),
  location
) AND district_id = $old_district_id;
```

---

## 10. GEOGRAPHIC CACHING STRATEGY

### 10.1 What to Cache

```
CACHE: Geographic reference data (provinces, districts, communes)
├── Reason: Stable, rarely changes
├── TTL: 1 week (on change, invalidate immediately)
└── Store in: Redis

CACHE: Nearby business results
├── Reason: Expensive query (PostGIS + sorting)
├── TTL: 1 hour (businesses move/update)
└── Store in: Redis with key like `nearby:lat:lng:radius`

CACHE: District/province statistics
├── Reason: Aggregate query (COUNT, SUM)
├── TTL: 24 hours (refreshed nightly)
└── Store in: Database (cached_stats JSONB column)

DO NOT CACHE: User's current location
├── Reason: Constantly changing
└── Compute fresh on each request
```

### 10.2 Cache Invalidation Events

```
Event: Business created/published
├── Invalidate: Nearby results for that district
├── Invalidate: District statistics cache
└── Invalidate: Sitemap cache

Event: Business moved to different district
├── Invalidate: Both old and new district caches
├── Invalidate: District statistics
└── Regenerate: Sitemaps for affected districts

Event: District/province renamed
├── Invalidate: All geographic caches
├── Invalidate: All sitemaps (URLs changed)
└── Regenerate: All 301 redirects
```

### 10.3 Cache Warming

```sql
-- On application startup, warm cache with hot locations
WITH hot_locations AS (
  SELECT 
    province_id, district_id,
    COUNT(*) as business_count
  FROM businesses
  WHERE status = 'published' AND deleted_at IS NULL
  GROUP BY province_id, district_id
  ORDER BY business_count DESC
  LIMIT 100  -- Top 100 districts
)
SELECT 
  p.name, d.name,
  -- Precompute nearby results for this district center
  (SELECT to_jsonb(array_agg(row_to_json(b.*)
   FROM businesses b
   WHERE b.district_id = d.id
   ORDER BY RANDOM() LIMIT 20)) as preview
FROM hot_locations hl
JOIN provinces p ON hl.province_id = p.id
JOIN districts d ON hl.district_id = d.id;

-- Store in Redis:
-- KEY: "district:{province_slug}:{district_slug}:preview"
-- VALUE: JSON array of 20 random businesses
```

---

## 11. GEOGRAPHIC API ENDPOINTS

These are the foundation for frontend discovery. Frontend NEVER hardcodes provinces/districts.

### 11.1 List Provinces

```
GET /api/geo/provinces
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Đồng Nai",
      "slug": "dong-nai",
      "region": "nam",
      "businessCount": 1234,
      "centerLocation": { "lat": 10.95, "lng": 107.30 },
      "bbox": { "minLat": ..., "maxLat": ..., "minLng": ..., "maxLng": ... }
    },
    ...
  ]
}
```

### 11.2 List Districts in Province

```
GET /api/geo/provinces/:provinceSlug/districts
Response:
{
  "success": true,
  "data": [
    {
      "id": 251,
      "name": "Tân Phú",
      "slug": "tan-phu",
      "type": "huyen",
      "businessCount": 45,
      "centerLocation": { "lat": 10.82, "lng": 107.19 }
    },
    ...
  ]
}
```

### 11.3 Get Single District (with hierarchy)

```
GET /api/geo/provinces/:provinceSlug/districts/:districtSlug
Response:
{
  "success": true,
  "data": {
    "province": {
      "id": 1,
      "name": "Đồng Nai",
      "slug": "dong-nai"
    },
    "district": {
      "id": 251,
      "name": "Tân Phú",
      "slug": "tan-phu",
      "businessCount": 45
    },
    "communes": [
      { "name": "Tân Phú", "slug": "xa-tan-phu" },
      { "name": "Xuân Lộc", "slug": "xuan-loc" }
    ]
  }
}
```

### 11.4 Reverse Geocode (GPS → Admin)

```
GET /api/geo/locate?lat=10.95&lng=107.30
Response:
{
  "success": true,
  "data": {
    "province": { "slug": "dong-nai", "name": "Đồng Nai" },
    "district": { "slug": "tan-phu", "name": "Tân Phú" },
    "commune": { "slug": "xa-tan-phu", "name": "Xã Tân Phú" }
  }
}
```

---

## 12. FRONTEND CONSIDERATIONS (No Hardcoding)

### 12.1 Loading Geographic Data

```typescript
// ❌ WRONG: Hardcoded provinces
const PROVINCES = [
  { id: 1, name: 'Đồng Nai', slug: 'dong-nai' },
  { id: 2, name: 'Bình Dương', slug: 'binh-duong' },
  // Hard to maintain, breaks when data changes
];

// ✅ RIGHT: Fetch from API
export async function getProvinces() {
  const res = await fetch('/api/geo/provinces');
  return res.json();
}

// Use in component
export default async function ProvinceSelector() {
  const { data: provinces } = await getProvinces();
  
  return (
    <select>
      {provinces.map(p => (
        <option key={p.id} value={p.slug}>{p.name}</option>
      ))}
    </select>
  );
}
```

### 12.2 Dynamic Routes Based on DB

```typescript
// app/[province]/[district]/page.tsx
// Route parameters must match actual DB slugs

export async function generateStaticParams() {
  // Pre-render all province/district combinations
  const res = await fetch('https://api.violocal.vn/api/geo/all-paths');
  const paths = await res.json();
  
  return paths.map(p => ({
    province: p.province_slug,
    district: p.district_slug
  }));
}
```

### 12.3 Resolve Route Params to DB Data

```typescript
export default async function DistrictPage({ params }) {
  const { province, district } = params;
  
  // Fetch from API using slugs
  const res = await fetch(
    `/api/geo/provinces/${province}/districts/${district}`
  );
  
  if (!res.ok) return notFound();
  
  const { data } = await res.json();
  
  // Now render using database data, not hardcoded assumptions
  return (
    <>
      <h1>{data.district.name} tại {data.province.name}</h1>
      {/* Render businesses in this district */}
    </>
  );
}
```

---

## 13. SITEMAP GENERATION

### 13.1 Dynamic Sitemap Strategy

Generate sitemaps on-the-fly for each geographic level:

```xml
<!-- /sitemap-provinces.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://violocal.vn/dong-nai</loc>
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
    <loc>https://violocal.vn/dong-nai/tan-phu</loc>
    <lastmod>2026-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <!-- ... ~700 districts ... -->
</urlset>

<!-- /sitemap-businesses-{province_slug}.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam</loc>
    <lastmod>2026-01-14T10:30:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
  <!-- ... businesses in Đồng Nai ... -->
</urlset>
```

### 13.2 Sitemap Index

```xml
<!-- /sitemap.xml (index) -->
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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
    <loc>https://violocal.vn/sitemap-businesses-dong-nai.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://violocal.vn/sitemap-businesses-binh-duong.xml</loc>
  </sitemap>
  <!-- ... one per province ... -->
</sitemapindex>
```

### 13.3 Generation Algorithm

```typescript
// app/api/sitemap/[type]/route.ts
export async function GET(req, { params }) {
  const { type } = params;
  
  if (type === 'provinces') {
    // Generate provinces sitemap
    const provinces = await db.query('SELECT * FROM provinces');
    return generateSitemap(provinces.map(p => ({
      url: `/` + p.slug,
      lastmod: p.updated_at,
      priority: 0.9
    })));
  }
  
  if (type.startsWith('businesses-')) {
    // Generate businesses sitemap for a specific province
    const province_slug = type.replace('businesses-', '');
    const province = await db.query('SELECT id FROM provinces WHERE slug = $1', [province_slug]);
    const businesses = await db.query(`
      SELECT b.*, d.slug, p.slug
      FROM businesses b
      JOIN districts d ON b.district_id = d.id
      JOIN provinces p ON b.province_id = p.id
      WHERE b.province_id = $1 AND b.status = 'published' AND b.deleted_at IS NULL
    `, [province.id]);
    
    return generateSitemap(businesses.map(b => ({
      url: `/${b.province_slug}/${b.district_slug}/${b.slug}`,
      lastmod: b.updated_at,
      priority: 0.5
    })));
  }
}
```

---

## 14. QUERY OPTIMIZATION RULES

### 14.1 Always Use Indexes

```sql
-- ❌ SLOW: Full scan without index
SELECT * FROM businesses
WHERE ST_Distance(location, $point) < 5000
ORDER BY location <-> $point;

-- ✅ FAST: Uses GIST index via ST_DWithin first
SELECT * FROM businesses
WHERE ST_DWithin(location, $point, 5000)
ORDER BY location <-> $point;
```

### 14.2 Denormalize for Speed

```sql
-- ✅ GOOD: Keep province_id and district_id on businesses
-- Avoids 2-way joins for geographic filters
SELECT b.* FROM businesses b
WHERE b.province_id = 1 AND b.district_id = 251;

-- ❌ BAD: Join through districts/provinces every time
SELECT b.* FROM businesses b
JOIN districts d ON b.district_id = d.id
JOIN provinces p ON d.province_id = p.id
WHERE d.slug = 'tan-phu' AND p.slug = 'dong-nai';
```

### 14.3 Limit Results Early

```sql
-- When doing nearby search + text search, apply limits early
SELECT b.*, 
  ts_rank(b.search_vector, query) as rank
FROM businesses b,
     plainto_tsquery('vietnamese', $query) as query
WHERE ST_DWithin(b.location, $user_location, 10000)  -- Geographic limit first
  AND b.search_vector @@ query                       -- Then text match
  AND b.status = 'published'
ORDER BY rank DESC, location <-> $user_location
LIMIT 20;
```

---

## 15. ANTI-PATTERNS TO AVOID

### 15.1 Hardcoding Geographic Data

```typescript
// ❌ ANTI-PATTERN: Hardcoded provinces in frontend
const PROVINCE_OPTIONS = [
  { value: 'dong-nai', label: 'Đồng Nai' },
  { value: 'binh-duong', label: 'Bình Dương' }
];

// Problem: Changes in database never reflect in UI
// Problem: Inconsistency between API and frontend
// Problem: Impossible to A/B test district names
// Problem: SEO suffers if slug changes
```

### 15.2 Separate Location Lookups

```typescript
// ❌ ANTI-PATTERN: Multiple API calls for hierarchy
const province = await fetch(`/api/provinces/${slug}`);
const districts = await fetch(`/api/districts?province=${province.id}`);
const commune = await fetch(`/api/communes?district=${district.id}`);

// Problem: N+1 queries, slow cascading
// Problem: Inconsistent data if API changes mid-request
```

### 15.3 Computing Distance in Application Layer

```typescript
// ❌ ANTI-PATTERN: Fetch all, filter in code
const all_businesses = await fetch('/api/businesses?limit=10000');
const nearby = all_businesses.filter(b => 
  distance(b.lat, b.lng, user_lat, user_lng) < 10000
);

// Problem: Fetches entire table
// Problem: O(N) computation per request
// Problem: No index utilization
```

### 15.4 Not Handling Aliases

```typescript
// ❌ ANTI-PATTERN: Strict slug matching
const district = await db.query(
  'SELECT * FROM districts WHERE slug = $1',
  [slugFromUrl]
);
// If /huyen-x (old name) is requested and district was renamed to /huyen-y
// Returns 404

// ✅ CORRECT: Check aliases
const district = await resolveGeographicAlias('district', slugFromUrl);
if (district.redirect) {
  // Return 301 redirect to new URL
}
```

---

## 16. SUMMARY TABLE

| Concept | Implementation | Notes |
|---------|---|---|
| Geographic Hierarchy | 3 levels: provinces (63), districts (~700), communes (~11,000) | GSO official codes as PKs |
| Slug Normalization | Vietnamese diacritics → ASCII via `unaccent()` + regex | Unique within scope (province/district) |
| Alias System | `geographic_aliases` table with soft history | Handles renames, merges, splits |
| SEO Routing | URLs encode location: `/{province}/{district}/{business}` | Google understands hierarchy |
| Nearby Discovery | PostGIS `ST_DWithin` + `<->` ordering | 200ms target for 20 results |
| Hyperlocal SEO | Landing pages per province/district (commune selective) | Backlink graph for authority flow |
| Caching | Geographic data: 1 week; nearby results: 1 hour | Invalidate on events |
| Indexing | GIST for PostGIS, B-tree for slugs & hierarchies | Composite indexes for common queries |
| Admin Changes | Alias system + data migration functions | Handles splits, merges, renames |
| API Strategy | All geographic data from endpoints, never hardcoded | Frontend flexibility for updates |

---

## 17. FINAL DIRECTIVES

### 17.1 The Geographic System is the Foundation

Do not build features on top of geographic assumptions. Instead:

1. **Load all geographic data from the database**
2. **Use APIs to fetch province/district lists**
3. **Resolve URLs using alias system**
4. **Index aggressively for proximity**
5. **Design for administrative change**

### 17.2 Maintain Data Integrity

```sql
-- Regularly validate geographic data
SELECT * FROM businesses
WHERE province_id IS NULL OR district_id IS NULL;

-- Check for orphaned records
SELECT * FROM businesses
WHERE province_id NOT IN (SELECT id FROM provinces);

-- Verify location data
SELECT * FROM businesses
WHERE location IS NULL AND status = 'published';
```

### 17.3 Performance is Non-Negotiable

- Nearby search: < 200ms
- Slug resolution: < 30ms
- District page load: < 1.5s

If any geographic query exceeds these, it's a bug.

---

**END OF GEO_SYSTEM.md v1.0**

*The geographic system is not a feature. It is the infrastructure that makes VIO LOCAL work. Every design decision here — from slug normalization to index strategy — is made to serve one goal: make rural Vietnamese businesses discoverable in Google, hyperlocally.*