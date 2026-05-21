# VIO LOCAL — DB IMPLEMENTATION ORDER
**PostgreSQL + PostGIS + Supabase | Migration-Safe Schema Sequencing**

---

## 0. HOW TO READ THIS DOCUMENT

This document answers one question: **in what order do we run migrations, and why?**

Every ordering decision is driven by one of four constraints:

| Constraint | What it means |
|---|---|
| **Dependency-safe** | Table A cannot reference Table B until B exists |
| **Migration-safe** | No migration can be reversed without data loss if run out of order |
| **RLS-safe** | Policies that reference other tables must run after those tables exist |
| **Circular-safe** | Known circular FKs are broken into a base migration + a deferred ALTER |

When in doubt: **create the referenced table before the referencing table.**

---

## 1. CIRCULAR DEPENDENCY REGISTER

Identify and resolve all cycles before writing a single migration.

### 1.1 Cycle A — `profiles` ↔ `storefronts`

```
profiles.active_storefront_id  →  storefronts.id
storefronts.owner_id           →  profiles.user_id
```

**Resolution:** Two-step migration.

```
0004_profiles.sql        — CREATE TABLE profiles  (NO active_storefront_id yet)
0010_storefronts.sql     — CREATE TABLE storefronts (owner_id → profiles)
0011_profiles_sfk.sql    — ALTER TABLE profiles ADD COLUMN active_storefront_id
                           BIGINT REFERENCES storefronts(id) ON DELETE SET NULL
```

Never add `active_storefront_id` in the same migration as `CREATE TABLE profiles`.

### 1.2 Cycle B — Commerce Entities ↔ `images` (cover image)

```
storefronts.cover_image_id  →  images.id
products.cover_image_id     →  images.id
services.cover_image_id     →  images.id
land_listings.cover_image_id → images.id

images.storefront_id        →  storefronts.id
images.product_id           →  products.id
images.service_id           →  services.id
images.land_listing_id      →  land_listings.id
```

**Resolution:** Create entities first without `cover_image_id`. Add cover FK in a separate migration after `images` exists.

```
0010–0014  — CREATE commerce entity tables  (NO cover_image_id)
0015       — CREATE TABLE images           (with nullable entity FKs)
0016       — ALTER each entity ADD COLUMN cover_image_id  (optional optimization)
```

If you never need `cover_image_id` as a FK (and instead derive cover via `WHERE is_cover = true`), skip migration 0016 entirely. Recommended for Phase 1.

### 1.3 Cycle C — `geographic_aliases` ↔ Geographic Tables

```
geographic_aliases.province_id  →  provinces.id
geographic_aliases.district_id  →  districts.id
geographic_aliases.commune_id   →  communes.id
```

There is no reverse reference, so this is **not a true cycle** — it just requires that all three geographic tables exist before `geographic_aliases` is created.

```
0006 provinces → 0007 districts → 0008 communes → 0009 geographic_aliases
```

### 1.4 Cycle D — Geographic Hierarchy (self-contained)

```
districts.province_id  →  provinces.id
communes.district_id   →  districts.id
communes.province_id   →  provinces.id  (denormalized)
```

Again, no true cycle. Create in order: provinces → districts → communes.

---

## 2. FULL DEPENDENCY GRAPH

Read arrows as "must exist before":

```
auth.users (Supabase built-in)
    │
    ▼
[Phase 1] INFRASTRUCTURE
    0001 extensions
    0002 utility functions
    0003 enum types
    │
    ▼
[Phase 2] IDENTITY
    0004 profiles (partial — no storefront FK yet)
    │
    ▼
[Phase 3] ROLES
    0005 roles (enum column + helper functions on profiles)
    │
    ├──────────────────────────────────────┐
    ▼                                      ▼
[Phase 4] GEOGRAPHIC                  (roles complete)
    0006 provinces
      └▶ 0007 districts
           └▶ 0008 communes
                └▶ 0009 geographic_aliases
    │
    ▼
[Phase 5] COMMERCE ENTITIES
    0010 storefronts        (profiles + districts + communes)
    0011 profiles_sfk       (ALTER profiles — resolves Cycle A)
    0012 products           (storefronts)
    0013 services           (storefronts + communes)
    0014 land_listings      (profiles + districts + communes)
    │
    ▼
[Phase 6] MEDIA
    0015 images             (nullable FKs to all 4 commerce entities)
    0016 entity_cover_fks   (ALTER entities — resolves Cycle B, OPTIONAL)
    │
    ▼
[Phase 7] SOCIAL LAYER
    0017 saved_items        (profiles + commerce entities)
    0018 inquiries          (profiles + commerce entities)
    │
    ▼
[Phase 8] RLS POLICIES
    0019 rls_profiles
    0020 rls_storefronts
    0021 rls_products
    0022 rls_services
    0023 rls_land_listings
    0024 rls_images
    0025 rls_saved_items
    0026 rls_inquiries
    │
    ▼
[Phase 9] SEED DATA
    0027 seed_provinces
    0028 seed_districts
    0029 seed_communes
    0030 seed_geographic_aliases
```

---

## 3. PHASE-BY-PHASE IMPLEMENTATION

---

### PHASE 1 — Database Infrastructure

#### `0001_extensions.sql`

No dependencies. Must be first.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEXT SEARCH CONFIGURATION vietnamese (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION vietnamese
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, simple;
```

**Why first:** Every subsequent migration may use PostGIS geography types, `unaccent()`, `gen_random_uuid()`. If extensions are missing, all DDL that references them fails.

#### `0002_utility_functions.sql`

Depends on: `0001` (unaccent extension).

```sql
-- Vietnamese slug normalization (used by triggers and app code)
CREATE OR REPLACE FUNCTION slugify(input_text TEXT) RETURNS TEXT ...;

-- Auto-update updated_at (used by all table triggers)
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER ...;
```

**Why before tables:** Table triggers call `update_updated_at()`. Creating the trigger before the function exists will fail.

#### `0003_types.sql`

Depends on: nothing. Enums are schema-level objects.

Define **all** application enums here, in one migration:

```sql
-- Identity & access
CREATE TYPE user_role AS ENUM ('buyer', 'merchant', 'moderator', 'admin');

-- Listing lifecycle
CREATE TYPE listing_status AS ENUM (
  'draft', 'pending_review', 'published', 'paused', 'rejected', 'archived'
);

-- Images
CREATE TYPE image_category AS ENUM (
  'cover', 'gallery', 'document', 'avatar', 'banner'
);

-- Inquiries
CREATE TYPE inquiry_status AS ENUM (
  'open', 'responded', 'closed', 'spam'
);

-- Land listing type
CREATE TYPE land_type AS ENUM (
  'ruong' ,     -- rice field
  'vuon',       -- garden
  'dat_o',      -- residential
  'dat_rung',   -- forest land
  'ao_nuoi_ca', -- fish pond
  'other'
);

-- Service radius model
CREATE TYPE service_coverage AS ENUM (
  'commune', 'district', 'province', 'national', 'on_site_only'
);
```

**Why one migration:** Enum types cannot be created inside a transaction that also uses them. Grouping them here prevents ordering ambiguity between tables that reference the same type.

**Migration safety note:** Adding values to an existing `ENUM` requires `ALTER TYPE ... ADD VALUE` which cannot run inside a transaction in PostgreSQL. Plan your enum values carefully before deploying.

---

### PHASE 2 — Identity

#### `0004_profiles.sql`

Depends on: `auth.users` (Supabase built-in), `0003` (user_role enum).

```sql
CREATE TABLE profiles (
  -- Links to Supabase auth.users (1:1)
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Role
  role            user_role NOT NULL DEFAULT 'buyer',

  -- Identity
  display_name    VARCHAR(100),
  phone           VARCHAR(20),          -- Primary login in VIO LOCAL
  avatar_url      TEXT,
  bio             TEXT,

  -- active_storefront_id intentionally omitted — added in 0011
  -- to break the profiles ↔ storefronts circular dependency

  -- Verification
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  verified_at     TIMESTAMPTZ,

  -- Soft delete
  deleted_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_profiles_public_id ON profiles(public_id);
CREATE INDEX idx_profiles_phone ON profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_profiles_role ON profiles(role);

-- Enable RLS immediately (empty = deny all until policies added in Phase 8)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

**Critical note:** Do NOT add `active_storefront_id` here. It creates a dependency on `storefronts`, which does not exist yet.

---

### PHASE 3 — Roles

#### `0005_roles.sql`

Depends on: `0004_profiles`.

Role is stored as an enum column on `profiles` (already added in `0004`). This migration adds:

1. **Helper functions** for RLS policies to call
2. **Role-change audit trail** (optional but recommended)

```sql
-- Helper: check current user's role (called in RLS policies)
-- SECURITY DEFINER runs as the function owner, bypassing RLS on profiles
CREATE OR REPLACE FUNCTION auth.current_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth.is_merchant() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.current_role() IN ('merchant', 'admin')
$$;

CREATE OR REPLACE FUNCTION auth.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.current_role() = 'admin'
$$;

-- Audit trail for role changes
CREATE TABLE role_audit (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  old_role    user_role NOT NULL,
  new_role    user_role NOT NULL,
  changed_by  UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_role_audit_user ON role_audit(user_id);
```

**RLS note:** `auth.is_merchant()` and `auth.is_admin()` are used throughout subsequent RLS policies. They must exist before Phase 8. Creating them here, before any commerce tables, ensures they are available whenever needed.

**`SECURITY DEFINER` warning:** These functions bypass the RLS of `profiles`. This is intentional — a user checking their own role should not be blocked by the policy that uses the role to decide access. Set `search_path = public` to prevent search path injection.

---

### PHASE 4 — Geographic Reference Data

Geographic tables have **no user dependencies**. They are pure reference data. Run them after Phase 3 so the helper functions from Phase 3 are available for any geographic RLS (typically none — geographic data is publicly readable).

#### `0006_provinces.sql`

Depends on: `0001` (PostGIS).

```sql
CREATE TABLE provinces (
  id              SMALLINT PRIMARY KEY,    -- GSO official code (1–97)
  name            VARCHAR(100) NOT NULL,
  name_with_type  VARCHAR(150) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  type            VARCHAR(20) NOT NULL,    -- 'tinh' | 'thanh-pho'
  region          VARCHAR(20) NOT NULL,    -- 'bac' | 'trung' | 'nam'

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
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provinces_slug ON provinces(slug);
CREATE INDEX idx_provinces_region ON provinces(region);
CREATE INDEX idx_provinces_location ON provinces USING GIST(center_location);
CREATE INDEX idx_provinces_boundary ON provinces USING GIST(boundary) WHERE boundary IS NOT NULL;

CREATE TRIGGER trg_provinces_updated_at
  BEFORE UPDATE ON provinces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**No RLS:** Geographic reference data is public. Applying RLS to `provinces` gains nothing and adds join overhead to every geographic query.

#### `0007_districts.sql`

Depends on: `0006_provinces`.

```sql
CREATE TABLE districts (
  id              INTEGER PRIMARY KEY,     -- GSO official code
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  name            VARCHAR(100) NOT NULL,
  name_with_type  VARCHAR(150) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  type            VARCHAR(20) NOT NULL,

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

  UNIQUE(province_id, slug)   -- slug unique within province, not globally
);

CREATE INDEX idx_districts_province ON districts(province_id);
CREATE INDEX idx_districts_slug ON districts(province_id, slug);
CREATE INDEX idx_districts_location ON districts USING GIST(center_location);
CREATE INDEX idx_districts_boundary ON districts USING GIST(boundary) WHERE boundary IS NOT NULL;

CREATE TRIGGER trg_districts_updated_at
  BEFORE UPDATE ON districts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### `0008_communes.sql`

Depends on: `0007_districts`, `0006_provinces` (denormalized FK).

```sql
CREATE TABLE communes (
  id              INTEGER PRIMARY KEY,     -- GSO official code
  district_id     INTEGER NOT NULL REFERENCES districts(id),
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),  -- denormalized
  name            VARCHAR(100) NOT NULL,
  name_with_type  VARCHAR(150) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  type            VARCHAR(20) NOT NULL,    -- 'xa' | 'phuong' | 'thi-tran'

  center_location GEOGRAPHY(Point, 4326) NOT NULL,
  boundary        GEOGRAPHY(MultiPolygon, 4326),

  business_count  INTEGER NOT NULL DEFAULT 0,
  is_major        BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(district_id, slug)
);

CREATE INDEX idx_communes_district ON communes(district_id);
CREATE INDEX idx_communes_province ON communes(province_id);
CREATE INDEX idx_communes_slug ON communes(district_id, slug);
CREATE INDEX idx_communes_is_major ON communes(is_major) WHERE is_major;
CREATE INDEX idx_communes_location ON communes USING GIST(center_location);
CREATE INDEX idx_communes_boundary ON communes USING GIST(boundary) WHERE boundary IS NOT NULL;

CREATE TRIGGER trg_communes_updated_at
  BEFORE UPDATE ON communes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### `0009_geographic_aliases.sql`

Depends on: `0006`, `0007`, `0008` (all three geographic tables must exist — this table FKs to all of them).

```sql
CREATE TABLE geographic_aliases (
  id              BIGSERIAL PRIMARY KEY,
  entity_type     VARCHAR(20) NOT NULL,       -- 'province' | 'district' | 'commune'

  -- Only the relevant FK is non-null
  province_id     SMALLINT REFERENCES provinces(id) ON DELETE CASCADE,
  district_id     INTEGER  REFERENCES districts(id) ON DELETE CASCADE,
  commune_id      INTEGER  REFERENCES communes(id)  ON DELETE CASCADE,

  alias_name      VARCHAR(200) NOT NULL,
  alias_slug      VARCHAR(200) NOT NULL,
  alias_type      VARCHAR(30)  NOT NULL DEFAULT 'colloquial',
  language        VARCHAR(10)  NOT NULL DEFAULT 'vi',
  priority        SMALLINT     NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT geo_alias_entity_check CHECK (
    (entity_type = 'province' AND province_id IS NOT NULL AND district_id IS NULL AND commune_id IS NULL) OR
    (entity_type = 'district' AND district_id IS NOT NULL AND province_id IS NULL AND commune_id IS NULL) OR
    (entity_type = 'commune'  AND commune_id  IS NOT NULL AND province_id IS NULL AND district_id IS NULL)
  )
);

CREATE INDEX idx_geo_aliases_slug   ON geographic_aliases(alias_slug) WHERE is_active;
CREATE INDEX idx_geo_aliases_name   ON geographic_aliases USING GIN(alias_name gin_trgm_ops);
CREATE INDEX idx_geo_aliases_prov   ON geographic_aliases(province_id) WHERE province_id IS NOT NULL;
CREATE INDEX idx_geo_aliases_dist   ON geographic_aliases(district_id) WHERE district_id IS NOT NULL;
CREATE INDEX idx_geo_aliases_comm   ON geographic_aliases(commune_id)  WHERE commune_id  IS NOT NULL;
```

---

### PHASE 5 — Commerce Entities

These are the core content tables. Order within this phase matters.

#### `0010_storefronts.sql`

Depends on: `0004_profiles`, `0007_districts`, `0008_communes`, `0003_types` (listing_status).

```sql
CREATE TABLE storefronts (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Ownership (references profiles, not auth.users)
  owner_id        UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,

  -- Identity
  name            VARCHAR(200) NOT NULL,
  slug            VARCHAR(200) NOT NULL,
  description     TEXT,
  phone           VARCHAR(20),
  address_text    TEXT,                   -- Free-text village/hamlet address

  -- Geography (denormalized for query speed)
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  district_id     INTEGER  NOT NULL REFERENCES districts(id),
  commune_id      INTEGER  REFERENCES communes(id),
  location        GEOGRAPHY(Point, 4326),

  -- Lifecycle
  status          listing_status NOT NULL DEFAULT 'draft',
  published_at    TIMESTAMPTZ,

  -- Search vector (updated by trigger)
  search_vector   TSVECTOR,

  -- cover_image_id intentionally omitted — added in 0016 (resolves Cycle B)

  -- Soft delete
  deleted_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(district_id, slug)
);

CREATE INDEX idx_storefronts_owner    ON storefronts(owner_id);
CREATE INDEX idx_storefronts_slug     ON storefronts(district_id, slug);
CREATE INDEX idx_storefronts_province ON storefronts(province_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_storefronts_district ON storefronts(district_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_storefronts_location ON storefronts USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX idx_storefronts_search   ON storefronts USING GIN(search_vector);
CREATE INDEX idx_storefronts_published ON storefronts(district_id, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE TRIGGER trg_storefronts_updated_at
  BEFORE UPDATE ON storefronts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE storefronts ENABLE ROW LEVEL SECURITY;
```

#### `0011_profiles_storefront_fk.sql`

**This migration resolves Cycle A.** Run it immediately after `0010_storefronts.sql`.

```sql
-- Now that storefronts exists, add the back-reference from profiles
ALTER TABLE profiles
  ADD COLUMN active_storefront_id BIGINT
    REFERENCES storefronts(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_active_storefront ON profiles(active_storefront_id)
  WHERE active_storefront_id IS NOT NULL;
```

**Migration-safety note:** This `ALTER TABLE` adds a nullable column with no default — it acquires a brief `ACCESS EXCLUSIVE` lock but does not rewrite the table in PostgreSQL 11+. Safe to run on a live database.

#### `0012_products.sql`

Depends on: `0010_storefronts`, `0003_types` (listing_status).

```sql
CREATE TABLE products (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Ownership hierarchy
  storefront_id   BIGINT NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  owner_id        UUID   NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,

  -- Identity
  name            VARCHAR(300) NOT NULL,
  slug            VARCHAR(300) NOT NULL,
  description     TEXT,
  price           NUMERIC(12,0),          -- VND (no decimals needed)
  price_note      VARCHAR(100),           -- "per kg", "per day", negotiable

  -- Geography (denormalized from storefront for direct geo-queries)
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  district_id     INTEGER  NOT NULL REFERENCES districts(id),

  -- Lifecycle
  status          listing_status NOT NULL DEFAULT 'draft',
  published_at    TIMESTAMPTZ,

  -- Search
  search_vector   TSVECTOR,

  -- cover_image_id intentionally omitted — added in 0016

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(storefront_id, slug)
);

CREATE INDEX idx_products_storefront  ON products(storefront_id);
CREATE INDEX idx_products_owner       ON products(owner_id);
CREATE INDEX idx_products_province    ON products(province_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_district    ON products(district_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_search      ON products USING GIN(search_vector);
CREATE INDEX idx_products_published   ON products(storefront_id, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

#### `0013_services.sql`

Depends on: `0010_storefronts`, `0008_communes`, `0003_types` (listing_status, service_coverage).

```sql
CREATE TABLE services (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  storefront_id   BIGINT NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  owner_id        UUID   NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,

  name            VARCHAR(300) NOT NULL,
  slug            VARCHAR(300) NOT NULL,
  description     TEXT,
  price           NUMERIC(12,0),
  price_note      VARCHAR(100),

  -- Service-specific: coverage area
  coverage        service_coverage NOT NULL DEFAULT 'district',
  coverage_radius_km INTEGER,             -- For custom radius

  -- Primary location
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  district_id     INTEGER  NOT NULL REFERENCES districts(id),
  commune_id      INTEGER  REFERENCES communes(id),

  status          listing_status NOT NULL DEFAULT 'draft',
  published_at    TIMESTAMPTZ,
  search_vector   TSVECTOR,

  -- cover_image_id intentionally omitted — added in 0016

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(storefront_id, slug)
);

CREATE INDEX idx_services_storefront ON services(storefront_id);
CREATE INDEX idx_services_district   ON services(district_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_search     ON services USING GIN(search_vector);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
```

#### `0014_land_listings.sql`

Depends on: `0004_profiles`, `0007_districts`, `0008_communes`, `0003_types` (listing_status, land_type).

Land listings can exist independently of a storefront — a private individual can list land without having a storefront.

```sql
CREATE TABLE land_listings (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Owner may or may not have a storefront
  owner_id        UUID   NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  storefront_id   BIGINT REFERENCES storefronts(id) ON DELETE SET NULL,  -- optional

  -- Land-specific
  land_type       land_type NOT NULL DEFAULT 'other',
  area_m2         NUMERIC(12,2),
  title           VARCHAR(300) NOT NULL,
  slug            VARCHAR(300) NOT NULL,
  description     TEXT,
  price           NUMERIC(15,0),          -- Total price in VND
  price_per_m2    NUMERIC(12,0),
  is_negotiable   BOOLEAN NOT NULL DEFAULT true,

  -- Geography
  province_id     SMALLINT NOT NULL REFERENCES provinces(id),
  district_id     INTEGER  NOT NULL REFERENCES districts(id),
  commune_id      INTEGER  REFERENCES communes(id),
  location        GEOGRAPHY(Point, 4326),
  address_text    TEXT,

  status          listing_status NOT NULL DEFAULT 'draft',
  published_at    TIMESTAMPTZ,
  search_vector   TSVECTOR,

  -- cover_image_id intentionally omitted — added in 0016

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(district_id, slug)
);

CREATE INDEX idx_land_owner     ON land_listings(owner_id);
CREATE INDEX idx_land_district  ON land_listings(district_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_type      ON land_listings(land_type, province_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_land_location  ON land_listings USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX idx_land_search    ON land_listings USING GIN(search_vector);

CREATE TRIGGER trg_land_updated_at
  BEFORE UPDATE ON land_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE land_listings ENABLE ROW LEVEL SECURITY;
```

---

### PHASE 6 — Media

#### `0015_images.sql`

Depends on: `0010_storefronts`, `0012_products`, `0013_services`, `0014_land_listings`.

All four commerce entity tables must exist before `images` can reference them.

**Pattern decision — nullable multi-FK over polymorphic:**

```
Option A (polymorphic):  entity_type + entity_id
  ✗ No FK constraint possible — referential integrity lost
  ✗ Cascading deletes require triggers

Option B (nullable multi-FK):  storefront_id | product_id | service_id | land_listing_id
  ✓ Full FK constraint on each column
  ✓ Cascades to the correct table
  ✓ CHECK constraint enforces exactly one is non-null
  ✓ Index each column separately

Option C (separate junction tables):  storefront_images, product_images, etc.
  ✓ Perfect isolation
  ✗ Duplicates columns (url, category, sort_order) 4 times
  ✗ Makes "find all images for user" queries harder

Recommendation for VIO LOCAL: Option B (nullable multi-FK)
```

```sql
CREATE TABLE images (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Uploaded by
  uploaded_by     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,

  -- Entity ownership — exactly one must be non-null
  storefront_id   BIGINT REFERENCES storefronts(id)    ON DELETE CASCADE,
  product_id      BIGINT REFERENCES products(id)       ON DELETE CASCADE,
  service_id      BIGINT REFERENCES services(id)       ON DELETE CASCADE,
  land_listing_id BIGINT REFERENCES land_listings(id)  ON DELETE CASCADE,

  -- Storage
  storage_path    TEXT NOT NULL,          -- Supabase Storage path
  url             TEXT NOT NULL,          -- Public CDN URL
  width           INTEGER,
  height          INTEGER,
  size_bytes      INTEGER,
  mime_type       VARCHAR(50),

  -- Classification
  category        image_category NOT NULL DEFAULT 'gallery',
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  alt_text        VARCHAR(300),
  is_cover        BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforce exactly one entity FK is non-null
  CONSTRAINT images_entity_check CHECK (
    (storefront_id   IS NOT NULL)::int +
    (product_id      IS NOT NULL)::int +
    (service_id      IS NOT NULL)::int +
    (land_listing_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_images_storefront   ON images(storefront_id)   WHERE storefront_id   IS NOT NULL;
CREATE INDEX idx_images_product      ON images(product_id)      WHERE product_id      IS NOT NULL;
CREATE INDEX idx_images_service      ON images(service_id)      WHERE service_id      IS NOT NULL;
CREATE INDEX idx_images_land         ON images(land_listing_id) WHERE land_listing_id IS NOT NULL;
CREATE INDEX idx_images_uploader     ON images(uploaded_by);
CREATE INDEX idx_images_cover        ON images(storefront_id, is_cover) WHERE is_cover AND storefront_id IS NOT NULL;

ALTER TABLE images ENABLE ROW LEVEL SECURITY;
```

#### `0016_entity_cover_fks.sql` *(OPTIONAL — Phase 1 can skip)*

**Resolves Cycle B.** Only run this if you need `cover_image_id` as a database-enforced FK for performance (avoids the `WHERE is_cover = true` join).

```sql
-- Defer until images table is confirmed stable and populated
ALTER TABLE storefronts   ADD COLUMN cover_image_id BIGINT REFERENCES images(id) ON DELETE SET NULL;
ALTER TABLE products      ADD COLUMN cover_image_id BIGINT REFERENCES images(id) ON DELETE SET NULL;
ALTER TABLE services      ADD COLUMN cover_image_id BIGINT REFERENCES images(id) ON DELETE SET NULL;
ALTER TABLE land_listings ADD COLUMN cover_image_id BIGINT REFERENCES images(id) ON DELETE SET NULL;
```

**Note:** Without this migration, derive the cover image with:

```sql
SELECT i.* FROM images i
WHERE i.storefront_id = $id AND i.is_cover = true
LIMIT 1;
```

This is simpler, avoids the circular dependency entirely, and is fast with the `idx_images_cover` index above.

---

### PHASE 7 — Social Layer

Both `saved_items` and `inquiries` are pure leaf nodes — they reference existing tables and nothing references them.

#### `0017_saved_items.sql`

Depends on: `0004_profiles`, `0010_storefronts`, `0012_products`, `0013_services`, `0014_land_listings`.

```sql
CREATE TABLE saved_items (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  -- Exactly one entity FK must be non-null (same pattern as images)
  storefront_id   BIGINT REFERENCES storefronts(id)    ON DELETE CASCADE,
  product_id      BIGINT REFERENCES products(id)       ON DELETE CASCADE,
  service_id      BIGINT REFERENCES services(id)       ON DELETE CASCADE,
  land_listing_id BIGINT REFERENCES land_listings(id)  ON DELETE CASCADE,

  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT saved_items_entity_check CHECK (
    (storefront_id   IS NOT NULL)::int +
    (product_id      IS NOT NULL)::int +
    (service_id      IS NOT NULL)::int +
    (land_listing_id IS NOT NULL)::int = 1
  ),

  -- A user can only save the same item once
  UNIQUE NULLS NOT DISTINCT (user_id, storefront_id),
  UNIQUE NULLS NOT DISTINCT (user_id, product_id),
  UNIQUE NULLS NOT DISTINCT (user_id, service_id),
  UNIQUE NULLS NOT DISTINCT (user_id, land_listing_id)
);

CREATE INDEX idx_saved_user         ON saved_items(user_id, saved_at DESC);
CREATE INDEX idx_saved_storefront   ON saved_items(storefront_id)   WHERE storefront_id   IS NOT NULL;
CREATE INDEX idx_saved_product      ON saved_items(product_id)      WHERE product_id      IS NOT NULL;
CREATE INDEX idx_saved_service      ON saved_items(service_id)      WHERE service_id      IS NOT NULL;
CREATE INDEX idx_saved_land         ON saved_items(land_listing_id) WHERE land_listing_id IS NOT NULL;

ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
```

**PostgreSQL version note:** `UNIQUE NULLS NOT DISTINCT` requires PostgreSQL 15+. Supabase runs PostgreSQL 15. If targeting an older version, enforce uniqueness per entity via partial unique indexes:

```sql
CREATE UNIQUE INDEX ON saved_items(user_id, storefront_id)   WHERE storefront_id   IS NOT NULL;
CREATE UNIQUE INDEX ON saved_items(user_id, product_id)      WHERE product_id      IS NOT NULL;
CREATE UNIQUE INDEX ON saved_items(user_id, service_id)      WHERE service_id      IS NOT NULL;
CREATE UNIQUE INDEX ON saved_items(user_id, land_listing_id) WHERE land_listing_id IS NOT NULL;
```

#### `0018_inquiries.sql`

Depends on: `0004_profiles`, all four commerce entity tables.

```sql
CREATE TABLE inquiries (
  id              BIGSERIAL PRIMARY KEY,
  public_id       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Who sent it
  sender_id       UUID NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,

  -- Who receives it (derived from entity, but cached for easy joins)
  recipient_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,

  -- What it's about — exactly one non-null
  storefront_id   BIGINT REFERENCES storefronts(id)    ON DELETE SET NULL,
  product_id      BIGINT REFERENCES products(id)       ON DELETE SET NULL,
  service_id      BIGINT REFERENCES services(id)       ON DELETE SET NULL,
  land_listing_id BIGINT REFERENCES land_listings(id)  ON DELETE SET NULL,

  -- Content
  message         TEXT NOT NULL,
  status          inquiry_status NOT NULL DEFAULT 'open',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT inquiries_entity_check CHECK (
    (storefront_id   IS NOT NULL)::int +
    (product_id      IS NOT NULL)::int +
    (service_id      IS NOT NULL)::int +
    (land_listing_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_inquiries_sender     ON inquiries(sender_id,    created_at DESC);
CREATE INDEX idx_inquiries_recipient  ON inquiries(recipient_id, created_at DESC);
CREATE INDEX idx_inquiries_storefront ON inquiries(storefront_id)   WHERE storefront_id   IS NOT NULL;
CREATE INDEX idx_inquiries_product    ON inquiries(product_id)      WHERE product_id      IS NOT NULL;
CREATE INDEX idx_inquiries_status     ON inquiries(status) WHERE status = 'open';

CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
```

**`ON DELETE SET NULL` rationale for inquiries:** If a listing is deleted, the inquiry record is preserved so the conversation history isn't lost. The entity FK becomes NULL, but the message thread survives.

---

### PHASE 8 — RLS Policies

**Core principle:** `ENABLE ROW LEVEL SECURITY` (done in Phase 5–7) and `CREATE POLICY` are separate operations. With RLS enabled but no policies defined, all access is denied. This is the safe default — policies unlock access; they do not grant it by default.

Add policies in the same dependency order as the tables they govern.

#### `0019_rls_profiles.sql`

```sql
-- Anyone can read non-deleted profiles (public marketplace)
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  USING (deleted_at IS NULL);

-- Users manage only their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Insert handled by Supabase Auth trigger (not direct INSERT)
-- Admin bypass uses service role (bypasses RLS entirely)
```

#### `0020_rls_storefronts.sql`

```sql
-- Public can read published storefronts
CREATE POLICY "storefronts_select_published"
  ON storefronts FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

-- Owner can read all their own storefronts (including drafts)
CREATE POLICY "storefronts_select_own"
  ON storefronts FOR SELECT
  USING (owner_id = auth.uid());

-- Only merchants/admins can create storefronts
CREATE POLICY "storefronts_insert_merchant"
  ON storefronts FOR INSERT
  WITH CHECK (auth.is_merchant() AND owner_id = auth.uid());

-- Owner can update their own storefronts
CREATE POLICY "storefronts_update_own"
  ON storefronts FOR UPDATE
  USING (owner_id = auth.uid());

-- Owner can soft-delete (via UPDATE setting deleted_at); hard DELETE admin only
CREATE POLICY "storefronts_delete_admin"
  ON storefronts FOR DELETE
  USING (auth.is_admin());
```

#### `0021_rls_products.sql`, `0022_rls_services.sql`

Apply the same pattern as storefronts. Key difference: ownership is checked against `owner_id` (denormalized), not via a JOIN to storefronts (prevents N+1 in policy evaluation).

```sql
-- Public read
CREATE POLICY "products_select_published"
  ON products FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

-- Owner full access
CREATE POLICY "products_select_own"  ON products FOR SELECT  USING (owner_id = auth.uid());
CREATE POLICY "products_insert_own"  ON products FOR INSERT  WITH CHECK (auth.is_merchant() AND owner_id = auth.uid());
CREATE POLICY "products_update_own"  ON products FOR UPDATE  USING (owner_id = auth.uid());
CREATE POLICY "products_delete_admin" ON products FOR DELETE USING (auth.is_admin());
```

#### `0023_rls_land_listings.sql`

Same pattern. No merchant role requirement — any verified user can list land.

```sql
CREATE POLICY "land_select_published"
  ON land_listings FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "land_select_own"
  ON land_listings FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "land_insert_own"
  ON land_listings FOR INSERT
  WITH CHECK (owner_id = auth.uid());   -- any verified user, not just merchants

CREATE POLICY "land_update_own"
  ON land_listings FOR UPDATE
  USING (owner_id = auth.uid());
```

#### `0024_rls_images.sql`

Images inherit visibility from their parent entity. The policy checks parent status without a JOIN by relying on the entity FK index.

```sql
-- Read: image is visible if its parent entity is published
CREATE POLICY "images_select_public"
  ON images FOR SELECT
  USING (
    (storefront_id   IS NOT NULL AND EXISTS (
      SELECT 1 FROM storefronts   WHERE id = storefront_id   AND status = 'published' AND deleted_at IS NULL)) OR
    (product_id      IS NOT NULL AND EXISTS (
      SELECT 1 FROM products      WHERE id = product_id      AND status = 'published' AND deleted_at IS NULL)) OR
    (service_id      IS NOT NULL AND EXISTS (
      SELECT 1 FROM services      WHERE id = service_id      AND status = 'published' AND deleted_at IS NULL)) OR
    (land_listing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM land_listings WHERE id = land_listing_id AND status = 'published' AND deleted_at IS NULL))
  );

-- Uploader can always see their own images
CREATE POLICY "images_select_own"
  ON images FOR SELECT
  USING (uploaded_by = auth.uid());

-- Only uploader can insert/delete
CREATE POLICY "images_insert_own"
  ON images FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "images_delete_own"
  ON images FOR DELETE
  USING (uploaded_by = auth.uid());
```

#### `0025_rls_saved_items.sql`

```sql
-- Users only see their own saved items
CREATE POLICY "saved_select_own"  ON saved_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "saved_insert_own"  ON saved_items FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "saved_delete_own"  ON saved_items FOR DELETE USING (user_id = auth.uid());
```

#### `0026_rls_inquiries.sql`

```sql
-- Sender and recipient can read
CREATE POLICY "inquiries_select_parties"
  ON inquiries FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Anyone authenticated can open an inquiry
CREATE POLICY "inquiries_insert_auth"
  ON inquiries FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND auth.uid() IS NOT NULL);

-- Only recipient can update status
CREATE POLICY "inquiries_update_recipient"
  ON inquiries FOR UPDATE
  USING (recipient_id = auth.uid());
```

---

### PHASE 9 — Seed Data

Seed data runs in the same dependency order as its tables. All seeds are pure reference data with no user dependency.

```
0027_seed_provinces.sql       — INSERT 63 provinces (GSO codes)
0028_seed_districts.sql       — INSERT ~700 districts
0029_seed_communes.sql        — INSERT ~11,000 communes
0030_seed_geographic_aliases.sql  — INSERT Sài Gòn, TPHCM, etc.
```

**Seed data is idempotent:**

```sql
INSERT INTO provinces (...) VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  updated_at = now();
```

Use `ON CONFLICT DO UPDATE` (upsert) so seeds can be re-run safely after boundary updates without failing on duplicate key violations.

---

## 4. MIGRATION FILE REFERENCE

Full ordered list. Run in sequence. Never skip.

```
supabase/migrations/
├── 0001_extensions.sql
├── 0002_utility_functions.sql
├── 0003_types.sql
├── 0004_profiles.sql
├── 0005_roles.sql
├── 0006_provinces.sql
├── 0007_districts.sql
├── 0008_communes.sql
├── 0009_geographic_aliases.sql
├── 0010_storefronts.sql
├── 0011_profiles_storefront_fk.sql   ← resolves Cycle A
├── 0012_products.sql
├── 0013_services.sql
├── 0014_land_listings.sql
├── 0015_images.sql
├── 0016_entity_cover_fks.sql         ← resolves Cycle B (OPTIONAL)
├── 0017_saved_items.sql
├── 0018_inquiries.sql
├── 0019_rls_profiles.sql
├── 0020_rls_storefronts.sql
├── 0021_rls_products.sql
├── 0022_rls_services.sql
├── 0023_rls_land_listings.sql
├── 0024_rls_images.sql
├── 0025_rls_saved_items.sql
├── 0026_rls_inquiries.sql
├── 0027_seed_provinces.sql
├── 0028_seed_districts.sql
├── 0029_seed_communes.sql
└── 0030_seed_geographic_aliases.sql
```

---

## 5. ANTI-PATTERNS THIS ORDER PREVENTS

| Anti-pattern | How this order prevents it |
|---|---|
| `profiles` references `storefronts` before it exists | Cycle A: profiles created without the FK; ALTER added in 0011 after storefronts exists |
| `images` references entity tables before they exist | images (0015) runs after all 4 entity tables (0010–0014) |
| Entity tables reference `images.id` before images exists | Optional cover FK (0016) runs after images; Phase 1 skips it entirely |
| RLS policy calls `auth.is_merchant()` before function exists | Role helpers created in 0005, long before any RLS migration |
| Seeding districts before provinces | Province seed (0027) always precedes district seed (0028) |
| Enabling RLS blocks service-role seeds | Seeds run via service role, which bypasses RLS entirely |
| Enum type used before it's created | All enums defined in 0003 before any table uses them |
| `geographic_aliases` FK to `communes` before communes exists | aliases (0009) follows communes (0008) |

---

## 6. SCALABILITY NOTES

### When to add the next phase of migrations

| Trigger | Next migration |
|---|---|
| Products/services need categories | `0031_categories.sql` → junction `0032_product_categories.sql` |
| Need reviews/ratings | `0033_reviews.sql` (depends on storefronts + profiles) |
| Need transactions/orders | `0034_orders.sql` (depends on products + services) |
| Need messaging threads | `0035_threads.sql` + `0036_messages.sql` |
| Need analytics events | `0037_events.sql` (no FKs — pure append log) |

All future migrations follow the same rule: **reference tables come before the tables that reference them.**

### Index maintenance (post-seed)

After bulk loading 11,000 communes, run:

```sql
ANALYZE provinces;
ANALYZE districts;
ANALYZE communes;
VACUUM ANALYZE storefronts;
```

Geographic GIST indexes build incrementally but benefit from `ANALYZE` after large inserts.

---

## 7. IMPLEMENTATION CHECKLIST

Use this to verify each phase is complete before moving to the next.

```
PHASE 1 — INFRASTRUCTURE
  [ ] 0001 extensions installed and verified (SELECT PostGIS_Version())
  [ ] 0002 slugify() and update_updated_at() functions exist
  [ ] 0003 all enums created (SELECT * FROM pg_type WHERE typtype = 'e')

PHASE 2 — IDENTITY
  [ ] 0004 profiles table created
  [ ] profiles.active_storefront_id column ABSENT (not yet)
  [ ] RLS enabled on profiles

PHASE 3 — ROLES
  [ ] 0005 auth.is_merchant(), auth.is_admin(), auth.current_role() exist
  [ ] role_audit table created

PHASE 4 — GEOGRAPHIC
  [ ] 0006–0008 three geographic tables created
  [ ] 0009 geographic_aliases created with CHECK constraint
  [ ] All GIST indexes confirmed (SELECT * FROM pg_indexes WHERE tablename = 'provinces')

PHASE 5 — COMMERCE ENTITIES
  [ ] 0010 storefronts created (no cover_image_id)
  [ ] 0011 profiles.active_storefront_id FK added
  [ ] 0012 products created (no cover_image_id)
  [ ] 0013 services created (no cover_image_id)
  [ ] 0014 land_listings created (no cover_image_id)
  [ ] RLS enabled on all four tables

PHASE 6 — MEDIA
  [ ] 0015 images created with CHECK constraint (exactly 1 entity FK)
  [ ] 0016 entity cover FKs added (OR explicitly skipped for Phase 1)
  [ ] RLS enabled on images

PHASE 7 — SOCIAL
  [ ] 0017 saved_items with uniqueness constraints
  [ ] 0018 inquiries created
  [ ] RLS enabled on both

PHASE 8 — RLS
  [ ] 0019–0026 all 8 RLS policy migrations applied
  [ ] Test: anon user cannot INSERT into storefronts
  [ ] Test: merchant can INSERT into storefronts with own owner_id
  [ ] Test: buyer cannot see draft listings
  [ ] Test: saved_items user A cannot see user B's saved items
  [ ] Test: auth.is_merchant() returns correct value for each role

PHASE 9 — SEEDS
  [ ] 0027 63 provinces seeded
  [ ] 0028 ~700 districts seeded
  [ ] 0029 ~11,000 communes seeded
  [ ] 0030 geographic aliases seeded
  [ ] Verify: SELECT COUNT(*) FROM provinces → 63
  [ ] Verify: SELECT COUNT(*) FROM districts → ~700
  [ ] Verify: SELECT COUNT(*) FROM communes  → ~11,000
```

---

**END OF DB_IMPLEMENTATION_ORDER.md v1.0**

*The ordering in this document is not a suggestion — it is the only safe order. Every deviation either breaks a FK constraint, silently removes RLS protection, or creates a circular dependency that requires a destructive rollback to fix.*
