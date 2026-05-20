# VIO LOCAL — DATABASE ARCHITECTURE
**Version 1.0 | PostgreSQL + PostGIS + Supabase**

---

## 0. ARCHITECTURE PRINCIPLES

### 0.1 Core Design Decisions

```
Database:     PostgreSQL 15+
Extensions:   PostGIS, pg_trgm, unaccent, uuid-ossp
Host:         Supabase (managed) or self-hosted PostgreSQL
Auth:         Supabase Auth (phone-based)
RLS:          Enabled on all user-owned tables
Migrations:   Supabase migration system or Prisma
```

### 0.2 Design Philosophy

**1. NORMALIZED FIRST, DENORMALIZE WHEN MEASURED**
Start with proper 3NF schema. Denormalize only when query performance demands it.

**2. GEOGRAPHIC IS FIRST-CLASS**
Every entity with a physical location uses PostGIS `geography(Point, 4326)`.

**3. SOFT DELETE FOR USER DATA**
Businesses, listings, and user content use `deleted_at` timestamps. Hard delete only for: sessions, OTPs, logs, analytics events.

**4. SLUGS ARE FIRST-CLASS IDENTIFIERS**
Every public entity has a `slug` column. Slugs are versioned (history table) to maintain SEO when renamed.

**5. RLS IS THE SECURITY BOUNDARY**
Row-level security policies enforce ownership at the database level. Application code is a convenience, not security.

**6. DISCOVERY SYSTEMS ARE REUSABLE**
Products, services, and land listings share common patterns (slugs, geography, ownership, media). Use shared tables where possible.

### 0.3 Naming Conventions

```
Tables:          snake_case, plural          (businesses, products)
Columns:         snake_case                  (created_at, business_id)
Primary keys:    id (bigserial)              ← Default for most
Public IDs:      public_id (uuid)            ← For URLs/exposed IDs
Foreign keys:    {entity}_id                 (business_id, user_id)
Indexes:         idx_{table}_{columns}       (idx_businesses_slug)
Constraints:     {table}_{columns}_{type}    (businesses_slug_unique)
Functions:       snake_case verb            (slugify, distance_km)
Triggers:        trg_{table}_{action}        (trg_businesses_updated_at)
```

### 0.4 ID Strategy

**TWO-ID PATTERN:**

```sql
-- Internal ID: fast joins, sequential
id BIGSERIAL PRIMARY KEY,

-- Public ID: URL-safe, non-enumerable
public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE
```

**WHY:**
- `id` (bigserial): Smaller, faster joins, indexed efficiently
- `public_id` (uuid): Cannot be guessed/enumerated, safe for URLs
- Slugs handle SEO; UUIDs handle direct API access

**EXCEPTIONS:**
- Reference tables (provinces, districts): only `id`, no `public_id`
- Junction tables: composite primary key, no `public_id`

---

## 1. EXTENSIONS & DATABASE SETUP

### 1.1 Required Extensions

```sql
-- Geographic queries (CRITICAL)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Fuzzy text search & similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Vietnamese accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Hash functions for short links
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 1.2 Custom Text Search Configuration

```sql
-- Vietnamese-aware text search configuration
CREATE TEXT SEARCH CONFIGURATION vietnamese (COPY = simple);

ALTER TEXT SEARCH CONFIGURATION vietnamese
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, simple;
```

### 1.3 Utility Functions

```sql
-- Slugify Vietnamese text to URL-safe slug
CREATE OR REPLACE FUNCTION slugify(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Lowercase and remove diacritics
  result := lower(unaccent(input_text));
  
  -- Replace Vietnamese 'đ' with 'd'
  result := replace(result, 'đ', 'd');
  
  -- Replace non-alphanumeric with hyphens
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  
  -- Trim leading/trailing hyphens
  result := trim(both '-' from result);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 2. GEOGRAPHIC HIERARCHY TABLES

These are **reference tables** — seeded once, rarely modified.

### 2.1 `provinces` (Tỉnh / Thành phố)

```sql
CREATE TABLE provinces (
  id              SMALLINT PRIMARY KEY,           -- GSO official code
  name            VARCHAR(100) NOT NULL,           -- "Đồng Nai"
  name_with_type  VARCHAR(150) NOT NULL,           -- "Tỉnh Đồng Nai"
  slug            VARCHAR(100) NOT NULL UNIQUE,    -- "dong-nai"
  type            VARCHAR(20) NOT NULL,            -- 'tinh' | 'thanh-pho'
  region          VARCHAR(50) NOT NULL,            -- 'bac' | 'trung' | 'nam'
  
  -- Center coordinates for map default view
  center_location GEOGRAPHY(Point, 4326) NOT NULL,
  
  -- Bounding box (for map auto-zoom)
  bbox_min_lat    DOUBLE PRECISION NOT NULL,
  bbox_min_lng    DOUBLE PRECISION NOT NULL,
  bbox_max_lat    DOUBLE PRECISION NOT NULL,
  bbox_max_lng    DOUBLE PRECISION NOT NULL,
  
  -- Polygon boundary (optional, large)
  boundary        GEOGRAPHY(MultiPolygon, 4326),
  
  -- Cached statistics (updated nightly)
  business_count  INTEGER NOT NULL DEFAULT 0,
  product_count   INTEGER NOT NULL DEFAULT 0,
  service_count   INTEGER NOT NULL DEFAULT 0,
  land_count      INTEGER NOT NULL DEFAULT 0,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provinces_slug ON provinces(slug);
CREATE INDEX idx_provinces_location ON provinces USING GIST(center_location);
CREATE INDEX idx_provinces_boundary ON provinces USING GIST(boundary);
```

**SEED DATA:** 63 provinces of Vietnam (official GSO codes).

### 2.2 `districts` (Huyện / Quận / Thị xã)

```sql
CREATE TABLE districts (
  id              INTEGER PRIMARY KEY,             -- GSO official code
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  name            VARCHAR(100) NOT NULL,           -- "Tân Phú"
  name_with_type  VARCHAR(150) NOT NULL,           -- "Huyện Tân Phú"
  slug            VARCHAR(100) NOT NULL,           -- "tan-phu"
  type            VARCHAR(20) NOT NULL,            -- 'huyen' | 'quan' | 'thi-xa' | 'thanh-pho'
  
  center_location GEOGRAPHY(Point, 4326) NOT NULL,
  bbox_min_lat    DOUBLE PRECISION NOT NULL,
  bbox_min_lng    DOUBLE PRECISION NOT NULL,
  bbox_max_lat    DOUBLE PRECISION NOT NULL,
  bbox_max_lng    DOUBLE PRECISION NOT NULL,
  boundary        GEOGRAPHY(MultiPolygon, 4326),
  
  business_count  INTEGER NOT NULL DEFAULT 0,
  product_count   INTEGER NOT NULL DEFAULT 0,
  service_count   INTEGER NOT NULL DEFAULT 0,
  land_count      INTEGER NOT NULL DEFAULT 0,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Slug unique within province (not globally)
  UNIQUE(province_id, slug)
);

CREATE INDEX idx_districts_province ON districts(province_id);
CREATE INDEX idx_districts_slug ON districts(province_id, slug);
CREATE INDEX idx_districts_location ON districts USING GIST(center_location);
CREATE INDEX idx_districts_boundary ON districts USING GIST(boundary);
```

**SEED DATA:** ~700 districts of Vietnam.

### 2.3 `communes` (Xã / Phường / Thị trấn)

```sql
CREATE TABLE communes (
  id              INTEGER PRIMARY KEY,             -- GSO official code
  district_id     INTEGER NOT NULL REFERENCES districts(id),
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),  -- denormalized
  name            VARCHAR(100) NOT NULL,           -- "Tân Phú"
  name_with_type  VARCHAR(150) NOT NULL,           -- "Xã Tân Phú"
  slug            VARCHAR(100) NOT NULL,           -- "xa-tan-phu"
  type            VARCHAR(20) NOT NULL,            -- 'xa' | 'phuong' | 'thi-tran'
  
  center_location GEOGRAPHY(Point, 4326) NOT NULL,
  boundary        GEOGRAPHY(MultiPolygon, 4326),
  
  business_count  INTEGER NOT NULL DEFAULT 0,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(district_id, slug)
);

CREATE INDEX idx_communes_district ON communes(district_id);
CREATE INDEX idx_communes_province ON communes(province_id);
CREATE INDEX idx_communes_slug ON communes(district_id, slug);
CREATE INDEX idx_communes_location ON communes USING GIST(center_location);
CREATE INDEX idx_communes_boundary ON communes USING GIST(boundary);
```

**SEED DATA:** ~11,000 communes of Vietnam.

**DENORMALIZATION NOTE:** `province_id` is duplicated here for query efficiency. This is acceptable because provinces/districts/communes are stable reference data.

### 2.5 `geographic_aliases` (SEO Synonyms)

Users search for locations using many different names. This table maps informal names to official geographic entities.

```sql
CREATE TABLE geographic_aliases (
  id              BIGSERIAL PRIMARY KEY,

  -- Which geographic entity this alias maps to
  entity_type     VARCHAR(20) NOT NULL,            -- 'province' | 'district' | 'commune'
  province_id     SMALLINT REFERENCES provinces(id),
  district_id     INTEGER REFERENCES districts(id),
  commune_id      INTEGER REFERENCES communes(id),

  -- The alias
  alias_name      VARCHAR(200) NOT NULL,           -- "SG", "Sài Gòn", "TPHCM"
  alias_slug      VARCHAR(200) NOT NULL,           -- "sai-gon", "sg", "tphcm"
  alias_type      VARCHAR(30) NOT NULL DEFAULT 'colloquial',
                  -- 'colloquial' | 'abbreviation' | 'historical' | 'misspelling' | 'postal'

  -- Language context
  language        VARCHAR(10) NOT NULL DEFAULT 'vi', -- 'vi' | 'en'

  -- Priority for autocomplete
  priority        SMALLINT NOT NULL DEFAULT 0,      -- Higher = shown first

  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT geo_alias_entity_check CHECK (
    (entity_type = 'province' AND province_id IS NOT NULL) OR
    (entity_type = 'district' AND district_id IS NOT NULL) OR
    (entity_type = 'commune' AND commune_id IS NOT NULL)
  )
);

CREATE INDEX idx_geo_aliases_slug ON geographic_aliases(alias_slug) WHERE is_active;
CREATE INDEX idx_geo_aliases_name ON geographic_aliases USING GIN(alias_name gin_trgm_ops);
CREATE INDEX idx_geo_aliases_province ON geographic_aliases(province_id) WHERE province_id IS NOT NULL;
CREATE INDEX idx_geo_aliases_district ON geographic_aliases(district_id) WHERE district_id IS NOT NULL;
```

**SEED DATA EXAMPLES:**

| alias_name | alias_slug | entity_type | maps_to | alias_type |
|------------|-----------|-------------|---------|------------|
| Sài Gòn | sai-gon | province | Hồ Chí Minh (id: 79) | historical |
| TPHCM | tphcm | province | Hồ Chí Minh (id: 79) | abbreviation |
| Đà Lạt | da-lat | district | TP Đà Lạt (id: 672) | colloquial |
| Phố Núi | pho-nui | province | Gia Lai (id: 64) | colloquial |

### 2.4 Geographic Hierarchy Query Pattern

```sql
-- Get full hierarchy for an address
SELECT 
  p.name AS province,
  p.slug AS province_slug,
  d.name AS district,
  d.slug AS district_slug,
  c.name AS commune,
  c.slug AS commune_slug
FROM communes c
JOIN districts d ON d.id = c.district_id
JOIN provinces p ON p.id = d.province_id
WHERE c.id = $1;
```

---

## 3. USER & AUTHENTICATION

### 3.1 `users`

```sql
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Phone is primary identity (Vietnamese format)
  phone           VARCHAR(20) NOT NULL UNIQUE,     -- "+84912345678"
  phone_verified  BOOLEAN NOT NULL DEFAULT false,
  
  -- Optional profile data
  display_name    VARCHAR(100),
  avatar_url      TEXT,
  
  -- Role-based access
  role            VARCHAR(20) NOT NULL DEFAULT 'owner',  -- 'owner' | 'admin' | 'moderator'
  
  -- Metadata
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'vi',
  timezone        VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  
  -- Tracking
  last_login_at   TIMESTAMPTZ,
  last_active_at  TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at      TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT users_phone_format CHECK (phone ~ '^\+84[0-9]{9,10}$')
);

CREATE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_public_id ON users(public_id);
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 3.2 `user_roles` (RBAC)

Separate table for fine-grained role management. The `users.role` column is the quick-access default; this table supports future multi-role and permission expansion.

```sql
CREATE TABLE user_roles (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role            VARCHAR(30) NOT NULL,             -- 'owner' | 'admin' | 'moderator' | 'support'

  -- Scoped permissions (optional — NULL = global)
  scope_type      VARCHAR(20),                      -- 'province' | 'district' | NULL (global)
  scope_id        INTEGER,                          -- province_id or district_id

  -- Audit
  granted_by      BIGINT REFERENCES users(id),
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A user cannot have the same role+scope twice
  UNIQUE(user_id, role, scope_type, scope_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_roles_role ON user_roles(role) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_roles_scope ON user_roles(scope_type, scope_id)
  WHERE revoked_at IS NULL AND scope_type IS NOT NULL;
```

**DESIGN NOTE:** `users.role` remains the fast path for RLS checks. `user_roles` is the source of truth for admin panels and audit trails. Keep them in sync via application logic.

### 3.3 `otp_codes` (SMS Verification)

```sql
CREATE TABLE otp_codes (
  id              BIGSERIAL PRIMARY KEY,
  phone           VARCHAR(20) NOT NULL,
  code_hash       VARCHAR(255) NOT NULL,          -- bcrypt hashed
  purpose         VARCHAR(50) NOT NULL,           -- 'login' | 'phone_change'
  
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 5,
  
  ip_address      INET,
  user_agent      TEXT,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_phone ON otp_codes(phone, created_at DESC);
CREATE INDEX idx_otp_codes_cleanup ON otp_codes(expires_at);
```

**RETENTION:** Auto-delete expired OTPs daily via cron job.

### 3.3 `sessions` (Refresh Tokens)

```sql
CREATE TABLE sessions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  
  device_info     JSONB,                          -- {ua, platform, ...}
  ip_address      INET,
  
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  
  last_used_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_token ON sessions(refresh_token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_cleanup ON sessions(expires_at);
```

---

## 4. CATEGORY SYSTEM (Shared Across Listings)

### 4.1 `category_groups`

```sql
CREATE TABLE category_groups (
  id              SMALLINT PRIMARY KEY,
  slug            VARCHAR(50) NOT NULL UNIQUE,    -- "nong-nghiep"
  name            VARCHAR(100) NOT NULL,           -- "Nông nghiệp"
  description     TEXT,
  icon            VARCHAR(50),                     -- "wheat", "fish"
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  
  -- Which listing types use this category group
  applies_to      VARCHAR(20)[] NOT NULL,          -- {'business','product','service','land'}
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_category_groups_applies ON category_groups USING GIN(applies_to);
```

**SEED DATA:** ~10 top-level groups (Agriculture, Handicrafts, Services, Food, Real Estate, etc.)

### 4.2 `categories`

```sql
CREATE TABLE categories (
  id              INTEGER PRIMARY KEY,
  group_id        SMALLINT NOT NULL REFERENCES category_groups(id),
  slug            VARCHAR(50) NOT NULL,            -- "ca-tuoi"
  name            VARCHAR(100) NOT NULL,           -- "Cá tươi"
  description     TEXT,
  icon            VARCHAR(50),
  
  -- Synonyms for search (Vietnamese terms users might use)
  search_aliases  TEXT[],                          -- {'cá nước ngọt', 'cá đồng', ...}
  
  -- Which listing types apply
  applies_to      VARCHAR(20)[] NOT NULL,
  
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(group_id, slug)
);

CREATE INDEX idx_categories_group ON categories(group_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_applies ON categories USING GIN(applies_to);
CREATE INDEX idx_categories_aliases ON categories USING GIN(search_aliases);
```

**SEED DATA:** ~150 categories covering rural Vietnamese commerce.

---

## 5. STOREFRONT (BUSINESS) SYSTEM

### 5.1 `businesses` (Aggregate Root)

```sql
CREATE TABLE businesses (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Ownership
  owner_id        BIGINT NOT NULL REFERENCES users(id),
  
  -- Identity
  name            VARCHAR(200) NOT NULL,           -- "Cá Tươi Bà Năm"
  slug            VARCHAR(100) NOT NULL,           -- "ca-tuoi-ba-nam"
  
  -- Classification
  category_id     INTEGER NOT NULL REFERENCES categories(id),
  
  -- Description
  tagline         VARCHAR(200),                    -- Short pitch
  description     TEXT,                            -- Full about
  
  -- Geographic (denormalized for query speed)
  location        GEOGRAPHY(Point, 4326) NOT NULL,
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  district_id     INTEGER NOT NULL REFERENCES districts(id),
  commune_id      INTEGER REFERENCES communes(id),
  
  -- Full address details
  village         VARCHAR(100),                    -- "Ấp 3"
  street_address  TEXT,                            -- "Đường Tỉnh Lộ 2, số 123"
  formatted_address TEXT NOT NULL,                 -- Display version
  
  -- Contact methods (JSONB for flexibility)
  contacts        JSONB NOT NULL DEFAULT '{}',
  /* Example:
  {
    "phone": "+84912345678",
    "phone_alt": "+84987654321",
    "zalo": "+84912345678",
    "facebook": "https://facebook.com/cabanam",
    "facebook_messenger": "https://m.me/cabanam",
    "email": "ca@example.com",
    "website": "https://example.com"
  }
  */
  
  -- Operating hours (JSONB)
  hours           JSONB NOT NULL DEFAULT '{}',
  /* Example:
  {
    "mon": {"open": "06:00", "close": "18:00"},
    "tue": {"open": "06:00", "close": "18:00"},
    "wed": null,                                   ← closed
    ...
    "special_dates": [
      {"date": "2026-02-10", "open": null, "note": "Tết"}
    ]
  }
  */
  
  -- Media references (separate table for multiple)
  hero_image_id   BIGINT,                          -- FK to media (set after creation)
  
  -- Status
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
                  -- 'draft' | 'published' | 'suspended'
  
  -- Verification (Phase 7+)
  verified_at     TIMESTAMPTZ,
  verified_by     BIGINT REFERENCES users(id),
  
  -- SEO metadata overrides (optional)
  seo_title       VARCHAR(200),                    -- Override default <title>
  seo_description VARCHAR(500),                    -- Override meta description
  
  -- Search optimization
  search_vector   TSVECTOR,                        -- Generated column
  
  -- Cached stats
  view_count      INTEGER NOT NULL DEFAULT 0,
  contact_count   INTEGER NOT NULL DEFAULT 0,      -- Total contact clicks
  
  -- Audit
  published_at    TIMESTAMPTZ,
  last_updated_by BIGINT REFERENCES users(id),
  deleted_at      TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT businesses_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT businesses_status_check CHECK (status IN ('draft', 'published', 'suspended')),
  
  -- Slug unique within district (allows same name in different districts)
  UNIQUE(district_id, slug)
);

-- Indexes
CREATE INDEX idx_businesses_owner ON businesses(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_public_id ON businesses(public_id);
CREATE INDEX idx_businesses_slug ON businesses(district_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_status ON businesses(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_category ON businesses(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_location ON businesses USING GIST(location) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_province ON businesses(province_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_district ON businesses(district_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_commune ON businesses(commune_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_search ON businesses USING GIN(search_vector);
CREATE INDEX idx_businesses_published ON businesses(published_at DESC NULLS LAST) 
  WHERE status = 'published' AND deleted_at IS NULL;

-- Auto-update search vector
CREATE OR REPLACE FUNCTION businesses_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.tagline, ''))), 'B') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.description, ''))), 'C') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.formatted_address, ''))), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_businesses_search
  BEFORE INSERT OR UPDATE OF name, tagline, description, formatted_address
  ON businesses
  FOR EACH ROW EXECUTE FUNCTION businesses_search_trigger();

CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 5.2 `business_hours` (Optional: structured alternative to JSONB)

For Phase 1, store hours in `businesses.hours` JSONB. Migrate to dedicated table if querying by hours becomes common.

```sql
-- DEFER: Only create if "open now" queries become slow
-- For now, parse JSONB in application layer
```

---

## 6. SLUG SYSTEM (Critical for SEO)

### 6.1 Slug Strategy

**RULES:**
1. Slugs are unique within their scope (district for businesses, business for products)
2. Slugs are immutable in URL once published (use history table for renames)
3. Vietnamese characters are normalized to ASCII (`đ` → `d`, `ơ` → `o`)
4. Maximum length: 100 characters
5. Format: lowercase alphanumeric + hyphens only

**SCOPE TABLE:**

| Entity   | Slug Scope        | Example URL                                          |
|----------|-------------------|------------------------------------------------------|
| Province | Global            | `/dong-nai`                                          |
| District | Within province   | `/dong-nai/tan-phu`                                  |
| Commune  | Within district   | `/dong-nai/tan-phu/xa-tan-phu`                       |
| Business | Within district   | `/dong-nai/tan-phu/ca-tuoi-ba-nam`                   |
| Product  | Within business   | `/dong-nai/tan-phu/ca-tuoi-ba-nam/p/ca-ro-dong`      |
| Service  | Within business   | `/dong-nai/tan-phu/ca-tuoi-ba-nam/s/giao-hang`       |
| Land     | Within district   | `/dong-nai/tan-phu/dat/ruong-1000m2-can-ban`         |

### 6.2 `slug_history` (Redirect Maintenance)

```sql
CREATE TABLE slug_history (
  id              BIGSERIAL PRIMARY KEY,
  
  -- What kind of entity
  entity_type     VARCHAR(20) NOT NULL,           -- 'business' | 'product' | 'service' | 'land'
  entity_id       BIGINT NOT NULL,
  
  -- Old slug (full path for clarity)
  old_slug        VARCHAR(100) NOT NULL,
  old_full_path   TEXT NOT NULL,                   -- "/dong-nai/tan-phu/ca-tuoi-ba-nam"
  
  -- New target
  new_full_path   TEXT NOT NULL,
  
  -- Redirect type
  redirect_type   SMALLINT NOT NULL DEFAULT 301,  -- HTTP status code
  
  -- Auto-expire old redirects after N days
  expires_at      TIMESTAMPTZ,                     -- NULL = permanent
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slug_history_old_path ON slug_history(old_full_path) 
  WHERE expires_at IS NULL OR expires_at > now();
CREATE INDEX idx_slug_history_entity ON slug_history(entity_type, entity_id);
```

**USAGE:**
- When a business renames, insert old slug into `slug_history`
- Next.js middleware checks this table for 301 redirects
- Maintains SEO authority through renames

### 6.3 `reserved_slugs`

```sql
CREATE TABLE reserved_slugs (
  slug            VARCHAR(50) PRIMARY KEY,
  reason          VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with reserved words
INSERT INTO reserved_slugs (slug, reason) VALUES
  ('api', 'system'),
  ('admin', 'system'),
  ('dashboard', 'system'),
  ('auth', 'system'),
  ('login', 'system'),
  ('search', 'system'),
  ('danh-muc', 'category-prefix'),
  ('khu-vuc', 'location-prefix'),
  ('san-pham', 'product-prefix'),
  ('dich-vu', 'service-prefix'),
  ('bat-dong-san', 'land-prefix');
```

### 6.4 Slug Generation Logic (Application Layer)

```sql
-- Helper function for slug uniqueness check
CREATE OR REPLACE FUNCTION ensure_unique_business_slug(
  base_slug TEXT,
  target_district_id INTEGER
) RETURNS TEXT AS $$
DECLARE
  candidate TEXT := base_slug;
  counter INTEGER := 2;
BEGIN
  WHILE EXISTS (
    SELECT 1 FROM businesses 
    WHERE district_id = target_district_id 
    AND slug = candidate
    AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM reserved_slugs WHERE slug = candidate
  ) LOOP
    candidate := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;
```

---

## 7. PRODUCT LISTINGS

Products belong to a business. They represent goods for sale.

### 7.1 `products`

```sql
CREATE TABLE products (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Ownership
  business_id     BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Identity
  name            VARCHAR(200) NOT NULL,           -- "Cá rô đồng"
  slug            VARCHAR(100) NOT NULL,
  
  -- Classification
  category_id     INTEGER NOT NULL REFERENCES categories(id),
  
  -- Description
  short_description VARCHAR(300),
  description     TEXT,
  
  -- Pricing (flexible — many rural products have variable prices)
  price_type      VARCHAR(20) NOT NULL DEFAULT 'contact',
                  -- 'fixed' | 'range' | 'starting_at' | 'contact' | 'negotiable'
  price_amount    DECIMAL(15, 2),                  -- For 'fixed'
  price_min       DECIMAL(15, 2),                  -- For 'range', 'starting_at'
  price_max       DECIMAL(15, 2),                  -- For 'range'
  price_unit      VARCHAR(20),                     -- 'kg', 'cái', 'bộ', 'hộp'
  price_currency  VARCHAR(3) NOT NULL DEFAULT 'VND',
  
  -- Availability
  availability    VARCHAR(20) NOT NULL DEFAULT 'available',
                  -- 'available' | 'limited' | 'seasonal' | 'pre_order' | 'sold_out'
  
  -- Seasonal indicators (for agricultural products)
  is_seasonal     BOOLEAN NOT NULL DEFAULT false,
  season_start    SMALLINT,                        -- Month 1-12
  season_end      SMALLINT,                        -- Month 1-12
  
  -- Quantity (optional, for inventory hints)
  quantity_hint   VARCHAR(100),                    -- "Còn 50kg" (free text)
  
  -- Geographic (denormalized from business)
  location        GEOGRAPHY(Point, 4326),
  province_id     SMALLINT REFERENCES provinces(id),
  district_id     INTEGER REFERENCES districts(id),
  
  -- Media
  hero_image_id   BIGINT,                          -- FK to media
  
  -- Status
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
                  -- 'draft' | 'published' | 'archived'
  
  -- SEO
  seo_title       VARCHAR(200),
  seo_description VARCHAR(500),
  
  -- Search
  search_vector   TSVECTOR,
  
  -- Stats
  view_count      INTEGER NOT NULL DEFAULT 0,
  contact_count   INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  published_at    TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT products_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT products_price_type_check CHECK (
    price_type IN ('fixed', 'range', 'starting_at', 'contact', 'negotiable')
  ),
  CONSTRAINT products_season_check CHECK (
    (season_start IS NULL AND season_end IS NULL) OR
    (season_start BETWEEN 1 AND 12 AND season_end BETWEEN 1 AND 12)
  ),
  
  -- Slug unique within business
  UNIQUE(business_id, slug)
);

-- Indexes
CREATE INDEX idx_products_business ON products(business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_public_id ON products(public_id);
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_location ON products USING GIST(location) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_province ON products(province_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_district ON products(district_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_availability ON products(availability) 
  WHERE status = 'published' AND deleted_at IS NULL;

-- Search vector trigger
CREATE OR REPLACE FUNCTION products_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.short_description, ''))), 'B') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.description, ''))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search
  BEFORE INSERT OR UPDATE OF name, short_description, description
  ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_trigger();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 7.2 Geographic Denormalization Sync

When a business location changes, its products must update:

```sql
CREATE OR REPLACE FUNCTION sync_product_geography()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.location IS DISTINCT FROM OLD.location) OR
     (NEW.province_id IS DISTINCT FROM OLD.province_id) OR
     (NEW.district_id IS DISTINCT FROM OLD.district_id) THEN
    
    UPDATE products
    SET location = NEW.location,
        province_id = NEW.province_id,
        district_id = NEW.district_id
    WHERE business_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_businesses_sync_products
  AFTER UPDATE OF location, province_id, district_id ON businesses
  FOR EACH ROW EXECUTE FUNCTION sync_product_geography();
```

---

## 8. SERVICE LISTINGS

Services are offerings without physical goods (electrician, welding, repair, etc.).

### 8.1 `services`

```sql
CREATE TABLE services (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Ownership
  business_id     BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Identity
  name            VARCHAR(200) NOT NULL,           -- "Sửa xe máy tận nơi"
  slug            VARCHAR(100) NOT NULL,
  
  -- Classification
  category_id     INTEGER NOT NULL REFERENCES categories(id),
  
  -- Description
  short_description VARCHAR(300),
  description     TEXT,
  
  -- Pricing
  price_type      VARCHAR(20) NOT NULL DEFAULT 'contact',
                  -- 'fixed' | 'range' | 'starting_at' | 'hourly' | 'contact'
  price_amount    DECIMAL(15, 2),
  price_min       DECIMAL(15, 2),
  price_max       DECIMAL(15, 2),
  price_unit      VARCHAR(20),                     -- 'giờ', 'lần', 'mét', 'm²'
  price_currency  VARCHAR(3) NOT NULL DEFAULT 'VND',
  
  -- Service-specific fields
  service_area    VARCHAR(50) NOT NULL DEFAULT 'commune',
                  -- 'commune' | 'district' | 'province' | 'regional' | 'national'
  
  -- Mobile service (provider comes to customer)
  is_mobile       BOOLEAN NOT NULL DEFAULT false,
  travel_radius_km SMALLINT,                       -- How far they'll travel
  
  -- Time to deliver
  duration_estimate VARCHAR(100),                  -- "1-2 giờ", "Trong ngày"
  
  -- Availability
  availability    VARCHAR(20) NOT NULL DEFAULT 'available',
                  -- 'available' | 'busy' | 'unavailable'
  
  -- Geographic (where the service is based)
  location        GEOGRAPHY(Point, 4326),
  province_id     SMALLINT REFERENCES provinces(id),
  district_id     INTEGER REFERENCES districts(id),
  
  -- Service coverage polygon (optional, for showing on map)
  service_polygon GEOGRAPHY(Polygon, 4326),
  
  -- Media
  hero_image_id   BIGINT,
  
  -- Status
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  
  -- SEO
  seo_title       VARCHAR(200),
  seo_description VARCHAR(500),
  
  -- Search
  search_vector   TSVECTOR,
  
  -- Stats
  view_count      INTEGER NOT NULL DEFAULT 0,
  contact_count   INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  published_at    TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT services_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  
  UNIQUE(business_id, slug)
);

CREATE INDEX idx_services_business ON services(business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_public_id ON services(public_id);
CREATE INDEX idx_services_category ON services(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_status ON services(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_location ON services USING GIST(location) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_coverage ON services USING GIST(service_polygon) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_search ON services USING GIN(search_vector);

CREATE OR REPLACE FUNCTION services_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.short_description, ''))), 'B') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.description, ''))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_services_search
  BEFORE INSERT OR UPDATE OF name, short_description, description
  ON services
  FOR EACH ROW EXECUTE FUNCTION services_search_trigger();

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 9. LAND LISTINGS

Land listings are unique: they may or may not belong to a business owner, and have land-specific attributes.

### 9.1 `land_listings`

```sql
CREATE TABLE land_listings (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Ownership (always to a user; business is optional)
  owner_id        BIGINT NOT NULL REFERENCES users(id),
  business_id     BIGINT REFERENCES businesses(id) ON DELETE SET NULL,
  
  -- Identity
  title           VARCHAR(300) NOT NULL,           -- "Đất ruộng 1000m² gần đường lớn"
  slug            VARCHAR(100) NOT NULL,
  
  -- Listing type
  listing_type    VARCHAR(20) NOT NULL,
                  -- 'sale' | 'rent' | 'lease' | 'partnership'
  
  -- Land classification
  land_type       VARCHAR(30) NOT NULL,
                  -- 'agricultural' | 'residential' | 'commercial' | 'industrial'
                  -- 'forestry' | 'aquaculture' | 'mixed'
  
  -- Subcategory (specific type)
  category_id     INTEGER REFERENCES categories(id),
  
  -- Description
  description     TEXT,
  
  -- Land details
  area_m2         DECIMAL(15, 2) NOT NULL,         -- Total area in m²
  width_m         DECIMAL(8, 2),                   -- Frontage
  length_m        DECIMAL(8, 2),                   -- Depth
  
  -- Legal status
  legal_status    VARCHAR(50),
                  -- 'red_book' (sổ đỏ) | 'pink_book' (sổ hồng)
                  -- 'paper_contract' (giấy tay) | 'pending' | 'unclear'
  
  -- Pricing
  price_type      VARCHAR(20) NOT NULL DEFAULT 'fixed',
                  -- 'fixed' | 'per_m2' | 'negotiable' | 'contact'
  price_amount    DECIMAL(18, 2),                  -- Total or per-unit
  price_min       DECIMAL(18, 2),
  price_max       DECIMAL(18, 2),
  price_currency  VARCHAR(3) NOT NULL DEFAULT 'VND',
  
  -- Rental specific
  rent_period     VARCHAR(20),                     -- 'month' | 'year' | 'season'
  
  -- Geographic (CRITICAL for land — exact location matters)
  location        GEOGRAPHY(Point, 4326) NOT NULL,
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  district_id     INTEGER NOT NULL REFERENCES districts(id),
  commune_id      INTEGER REFERENCES communes(id),
  
  -- Address
  street_address  TEXT,
  formatted_address TEXT NOT NULL,
  
  -- Land polygon (boundary on map, optional but valuable)
  boundary        GEOGRAPHY(Polygon, 4326),
  
  -- Features (JSONB for flexibility)
  features        JSONB NOT NULL DEFAULT '{}',
  /* Example:
  {
    "has_road_access": true,
    "road_width_m": 4,
    "water_source": "river_nearby",
    "electricity": true,
    "soil_type": "alluvial",
    "previous_crops": ["rice", "vegetables"],
    "distance_to_market_km": 3,
    "near_features": ["main_road", "school", "market"]
  }
  */
  
  -- Status
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
                  -- 'draft' | 'published' | 'pending_sale' | 'sold' | 'expired'
  
  -- Listing expiry
  expires_at      TIMESTAMPTZ,                     -- Auto-archive after this
  
  -- Media
  hero_image_id   BIGINT,
  
  -- SEO
  seo_title       VARCHAR(200),
  seo_description VARCHAR(500),
  
  -- Search
  search_vector   TSVECTOR,
  
  -- Stats
  view_count      INTEGER NOT NULL DEFAULT 0,
  contact_count   INTEGER NOT NULL DEFAULT 0,
  
  -- Audit
  published_at    TIMESTAMPTZ,
  sold_at         TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT land_listings_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT land_listings_area_positive CHECK (area_m2 > 0),
  CONSTRAINT land_listings_type_check CHECK (
    listing_type IN ('sale', 'rent', 'lease', 'partnership')
  ),
  
  -- Land slug unique within district
  UNIQUE(district_id, slug)
);

CREATE INDEX idx_land_owner ON land_listings(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_business ON land_listings(business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_public_id ON land_listings(public_id);
CREATE INDEX idx_land_status ON land_listings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_type ON land_listings(land_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_listing_type ON land_listings(listing_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_location ON land_listings USING GIST(location) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_boundary ON land_listings USING GIST(boundary) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_province ON land_listings(province_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_district ON land_listings(district_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_area ON land_listings(area_m2) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_price ON land_listings(price_amount) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_search ON land_listings USING GIN(search_vector);
CREATE INDEX idx_land_features ON land_listings USING GIN(features);

CREATE OR REPLACE FUNCTION land_search_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.title, ''))), 'A') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.description, ''))), 'B') ||
    setweight(to_tsvector('vietnamese', unaccent(coalesce(NEW.formatted_address, ''))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_land_search
  BEFORE INSERT OR UPDATE OF title, description, formatted_address
  ON land_listings
  FOR EACH ROW EXECUTE FUNCTION land_search_trigger();

CREATE TRIGGER trg_land_updated_at
  BEFORE UPDATE ON land_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 10. MEDIA SYSTEM (Shared)

All listing types reference media through a unified table.

### 10.1 `media`

```sql
CREATE TABLE media (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Polymorphic ownership
  entity_type     VARCHAR(20) NOT NULL,
                  -- 'business' | 'product' | 'service' | 'land'
  entity_id       BIGINT NOT NULL,
  
  -- File information
  file_type       VARCHAR(20) NOT NULL,            -- 'image' | 'document' | 'video'
  mime_type       VARCHAR(50) NOT NULL,
  
  -- Storage references (CDN URLs)
  original_url    TEXT NOT NULL,
  thumbnail_url   TEXT,                            -- 300px
  medium_url      TEXT,                            -- 600px
  large_url       TEXT,                            -- 1200px
  
  -- Image metadata
  width           INTEGER,
  height          INTEGER,
  file_size_bytes INTEGER,
  
  -- Display
  alt_text        VARCHAR(300),                    -- Vietnamese, for SEO
  caption         VARCHAR(500),
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  
  -- Upload metadata
  uploaded_by     BIGINT NOT NULL REFERENCES users(id),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT media_entity_type_check CHECK (
    entity_type IN ('business', 'product', 'service', 'land')
  )
);

CREATE INDEX idx_media_entity ON media(entity_type, entity_id, sort_order);
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by);
CREATE INDEX idx_media_public_id ON media(public_id);
```

**WHY POLYMORPHIC:**
- Single upload pipeline
- Reusable across listing types
- Same auth/permission logic
- Storage cost optimization

**ALTERNATIVE CONSIDERED:** Separate `business_media`, `product_media`, etc. tables. Rejected for the upload pipeline. However, dedicated **image tables** (below) provide type-safe FK access for listing pages while media remains the storage backbone.

### 10.2 `product_images`

```sql
CREATE TABLE product_images (
  id              BIGSERIAL PRIMARY KEY,
  product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id        BIGINT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  is_hero         BOOLEAN NOT NULL DEFAULT false,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, media_id)
);

CREATE INDEX idx_product_images_product ON product_images(product_id, sort_order);
CREATE INDEX idx_product_images_hero ON product_images(product_id) WHERE is_hero;
```

### 10.3 `service_images`

```sql
CREATE TABLE service_images (
  id              BIGSERIAL PRIMARY KEY,
  service_id      BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  media_id        BIGINT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  is_hero         BOOLEAN NOT NULL DEFAULT false,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, media_id)
);

CREATE INDEX idx_service_images_service ON service_images(service_id, sort_order);
CREATE INDEX idx_service_images_hero ON service_images(service_id) WHERE is_hero;
```

### 10.4 `land_listing_images`

```sql
CREATE TABLE land_listing_images (
  id              BIGSERIAL PRIMARY KEY,
  land_listing_id BIGINT NOT NULL REFERENCES land_listings(id) ON DELETE CASCADE,
  media_id        BIGINT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  is_hero         BOOLEAN NOT NULL DEFAULT false,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(land_listing_id, media_id)
);

CREATE INDEX idx_land_images_listing ON land_listing_images(land_listing_id, sort_order);
CREATE INDEX idx_land_images_hero ON land_listing_images(land_listing_id) WHERE is_hero;
```

**WHY BOTH PATTERNS:** `media` is the storage/upload backbone (polymorphic, single pipeline). The `*_images` tables are type-safe junction tables that provide clean FK-based queries for listing pages without CASE statements on `entity_type`.

---

## 11. DISCOVERY & ANALYTICS TABLES

Reusable across all listing types.

### 11.1 `views_log` (Aggregated, NOT per-view)

```sql
-- Daily aggregation, not per-event logging
CREATE TABLE views_daily (
  id              BIGSERIAL PRIMARY KEY,
  
  entity_type     VARCHAR(20) NOT NULL,
  entity_id       BIGINT NOT NULL,
  
  date            DATE NOT NULL,
  view_count      INTEGER NOT NULL DEFAULT 0,
  unique_count    INTEGER NOT NULL DEFAULT 0,      -- Approximate
  
  -- Geographic source (where viewers came from)
  views_by_province JSONB NOT NULL DEFAULT '{}',
  /* Example:
  {
    "1": 45,    ← province_id: count
    "2": 12,
    ...
  }
  */
  
  -- Referrer source
  views_by_source JSONB NOT NULL DEFAULT '{}',
  /* Example:
  {
    "google": 67,
    "facebook": 23,
    "direct": 41,
    "zalo": 8
  }
  */
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(entity_type, entity_id, date)
);

CREATE INDEX idx_views_entity_date ON views_daily(entity_type, entity_id, date DESC);
CREATE INDEX idx_views_date ON views_daily(date DESC);
```

**WHY DAILY AGGREGATION:**
- Per-view logging at scale = billions of rows
- Aggregated data answers 99% of analytics questions
- Cheaper storage, faster queries

### 11.2 `contact_events` (Sparse, valuable)

```sql
-- Contact clicks are rare enough to log individually
CREATE TABLE contact_events (
  id              BIGSERIAL PRIMARY KEY,
  
  entity_type     VARCHAR(20) NOT NULL,
  entity_id       BIGINT NOT NULL,
  
  contact_method  VARCHAR(20) NOT NULL,            -- 'phone' | 'zalo' | 'facebook' | 'directions'
  
  -- Anonymized tracking
  session_hash    VARCHAR(64),                     -- Hashed session for unique counting
  referrer_domain VARCHAR(100),                    -- 'google.com', 'facebook.com'
  
  -- Geographic context (where viewer was)
  viewer_province_id SMALLINT REFERENCES provinces(id),
  
  -- User agent classification
  device_type     VARCHAR(20),                     -- 'mobile' | 'tablet' | 'desktop'
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_events_entity ON contact_events(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_contact_events_date ON contact_events(created_at DESC);
CREATE INDEX idx_contact_events_method ON contact_events(contact_method);
```

**RETENTION POLICY:** Keep 90 days, then aggregate to daily summaries.

### 11.3 `search_log` (Anonymized)

```sql
CREATE TABLE search_log (
  id              BIGSERIAL PRIMARY KEY,
  
  query           TEXT NOT NULL,
  normalized_query TEXT NOT NULL,                  -- After unaccent/lowercase
  
  -- Filters applied
  category_id     INTEGER REFERENCES categories(id),
  entity_filter   VARCHAR(20),                     -- 'all' | 'business' | 'product' | 'service' | 'land'
  
  -- Geographic context
  search_lat      DOUBLE PRECISION,
  search_lng      DOUBLE PRECISION,
  search_radius_km SMALLINT,
  
  -- Results
  result_count    INTEGER NOT NULL,
  clicked_result_id BIGINT,                        -- First click (if any)
  clicked_entity_type VARCHAR(20),
  
  session_hash    VARCHAR(64),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_log_query ON search_log USING GIN(normalized_query gin_trgm_ops);
CREATE INDEX idx_search_log_date ON search_log(created_at DESC);
CREATE INDEX idx_search_log_zero_results ON search_log(normalized_query) WHERE result_count = 0;
```

**USE CASES:**
- Identify common search terms (autocomplete suggestions)
- Find zero-result queries (content gaps)
- Improve search relevance over time

### 11.4 `short_links`

```sql
CREATE TABLE short_links (
  id              BIGSERIAL PRIMARY KEY,
  
  code            VARCHAR(10) NOT NULL UNIQUE,    -- "ABC1234"
  
  -- Target
  target_url      TEXT NOT NULL,
  entity_type     VARCHAR(20),
  entity_id       BIGINT,
  
  -- Source attribution
  source          VARCHAR(50),                     -- 'qr', 'print', 'social', 'sms'
  
  -- Stats
  click_count     INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  
  -- Lifecycle
  expires_at      TIMESTAMPTZ,                     -- NULL = permanent
  
  created_by      BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_short_links_code ON short_links(code);
CREATE INDEX idx_short_links_entity ON short_links(entity_type, entity_id);
```

---

## 12. CACHED COUNTS & SUMMARIES

### 12.1 Why Cached Counts

Counting on every page load is expensive. We pre-compute counts and refresh nightly.

### 12.2 Refresh Strategy

```sql
-- Run nightly via cron
CREATE OR REPLACE FUNCTION refresh_geographic_counts()
RETURNS VOID AS $$
BEGIN
  -- Province counts
  UPDATE provinces p SET
    business_count = (
      SELECT COUNT(*) FROM businesses 
      WHERE province_id = p.id 
      AND status = 'published' 
      AND deleted_at IS NULL
    ),
    product_count = (
      SELECT COUNT(*) FROM products 
      WHERE province_id = p.id 
      AND status = 'published' 
      AND deleted_at IS NULL
    ),
    service_count = (
      SELECT COUNT(*) FROM services 
      WHERE province_id = p.id 
      AND status = 'published' 
      AND deleted_at IS NULL
    ),
    land_count = (
      SELECT COUNT(*) FROM land_listings 
      WHERE province_id = p.id 
      AND status = 'published' 
      AND deleted_at IS NULL
    ),
    updated_at = now();
  
  -- District counts (similar)
  UPDATE districts d SET
    business_count = (
      SELECT COUNT(*) FROM businesses 
      WHERE district_id = d.id 
      AND status = 'published' 
      AND deleted_at IS NULL
    ),
    -- ... similar for product, service, land
    updated_at = now();
  
  -- Commune counts (similar)
  UPDATE communes c SET
    business_count = (
      SELECT COUNT(*) FROM businesses 
      WHERE commune_id = c.id 
      AND status = 'published' 
      AND deleted_at IS NULL
    ),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
```

---

## 13. ROW-LEVEL SECURITY (RLS) STRATEGY

Supabase enforces auth via PostgreSQL RLS. Every user-owned table has policies.

### 13.1 RLS Principles

**RULE 1:** Public read for `status = 'published'` content  
**RULE 2:** Owners can read/write their own content  
**RULE 3:** Admins/moderators have elevated permissions  
**RULE 4:** Deleted content (`deleted_at IS NOT NULL`) is invisible

### 13.2 Auth Helper Functions

```sql
-- Get current user's ID from Supabase auth.uid()
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS BIGINT AS $$
  SELECT id FROM users 
  WHERE public_id = auth.uid()::uuid 
  AND deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE public_id = auth.uid()::uuid 
    AND role IN ('admin', 'moderator')
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user owns a business
CREATE OR REPLACE FUNCTION owns_business(target_business_id BIGINT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses
    WHERE id = target_business_id
    AND owner_id = current_user_id()
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### 13.3 RLS Policies — `businesses`

```sql
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Public can read published businesses
CREATE POLICY businesses_public_read ON businesses
  FOR SELECT
  USING (
    status = 'published' 
    AND deleted_at IS NULL
  );

-- Owners can read all their businesses (including drafts)
CREATE POLICY businesses_owner_read ON businesses
  FOR SELECT
  USING (
    owner_id = current_user_id()
  );

-- Owners can insert businesses (owner_id must match)
CREATE POLICY businesses_owner_insert ON businesses
  FOR INSERT
  WITH CHECK (
    owner_id = current_user_id()
  );

-- Owners can update their own businesses
CREATE POLICY businesses_owner_update ON businesses
  FOR UPDATE
  USING (owner_id = current_user_id())
  WITH CHECK (owner_id = current_user_id());

-- Soft delete only (no hard delete via RLS)
CREATE POLICY businesses_owner_delete ON businesses
  FOR DELETE
  USING (
    owner_id = current_user_id()
    AND status = 'draft'  -- Only drafts can be hard-deleted
  );

-- Admins bypass everything
CREATE POLICY businesses_admin_all ON businesses
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
```

### 13.4 RLS Policies — `products`, `services`

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read published products
CREATE POLICY products_public_read ON products
  FOR SELECT
  USING (
    status = 'published' 
    AND deleted_at IS NULL
  );

-- Business owner can read their products
CREATE POLICY products_owner_read ON products
  FOR SELECT
  USING (owns_business(business_id));

-- Business owner can insert products
CREATE POLICY products_owner_insert ON products
  FOR INSERT
  WITH CHECK (owns_business(business_id));

-- Business owner can update their products
CREATE POLICY products_owner_update ON products
  FOR UPDATE
  USING (owns_business(business_id))
  WITH CHECK (owns_business(business_id));

-- Admin override
CREATE POLICY products_admin_all ON products
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Same pattern for services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
-- (analogous policies)
```

### 13.5 RLS Policies — `land_listings`

```sql
ALTER TABLE land_listings ENABLE ROW LEVEL SECURITY;

-- Public read for published listings
CREATE POLICY land_public_read ON land_listings
  FOR SELECT
  USING (
    status = 'published' 
    AND deleted_at IS NULL
  );

-- Owner reads their listings
CREATE POLICY land_owner_read ON land_listings
  FOR SELECT
  USING (owner_id = current_user_id());

-- Owner creates listings
CREATE POLICY land_owner_insert ON land_listings
  FOR INSERT
  WITH CHECK (owner_id = current_user_id());

-- Owner updates their listings
CREATE POLICY land_owner_update ON land_listings
  FOR UPDATE
  USING (owner_id = current_user_id())
  WITH CHECK (owner_id = current_user_id());

CREATE POLICY land_admin_all ON land_listings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
```

### 13.6 RLS Policies — `media`

```sql
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Public can read media for published entities
CREATE POLICY media_public_read ON media
  FOR SELECT
  USING (
    -- Check if parent entity is published
    CASE entity_type
      WHEN 'business' THEN EXISTS (
        SELECT 1 FROM businesses 
        WHERE id = media.entity_id 
        AND status = 'published' 
        AND deleted_at IS NULL
      )
      WHEN 'product' THEN EXISTS (
        SELECT 1 FROM products 
        WHERE id = media.entity_id 
        AND status = 'published' 
        AND deleted_at IS NULL
      )
      WHEN 'service' THEN EXISTS (
        SELECT 1 FROM services 
        WHERE id = media.entity_id 
        AND status = 'published' 
        AND deleted_at IS NULL
      )
      WHEN 'land' THEN EXISTS (
        SELECT 1 FROM land_listings 
        WHERE id = media.entity_id 
        AND status = 'published' 
        AND deleted_at IS NULL
      )
      ELSE false
    END
  );

-- Uploader can read their uploads
CREATE POLICY media_uploader_read ON media
  FOR SELECT
  USING (uploaded_by = current_user_id());

-- Uploader can insert (further validation in app layer)
CREATE POLICY media_uploader_insert ON media
  FOR INSERT
  WITH CHECK (uploaded_by = current_user_id());

-- Uploader can delete their own media
CREATE POLICY media_uploader_delete ON media
  FOR DELETE
  USING (uploaded_by = current_user_id());
```

### 13.7 RLS for `users`

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY users_self_read ON users
  FOR SELECT
  USING (id = current_user_id());

-- Users can update their own profile
CREATE POLICY users_self_update ON users
  FOR UPDATE
  USING (id = current_user_id())
  WITH CHECK (id = current_user_id());

-- Public read for limited fields (display_name, avatar) - handled in app layer
-- Don't expose phone numbers via RLS; use API layer

CREATE POLICY users_admin_all ON users
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
```

### 13.8 Reference Tables (No RLS — Public Read)

```sql
-- Geographic and category tables are public reference data
-- No RLS needed; default GRANT SELECT to anon/authenticated

GRANT SELECT ON provinces TO anon, authenticated;
GRANT SELECT ON districts TO anon, authenticated;
GRANT SELECT ON communes TO anon, authenticated;
GRANT SELECT ON categories TO anon, authenticated;
GRANT SELECT ON category_groups TO anon, authenticated;
```

---

## 14. OWNERSHIP MODEL

### 14.1 Hierarchy

```
User
 ├── owns → Business (1:many)
 │           ├── owns → Product (1:many)
 │           └── owns → Service (1:many)
 │
 └── owns → LandListing (1:many)
              └── optionally linked to → Business
```

### 14.2 Ownership Rules

**RULE 1:** Every business has exactly one owner (Phase 1).  
**RULE 2:** Products and services are owned through their parent business.  
**RULE 3:** Land listings are owned directly by users (optional business link).  
**RULE 4:** Media is owned by the user who uploaded it; access via parent entity.

### 14.3 Multi-User Businesses (Phase 7+, NOT NOW)

If/when needed, add a `business_members` junction table:

```sql
-- DEFER: Phase 7+
CREATE TABLE business_members (
  business_id  BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL REFERENCES users(id),
  role         VARCHAR(20) NOT NULL,    -- 'owner' | 'admin' | 'editor'
  invited_by   BIGINT REFERENCES users(id),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id)
);
```

**FOR NOW:** Stick with `businesses.owner_id` (single owner). This is simpler and sufficient.

---

## 15. INDEX STRATEGY

### 15.1 Index Categories

**B-TREE (Default):**
- Primary keys, foreign keys
- Equality lookups (`WHERE id = ?`, `WHERE slug = ?`)
- Range queries (`WHERE price BETWEEN ? AND ?`)

**GIST (PostGIS):**
- All `GEOGRAPHY` columns
- Spatial queries (`ST_DWithin`, `ST_Distance`)

**GIN (Full-Text & JSON):**
- `TSVECTOR` columns (`search_vector`)
- `JSONB` columns when querying nested data
- Array columns (`applies_to`, `search_aliases`)

**PARTIAL INDEXES:**
- For soft-deletable tables: `WHERE deleted_at IS NULL`
- For published-only queries: `WHERE status = 'published'`

### 15.2 Composite Index Patterns

```sql
-- Multi-column for common query patterns
CREATE INDEX idx_businesses_district_status 
  ON businesses(district_id, status) 
  WHERE deleted_at IS NULL;

-- Covering index for list views
CREATE INDEX idx_businesses_list 
  ON businesses(province_id, district_id, status, published_at DESC) 
  WHERE deleted_at IS NULL;
```

### 15.3 What NOT to Index

```
❌ Boolean columns alone (low cardinality)
❌ Columns with < 10% selectivity
❌ Columns rarely used in WHERE clauses
❌ Indexes on every column "just in case"
```

**RULE:** Add indexes only when query plans show sequential scans on slow queries.

---

## 16. QUERY PATTERNS

### 16.1 Nearby Search (Core Query)

```sql
-- Find businesses within 10km of a point, in category
SELECT 
  b.id, b.public_id, b.name, b.slug, b.tagline,
  b.formatted_address,
  ST_Distance(
    b.location,
    ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
  ) / 1000 AS distance_km,
  c.name AS category_name,
  p.slug AS province_slug,
  d.slug AS district_slug,
  m.thumbnail_url AS hero_thumbnail
FROM businesses b
JOIN categories c ON c.id = b.category_id
JOIN provinces p ON p.id = b.province_id
JOIN districts d ON d.id = b.district_id
LEFT JOIN media m ON m.id = b.hero_image_id
WHERE b.status = 'published'
  AND b.deleted_at IS NULL
  AND ($category_id IS NULL OR b.category_id = $category_id)
  AND ST_DWithin(
    b.location,
    ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
    $radius_meters
  )
ORDER BY b.location <-> ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
LIMIT 20;
```

### 16.2 Storefront Page Query

```sql
-- Single business with hierarchy
SELECT 
  b.*,
  c.name AS category_name,
  c.slug AS category_slug,
  cg.name AS category_group_name,
  p.name AS province_name,
  p.slug AS province_slug,
  d.name AS district_name,
  d.slug AS district_slug,
  co.name AS commune_name,
  co.slug AS commune_slug
FROM businesses b
JOIN categories c ON c.id = b.category_id
JOIN category_groups cg ON cg.id = c.group_id
JOIN provinces p ON p.id = b.province_id
JOIN districts d ON d.id = b.district_id
LEFT JOIN communes co ON co.id = b.commune_id
WHERE p.slug = $province_slug
  AND d.slug = $district_slug
  AND b.slug = $business_slug
  AND b.status = 'published'
  AND b.deleted_at IS NULL;
```

### 16.3 Text Search Query

```sql
-- Vietnamese-aware search with geographic filter
SELECT 
  b.id, b.public_id, b.name, b.slug,
  ts_rank(b.search_vector, query) AS rank,
  ST_Distance(b.location, $user_location) / 1000 AS distance_km
FROM businesses b,
     plainto_tsquery('vietnamese', unaccent($query)) AS query
WHERE b.status = 'published'
  AND b.deleted_at IS NULL
  AND b.search_vector @@ query
  AND ($province_id IS NULL OR b.province_id = $province_id)
ORDER BY rank DESC, distance_km ASC
LIMIT 20;
```

### 16.4 Slug Resolution with Redirects

```sql
-- Try to find current entity by slug
-- If not found, check slug_history for redirects
WITH current_match AS (
  SELECT b.id, b.public_id, 'current' AS match_type, NULL::TEXT AS redirect_to
  FROM businesses b
  JOIN districts d ON d.id = b.district_id
  JOIN provinces p ON p.id = b.province_id
  WHERE p.slug = $province_slug
    AND d.slug = $district_slug
    AND b.slug = $business_slug
    AND b.deleted_at IS NULL
),
redirect_match AS (
  SELECT 
    NULL::BIGINT AS id, 
    NULL::UUID AS public_id, 
    'redirect' AS match_type, 
    sh.new_full_path AS redirect_to
  FROM slug_history sh
  WHERE sh.old_full_path = $full_path
    AND (sh.expires_at IS NULL OR sh.expires_at > now())
    AND NOT EXISTS (SELECT 1 FROM current_match)
  ORDER BY sh.created_at DESC
  LIMIT 1
)
SELECT * FROM current_match
UNION ALL
SELECT * FROM redirect_match
LIMIT 1;
```

---

## 17. INQUIRIES

Inquiries are contact requests from visitors to listing owners. They are the primary lead-generation mechanism.

### 17.1 `inquiries`

```sql
CREATE TABLE inquiries (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  -- What they're inquiring about
  entity_type     VARCHAR(20) NOT NULL,            -- 'business' | 'product' | 'service' | 'land'
  entity_id       BIGINT NOT NULL,

  -- Who is receiving this inquiry
  recipient_id    BIGINT NOT NULL REFERENCES users(id),

  -- Sender info (may or may not be registered)
  sender_user_id  BIGINT REFERENCES users(id),     -- NULL if anonymous
  sender_name     VARCHAR(100) NOT NULL,
  sender_phone    VARCHAR(20) NOT NULL,
  sender_email    VARCHAR(255),

  -- Inquiry content
  message         TEXT NOT NULL,
  inquiry_type    VARCHAR(30) NOT NULL DEFAULT 'general',
                  -- 'general' | 'price' | 'availability' | 'visit' | 'bulk_order' | 'partnership'

  -- Status tracking
  status          VARCHAR(20) NOT NULL DEFAULT 'new',
                  -- 'new' | 'read' | 'replied' | 'archived' | 'spam'

  read_at         TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,

  -- Source tracking
  referrer_url    TEXT,
  device_type     VARCHAR(20),                     -- 'mobile' | 'desktop'

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT inquiries_entity_check CHECK (
    entity_type IN ('business', 'product', 'service', 'land')
  ),
  CONSTRAINT inquiries_phone_format CHECK (sender_phone ~ '^\+?[0-9]{9,15}$')
);

CREATE INDEX idx_inquiries_recipient ON inquiries(recipient_id, status, created_at DESC);
CREATE INDEX idx_inquiries_entity ON inquiries(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_inquiries_status ON inquiries(status) WHERE status = 'new';
CREATE INDEX idx_inquiries_sender ON inquiries(sender_user_id) WHERE sender_user_id IS NOT NULL;

CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**RLS:**
```sql
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY inquiries_recipient_read ON inquiries
  FOR SELECT USING (recipient_id = current_user_id());

CREATE POLICY inquiries_sender_insert ON inquiries
  FOR INSERT WITH CHECK (true);  -- Anyone can send

CREATE POLICY inquiries_recipient_update ON inquiries
  FOR UPDATE USING (recipient_id = current_user_id());

CREATE POLICY inquiries_admin_all ON inquiries
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
```

---

## 18. SAVED ITEMS

Users can save/bookmark any listing for later.

### 18.1 `saved_items`

```sql
CREATE TABLE saved_items (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What they saved
  entity_type     VARCHAR(20) NOT NULL,            -- 'business' | 'product' | 'service' | 'land'
  entity_id       BIGINT NOT NULL,

  -- Optional organization
  note            VARCHAR(500),                    -- Personal note

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A user can save an entity only once
  UNIQUE(user_id, entity_type, entity_id),

  CONSTRAINT saved_items_entity_check CHECK (
    entity_type IN ('business', 'product', 'service', 'land')
  )
);

CREATE INDEX idx_saved_items_user ON saved_items(user_id, created_at DESC);
CREATE INDEX idx_saved_items_entity ON saved_items(entity_type, entity_id);
```

**RLS:**
```sql
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_items_owner ON saved_items
  FOR ALL
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());
```

---

## 19. MODERATION MODEL

### 19.1 Philosophy

```
MODERATION IS LIGHTWEIGHT.
We are NOT building a content moderation platform.
We are building a queue for human review of flagged content.
```

### 19.2 `moderation_queue`

```sql
CREATE TABLE moderation_queue (
  id              BIGSERIAL PRIMARY KEY,

  -- What is being moderated
  entity_type     VARCHAR(20) NOT NULL,
  entity_id       BIGINT NOT NULL,

  -- Why it's in the queue
  reason          VARCHAR(50) NOT NULL,
                  -- 'new_listing' | 'user_report' | 'auto_flag' | 'edit_review' | 'reactivation'
  reason_detail   TEXT,                            -- Free-text explanation

  -- Who reported (if user report)
  reported_by     BIGINT REFERENCES users(id),

  -- Status
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                  -- 'pending' | 'approved' | 'rejected' | 'escalated'

  -- Resolution
  reviewed_by     BIGINT REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  resolution_note TEXT,

  -- Action taken
  action_taken    VARCHAR(30),
                  -- 'none' | 'published' | 'suspended' | 'deleted' | 'edited'

  -- Priority (for queue ordering)
  priority        SMALLINT NOT NULL DEFAULT 0,     -- 0=normal, 1=high, 2=urgent

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_pending ON moderation_queue(status, priority DESC, created_at)
  WHERE status = 'pending';
CREATE INDEX idx_moderation_entity ON moderation_queue(entity_type, entity_id);
CREATE INDEX idx_moderation_reviewer ON moderation_queue(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE TRIGGER trg_moderation_updated_at
  BEFORE UPDATE ON moderation_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 19.3 Moderation Flow

```
1. Business/product/service/land is created → status = 'draft'
2. Owner publishes → status = 'published' (auto-publish for Phase 1)
3. If flagged (by user or auto-rule) → entry added to moderation_queue
4. Moderator reviews → approves (no action) or suspends entity
5. Owner notified of suspension (future: via SMS/notification)
```

### 19.4 Auto-Flag Rules (Application Layer)

```
AUTO-FLAG WHEN:
- New user's first listing (trust building)
- Description contains phone numbers (spam signal)
- Listing price is 0 or extremely high (likely error)
- Images contain no recognizable content (placeholder detection)
- User has had previous suspensions
```

### 19.5 `content_reports` (User Reports)

```sql
CREATE TABLE content_reports (
  id              BIGSERIAL PRIMARY KEY,
  reporter_id     BIGINT REFERENCES users(id),     -- NULL if anonymous

  entity_type     VARCHAR(20) NOT NULL,
  entity_id       BIGINT NOT NULL,

  report_type     VARCHAR(30) NOT NULL,
                  -- 'spam' | 'fake' | 'offensive' | 'duplicate' | 'wrong_location' | 'other'
  description     TEXT,

  -- Links to moderation queue
  moderation_id   BIGINT REFERENCES moderation_queue(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_entity ON content_reports(entity_type, entity_id);
CREATE INDEX idx_reports_type ON content_reports(report_type);
```

---

## 20. SEO METADATA STRATEGY

### 20.1 Inline SEO Fields

Every public entity has `seo_title` and `seo_description` columns. These are **overrides** — if NULL, the application layer generates defaults from entity data.

### 20.2 Default SEO Generation (Application Layer)

```
Business:  "{name} - {category} tại {district}, {province}"
Product:   "{name} | {business_name} - {district}, {province}"
Service:   "{name} | {business_name} - {district}, {province}"
Land:      "{title} | Đất {land_type} {area_m2}m² - {district}, {province}"
```

### 20.3 `seo_pages` (Programmatic SEO Landing Pages)

```sql
CREATE TABLE seo_pages (
  id              BIGSERIAL PRIMARY KEY,
  slug            VARCHAR(200) NOT NULL UNIQUE,    -- "dong-nai/sau-rieng"

  -- What this page represents
  page_type       VARCHAR(30) NOT NULL,
                  -- 'geo_category'     → /dong-nai/sau-rieng
                  -- 'geo_landing'      → /dong-nai
                  -- 'category_landing' → /danh-muc/nong-san
                  -- 'crop_region'      → /vung-trong/sau-rieng-ri6

  -- References (which geo + category this page targets)
  province_id     SMALLINT REFERENCES provinces(id),
  district_id     INTEGER REFERENCES districts(id),
  category_id     INTEGER REFERENCES categories(id),

  -- SEO content
  title           VARCHAR(200) NOT NULL,
  meta_description VARCHAR(500) NOT NULL,
  h1_text         VARCHAR(200) NOT NULL,
  intro_content   TEXT,                            -- Editable intro paragraph

  -- Structured data hints
  schema_type     VARCHAR(30),                     -- 'ItemList' | 'LocalBusiness' | 'Place'

  -- Control
  is_published    BOOLEAN NOT NULL DEFAULT false,
  noindex         BOOLEAN NOT NULL DEFAULT false,   -- For thin pages
  canonical_url   TEXT,                            -- Override canonical if needed

  -- Stats (for thin-page detection)
  listing_count   INTEGER NOT NULL DEFAULT 0,      -- Cached count of entities
  last_crawled_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_pages_slug ON seo_pages(slug) WHERE is_published;
CREATE INDEX idx_seo_pages_type ON seo_pages(page_type);
CREATE INDEX idx_seo_pages_province ON seo_pages(province_id);
CREATE INDEX idx_seo_pages_thin ON seo_pages(listing_count) WHERE listing_count < 3;
```

### 20.4 Thin Page Prevention

```
RULES:
1. SEO pages with < 3 listings → noindex = true
2. SEO pages with 0 listings → is_published = false (hide entirely)
3. Nightly job recalculates listing_count and adjusts noindex
4. Pages that cross the threshold get auto-published/unpublished
```

### 20.5 SEO Metadata Checklist

| Page Type | <title> | meta description | h1 | canonical | structured data |
|-----------|---------|-----------------|----|-----------|-----------------|
| Province landing | "{Province} - Khám phá kinh doanh địa phương" | Dynamic from counts | Province name | Self | Place |
| District landing | "{District}, {Province} - Doanh nghiệp địa phương" | Dynamic | District name | Self | Place |
| Business page | "{Name} - {Category} tại {District}" | From tagline/description | Business name | Self | LocalBusiness |
| Product page | "{Product} \| {Business}" | From short_description | Product name | Self | Product |
| Category + Geo | "{Category} tại {Province}" | Dynamic listing summary | Category + Geo | Self | ItemList |

---

## 21. PARTITIONING STRATEGY (Future)

**DO NOT PARTITION NOW.** Wait for clear performance signals.

### 21.1 When to Partition

```
businesses     → > 5M rows: partition by province_id
products       → > 10M rows: partition by business_id range  
views_daily    → > 100M rows: partition by date (monthly)
contact_events → > 50M rows: partition by created_at (monthly)
search_log     → > 100M rows: partition by created_at (monthly)
```

### 21.2 Example: View Log Partitioning (Future)

```sql
-- DEFER until views_daily exceeds 100M rows
-- Convert to partitioned table:
CREATE TABLE views_daily (
  -- columns
) PARTITION BY RANGE (date);

CREATE TABLE views_daily_2026_01 PARTITION OF views_daily
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

---

## 22. BACKUP & DATA RETENTION

### 22.1 Backup Strategy

```
Daily Full Backups:    Retained 30 days
Weekly Backups:        Retained 90 days
Monthly Backups:       Retained 1 year
PITR (Point-in-Time):  Last 7 days (Supabase handles)
```

### 22.2 Data Retention Policies

```sql
-- OTP codes: delete after 1 day
DELETE FROM otp_codes WHERE created_at < now() - INTERVAL '1 day';

-- Expired sessions: delete after 30 days
DELETE FROM sessions WHERE expires_at < now() - INTERVAL '30 days';

-- Contact events: aggregate older than 90 days
-- (Move to monthly summary table)

-- Search logs: keep 1 year for analytics
DELETE FROM search_log WHERE created_at < now() - INTERVAL '1 year';

-- Soft-deleted entities: hard delete after 1 year
-- (Manual review process; user data ownership)
```

---

## 23. SUPABASE-SPECIFIC NOTES

### 23.1 Supabase Auth Integration

Supabase Auth manages `auth.users`. We mirror with our `public.users`:

```sql
-- Trigger: when auth.users gets a new entry, create public.users
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (public_id, phone, phone_verified)
  VALUES (
    NEW.id,
    NEW.phone,
    NEW.phone_confirmed_at IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
```

### 23.2 Storage Buckets

```
Bucket: vio-media
├── businesses/{business_public_id}/
│   ├── hero.jpg
│   ├── gallery/
│   └── documents/
├── products/{product_public_id}/
├── services/{service_public_id}/
└── land/{land_public_id}/
```

**Storage RLS:** Authenticated users can upload to their own folders. Public read for media linked to published entities.

### 23.3 Supabase Edge Functions (Optional)

Reserve for:
- Image processing on upload (resize, WebP conversion)
- Slug uniqueness check
- Geographic reverse lookup
- Short link redirects

**DO NOT use Edge Functions for:**
- Main API routes (use Next.js API routes)
- Long-running tasks
- Database-heavy operations

---

## 24. MIGRATION DISCIPLINE

### 24.1 Migration Rules

```
✅ Each migration is small and focused
✅ Each migration has up + down scripts
✅ Tested locally before commit
✅ Never edit committed migrations
✅ Always backward-compatible
```

### 24.2 Migration Sequence

```
001_create_extensions.sql
002_create_geographic_tables.sql
003_create_geographic_aliases.sql
004_seed_provinces.sql
005_seed_districts.sql
006_seed_communes.sql
007_seed_geographic_aliases.sql
008_create_users.sql
009_create_user_roles.sql
010_create_auth_tables.sql
011_create_categories.sql
012_seed_categories.sql
013_create_businesses.sql
014_create_media.sql
015_create_slug_history.sql
016_create_products.sql
017_create_product_images.sql
018_create_services.sql
019_create_service_images.sql
020_create_land_listings.sql
021_create_land_listing_images.sql
022_create_analytics_tables.sql
023_create_short_links.sql
024_create_inquiries.sql
025_create_saved_items.sql
026_create_moderation_tables.sql
027_create_seo_pages.sql
028_enable_rls.sql
029_create_rls_policies.sql
030_create_helper_functions.sql
031_create_triggers.sql
```

### 24.3 Schema Versioning

```sql
CREATE TABLE schema_versions (
  version     INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 25. PERFORMANCE BUDGETS

```
Query Type                          Target P95
─────────────────────────────────────────────
Storefront page load (single)       < 50ms
Nearby search (20 results)          < 200ms
Text search (with rank)             < 300ms
Category browse                     < 100ms
User dashboard (10 businesses)      < 100ms
Geographic landing page             < 150ms
Slug resolution with redirect       < 30ms
```

**MONITOR:** Use `pg_stat_statements` to track slow queries.

---

## 26. ENTITY-RELATIONSHIP SUMMARY

```
                                ┌────────────┐
                                │  provinces │
                                └─────┬──────┘
                                      │ 1:many
                                ┌─────▼──────┐        ┌─────────────────────┐
                                │  districts │        │ geographic_aliases  │
                                └─────┬──────┘        │ (SEO synonyms)      │
                                      │ 1:many        └─────────────────────┘
                                ┌─────▼──────┐              ▲ references
                                │  communes  │──────────────┘
                                └────────────┘
                                      ▲
                                      │ references
┌────────────┐    1:many       ┌──────┴──────┐
│   users    │─────────────────│ businesses  │
└─────┬──────┘                 └──────┬──────┘
      │                               │ 1:many
      │                        ┌──────┼──────┬──────────┐
      │                        ▼      ▼      ▼          │
      │                  ┌────────┐ ┌──────┐ ┌────────┐ │
      │                  │products│ │services│ │ media │ │
      │                  └───┬────┘ └───┬──┘ └───┬────┘ │
      │                      │          │        │      │
      │              product_images  service_   (polymorphic
      │                              images     reference)
      │                                               │
      │ 1:many                                        │
      │                                               │
      ├───── user_roles                               │
      ├───── saved_items                              │
      ├───── inquiries ◄──────────────────────────────┤
      │                                               │
      └─────────┐                                     │
                ▼                                     │
        ┌──────────────┐                              │
        │ land_listings│◄─────────────────────────────┘
        └───┬──────────┘
            │  ├── land_listing_images
            │  └── optional FK → businesses
            │
            └── moderation_queue / content_reports


Shared lookup tables (referenced by all):
- categories / category_groups
- provinces / districts / communes
- geographic_aliases
- seo_pages
```

---

## 27. SUMMARY OF KEY DECISIONS

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | PostgreSQL 15+ | Open source, PostGIS native |
| Spatial | PostGIS `geography(Point, 4326)` | Accurate for distances, GIST indexed |
| Search | `tsvector` + `pg_trgm` + `unaccent` | Vietnamese-aware, no external dep |
| Auth | Supabase Auth (phone) | Managed, secure, integrated |
| Security | Row-Level Security | DB-enforced, not just app-layer |
| IDs | `bigserial` + `uuid` public_id | Fast joins, safe public URLs |
| Soft delete | `deleted_at` timestamp | Reversible, audit-friendly |
| Slugs | District-scoped uniqueness | Allows duplicates in different areas |
| Slug history | Separate table | Maintains SEO through renames |
| Media | Polymorphic + type-safe image tables | Single upload pipeline + clean FK queries |
| Categories | Shared across entities | DRY, consistent UX |
| Geographic denorm | Yes for performance | Avoids 3-way joins on every query |
| Geo aliases | Dedicated table | SEO synonyms, autocomplete, historical names |
| Counts | Cached in geographic tables | Avoids COUNT(*) on hot pages |
| Roles | Inline `users.role` + `user_roles` table | Fast RLS checks + audit-grade RBAC |
| Moderation | Lightweight queue | Human review, not automated removal |
| SEO pages | `seo_pages` table with thin-page logic | Programmatic SEO with quality control |
| Multi-owner | NOT NOW | Single owner_id, defer until needed |
| Partitioning | NOT NOW | Premature; revisit at scale |

---

## 28. WHAT WE EXPLICITLY DID NOT BUILD

```
❌ Order/cart/checkout tables                   (not a marketplace)
❌ Payment/transaction tables                   (we don't touch money)
❌ Inventory/stock tables                       (out of scope)
❌ Messaging/chat tables                        (use Zalo/Facebook)
❌ Notification tables                          (Phase 7+)
❌ Reviews/ratings tables                       (Phase 7+)
❌ Multi-owner/team tables                      (single owner for now)
❌ Subscription/billing tables                  (free product)
❌ Tags table (separate from categories)        (categories sufficient)
❌ User preferences table                       (use JSONB in users)
❌ Activity feed tables                         (not a social network)
❌ Recommendation cache tables                  (no AI features)
```

**WHEN ASKED TO ADD THESE:** Check the roadmap. If not in current phase, defer.

---

**END OF DATABASE ARCHITECTURE v1.0**

*This schema is the foundation. It is opinionated, normalized, and optimized for the actual workload: hyperlocal discovery of rural Vietnamese businesses. It does not include features outside the roadmap. Resist the urge to add tables "just in case."*