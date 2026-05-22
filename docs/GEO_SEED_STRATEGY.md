# VIO LOCAL — GEO SEED STRATEGY
**Safe seeding of Vietnam geographic data for a hyperlocal commerce platform**

---

## 0. SCOPE

This document covers how to seed the `provinces`, `districts`, `wards`, and
`geographic_aliases` tables safely, idempotently, and in a way that survives
future administrative reorganisations without breaking SEO.

**Phase 1 rollout — 4 provinces only:**

| Province | GSO Code | Type | Approx. Districts | Approx. Wards |
|---|---|---|---|---|
| Đắk Lắk | 66 | Tỉnh | 15 | ~184 |
| Lâm Đồng | 68 | Tỉnh | 12 | ~147 |
| Bình Phước | 70 | Tỉnh | 12 | ~113 |
| Đồng Nai | 75 | Tỉnh | 12 | ~171 |

**Why these 4:** Central Highlands + Southeast Vietnam. Agricultural, rural commerce
focus. Manageable scope for quality-over-quantity Phase 1. All share a regional
cluster which enables contiguous geographic discovery later.

---

## 1. SEEDING ORDER

Respect the FK chain. Never skip levels.

```
1. provinces           (no deps)
2. districts           (depends on provinces)
3. wards               (depends on districts + provinces)
4. geographic_aliases  (depends on all three above)
```

Run each level fully before the next. A partial insert at level N will cause FK
violations at level N+1.

---

## 2. SLUG GENERATION STRATEGY

### 2.1 The Algorithm

Every slug is produced by `public.slugify_vn()`:

```
input          → trim whitespace
unaccent()     → strip diacritics  (à→a, ô→o, ư→u, ề→e …)
replace Đ → D  → unaccent misses the crossbar D
replace đ → d
lower()        → "Tinh Dong Nai" → "tinh dong nai"
regexp_replace → replace [^a-z0-9]+ with "-"
trim hyphens   → remove leading/trailing hyphens
```

### 2.2 Examples

| Input | Slug |
|---|---|
| Tỉnh Đồng Nai | tinh-dong-nai |
| Đồng Nai | dong-nai |
| Huyện Tân Phú | huyen-tan-phu |
| Xã Tân Phú | xa-tan-phu |
| Thành phố Buôn Ma Thuột | thanh-pho-buon-ma-thuot |
| Phường Ea Tam | phuong-ea-tam |

### 2.3 Slug Scope Rules

| Level | Slug uniqueness | Constraint |
|---|---|---|
| Province | Global | `UNIQUE(slug)` |
| District | Within province | `UNIQUE(province_id, slug)` |
| Ward | Within district | `UNIQUE(district_id, slug)` |

A district named "Tân Phú" exists in both Đồng Nai and Thành phố Hồ Chí Minh.
Both get slug `tan-phu` — no conflict because scope is per-province.

### 2.4 Slug for "name" vs "name_full"

Always slug the **short name** (`name`), not `name_full`:

```
name:      "Tân Phú"         → slug: "tan-phu"   ✓
name_full: "Huyện Tân Phú"  → slug: "huyen-tan-phu"  (too long, type prefix clutters URL)
```

Exception: if the short name alone collides within scope, use the full name slug.
This is rare. Document it in `geographic_aliases` with `reason = 'slug-collision'`.

### 2.5 Collision Handling

If two entities at the same level have the same slug within scope:

```
1st entry → "tan-phu"
2nd entry → "tan-phu-2"    (append counter)
3rd entry → "tan-phu-3"
```

Add the original slug as an alias pointing to the primary entity:

```sql
INSERT INTO geographic_aliases (entity_type, district_id, alias_name, alias_slug, reason)
VALUES ('district', <id_of_tan-phu-2>, 'Tân Phú', 'tan-phu', 'slug-collision');
```

---

## 3. SEEDING PATTERN — IDEMPOTENT UPSERTS

Every seed file uses `INSERT ... ON CONFLICT DO UPDATE` so it can be re-run after
administrative changes without errors.

### 3.1 Provinces

```sql
INSERT INTO public.provinces (id, name, name_full, slug, type, region, lat, lng)
VALUES
  (66, 'Đắk Lắk',   'Tỉnh Đắk Lắk',    'dak-lak',     'tinh', 'nam',   12.6667, 108.0500),
  (68, 'Lâm Đồng',  'Tỉnh Lâm Đồng',   'lam-dong',    'tinh', 'nam',   11.5753, 108.1429),
  (70, 'Bình Phước', 'Tỉnh Bình Phước', 'binh-phuoc',  'tinh', 'nam',   11.7512, 106.7235),
  (75, 'Đồng Nai',  'Tỉnh Đồng Nai',   'dong-nai',    'tinh', 'nam',   11.0686, 107.1676)
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  name_full  = EXCLUDED.name_full,
  slug       = EXCLUDED.slug,
  type       = EXCLUDED.type,
  region     = EXCLUDED.region,
  lat        = EXCLUDED.lat,
  lng        = EXCLUDED.lng,
  updated_at = now();
```

### 3.2 Districts (example — Đồng Nai)

```sql
INSERT INTO public.districts (id, province_id, name, name_full, slug, type, lat, lng)
VALUES
  (731, 75, 'Biên Hòa',   'Thành phố Biên Hòa', 'bien-hoa',  'thanh-pho', 10.9574, 106.8426),
  (732, 75, 'Long Khánh', 'Thành phố Long Khánh','long-khanh','thanh-pho', 10.9319, 107.2413),
  (734, 75, 'Tân Phú',    'Huyện Tân Phú',       'tan-phu',   'huyen',     11.3261, 107.3822),
  -- ... all districts for this province
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  name_full  = EXCLUDED.name_full,
  slug       = EXCLUDED.slug,
  type       = EXCLUDED.type,
  lat        = EXCLUDED.lat,
  lng        = EXCLUDED.lng,
  updated_at = now();
```

### 3.3 Wards (example — Huyện Tân Phú, Đồng Nai)

```sql
INSERT INTO public.wards (id, district_id, province_id, name, name_full, slug, type)
VALUES
  (27373, 734, 75, 'Tân Phú',    'Thị trấn Tân Phú',  'thi-tran-tan-phu', 'thi-tran'),
  (27376, 734, 75, 'Dak Lua',    'Xã Dak Lua',         'dak-lua',          'xa'),
  (27379, 734, 75, 'Nam Cát Tiên','Xã Nam Cát Tiên',   'nam-cat-tien',     'xa'),
  -- ...
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  name_full  = EXCLUDED.name_full,
  slug       = EXCLUDED.slug,
  type       = EXCLUDED.type,
  updated_at = now();
```

**IMPORTANT:** `slug` is NOT included in the ON CONFLICT SET for wards and districts
after launch. Changing a live slug breaks SEO. Use the alias system instead.
See Section 7.

---

## 4. ALIAS STRATEGY

### 4.1 When to Create an Alias

Create an alias whenever:

| Situation | Alias reason |
|---|---|
| Entity has a well-known colloquial name | `colloquial` |
| Entity has a common abbreviation | `abbreviation` |
| Entity was renamed or reorganised | `old-name` / `historical` |
| A common misspelling should resolve | `misspelling` |
| A slug collision was resolved with `-2` suffix | `slug-collision` |

### 4.2 Seed Aliases (Phase 1 examples)

```sql
INSERT INTO public.geographic_aliases
  (entity_type, province_id, alias_name, alias_slug, reason)
VALUES
  -- Đắk Lắk variants
  ('province', 66, 'Đắc Lắc',  'dac-lac',  'misspelling'),
  ('province', 66, 'Đắk Lắc',  'dak-lac',  'misspelling'),
  ('province', 66, 'Đắk Lắk',  'dak-lak',  'colloquial'),  -- already canonical but useful for search

  -- Bình Phước
  ('province', 70, 'Bình Phượt','binh-phuot','misspelling'),

  -- Lâm Đồng — Đà Lạt is more famous than the province name
  ('province', 68, 'Đà Lạt',   'da-lat',   'colloquial')   -- redirects to /lam-dong
ON CONFLICT DO NOTHING;
```

### 4.3 Alias Rules

- `alias_slug` must never equal the entity's canonical `slug` (no point)
- Never update `alias_slug` after creation — deactivate (`is_active = false`) and
  create a new row instead
- A single entity can have multiple active aliases (all redirect to the same canonical slug)
- Aliases do NOT have their own pages — they are redirect-only entries

---

## 5. DUPLICATE PREVENTION

### 5.1 GSO Code as PK

Using the government GSO code as the PK makes duplicates structurally impossible at the
database level. You cannot `INSERT` a second province with `id = 75`.

### 5.2 Slug Uniqueness

- Province slugs: `UNIQUE(slug)` on the table
- District slugs: `UNIQUE(province_id, slug)` — scoped
- Ward slugs: `UNIQUE(district_id, slug)` — scoped

Any attempt to insert a duplicate slug within scope raises a constraint violation before
reaching application logic.

### 5.3 Alias Uniqueness

There is no unique constraint on `alias_slug` in `geographic_aliases`. The same alias
slug can point to multiple entities (e.g., multiple districts named "Tân Phú"). The
redirect resolver handles this by combining `entity_type` + `alias_slug` in the lookup:

```sql
SELECT province_id, district_id, ward_id
FROM geographic_aliases
WHERE alias_slug = :slug
  AND entity_type = :type
  AND is_active = true
LIMIT 1;
```

---

## 6. UPDATE STRATEGY

After data is live, never silently UPDATE a slug. Follow this procedure:

### 6.1 Correcting a typo (pre-launch)

If no SEO traffic exists yet, UPDATE the slug directly:

```sql
UPDATE public.districts
SET slug = 'corrected-slug', updated_at = now()
WHERE id = :id;
```

### 6.2 Renaming an entity (post-launch)

1. Keep the current canonical slug as-is
2. Update `name` and `name_full` for display
3. Optionally: create an alias with `reason = 'old-name'` for the previous display name

```sql
-- Step 1: Update display name only
UPDATE public.districts
SET name = 'New Name', name_full = 'Huyện New Name', updated_at = now()
WHERE id = :id;

-- Step 2: Preserve old name in aliases for search
INSERT INTO public.geographic_aliases (entity_type, district_id, alias_name, alias_slug, reason)
VALUES ('district', :id, 'Old Name', 'old-name', 'old-name')
ON CONFLICT DO NOTHING;
```

### 6.3 Migrating a canonical slug (post-launch, SEO-impacting)

Only do this if the old slug is actively harmful (misspelling on homepage URL):

1. Create an alias with the old slug (reason: `'old-name'`)
2. Change the canonical slug in the main table
3. Confirm the 301 redirect resolver picks up the alias (Section 7)
4. Monitor Search Console for redirect signals (allow 2–4 weeks)

---

## 7. ADMINISTRATIVE CHANGE STRATEGY

Vietnam reorganises administrative boundaries periodically. Common scenarios:

### 7.1 District Renamed

```sql
-- 1. Update display name
UPDATE districts SET name = 'New District Name', name_full = 'Huyện New District Name'
WHERE id = :id;

-- 2. Add alias for old name (redirects old URLs)
INSERT INTO geographic_aliases (entity_type, district_id, alias_name, alias_slug, reason)
VALUES ('district', :id, 'Old District Name', 'old-slug', 'old-name');
```

### 7.2 District Split into Two

```sql
-- 1. Insert the two new districts
INSERT INTO districts (id, province_id, name, ...) VALUES (:new_id_1, ...), (:new_id_2, ...);

-- 2. Add alias from old slug → primary successor (the larger / more prominent one)
INSERT INTO geographic_aliases (entity_type, district_id, alias_name, alias_slug, reason)
VALUES ('district', :new_id_1, 'Old District Name', 'old-district-slug', 'historical');

-- 3. Reassign wards to new districts
UPDATE wards SET district_id = :new_id_1 WHERE id IN (...);
UPDATE wards SET district_id = :new_id_2 WHERE id IN (...);

-- 4. Deactivate old district (do NOT delete — FK cascade would wipe all wards)
-- Add a note: consider a soft-delete column for districts if this becomes frequent
```

### 7.3 Two Districts Merged

```sql
-- 1. The surviving district keeps its ID
-- 2. Add alias from the absorbed district's slug to the surviving one
INSERT INTO geographic_aliases (entity_type, district_id, alias_name, alias_slug, reason)
VALUES ('district', :surviving_id, 'Absorbed District', 'absorbed-slug', 'historical');

-- 3. Reassign wards from absorbed district to surviving district
UPDATE wards SET district_id = :surviving_id WHERE district_id = :absorbed_id;

-- 4. The absorbed district row can stay (it has no more wards) — deactivate instead of delete
```

---

## 8. SEO REDIRECT STRATEGY

The redirect resolver runs in the application layer (TanStack Start middleware or loader).

### 8.1 Resolver Logic

```typescript
// Called when /:province or /:province/:district does not match a canonical slug

async function resolveGeoSlug(type: 'province' | 'district' | 'ward', slug: string, parentId?: number) {
  // Step 1: Try canonical match (fast path)
  const canonical = await db
    .from(type + 's')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (canonical) return { entity: canonical, redirect: false }

  // Step 2: Try alias lookup (redirect path)
  const alias = await db
    .from('geographic_aliases')
    .select('province_id, district_id, ward_id')
    .eq('alias_slug', slug)
    .eq('entity_type', type)
    .eq('is_active', true)
    .maybeSingle()

  if (!alias) return null    // 404

  const entityId = alias.province_id ?? alias.district_id ?? alias.ward_id

  const entity = await db
    .from(type + 's')
    .select('id, slug')
    .eq('id', entityId)
    .single()

  return { entity, redirect: true }   // caller issues 301
}
```

### 8.2 HTTP Response

```
Old URL:  /sai-gon              (alias)  → 301 → /ho-chi-minh-city
Old URL:  /dong-nai/huyen-tan-phu        → 301 → /dong-nai/tan-phu
Not found: /dong-nai/fake-slug           → 404
```

Always use **301 Permanent** for geographic redirects, never 302.
301 transfers PageRank; 302 does not.

### 8.3 What NOT to Cache

Never cache a 301 for more than 1 year. If you later split a district and the alias
becomes ambiguous, you need browsers to re-request.

---

## 9. IMPORT VALIDATION STRATEGY

Run these checks after every seed run.

### 9.1 Structural Checks

```sql
-- No district without a province
SELECT d.id, d.name FROM districts d
LEFT JOIN provinces p ON d.province_id = p.id
WHERE p.id IS NULL;
-- Expected: 0 rows

-- No ward without a district
SELECT w.id, w.name FROM wards w
LEFT JOIN districts d ON w.district_id = d.id
WHERE d.id IS NULL;
-- Expected: 0 rows

-- No ward whose province_id disagrees with its district's province
SELECT w.id, w.name
FROM wards w
JOIN districts d ON w.district_id = d.id
WHERE w.province_id != d.province_id;
-- Expected: 0 rows (denormalized province_id must match)
```

### 9.2 Slug Integrity

```sql
-- Duplicate province slugs (should be impossible via UNIQUE constraint,
-- but good to verify after any manual updates)
SELECT slug, count(*) FROM provinces GROUP BY slug HAVING count(*) > 1;

-- Duplicate district slugs within same province
SELECT province_id, slug, count(*)
FROM districts
GROUP BY province_id, slug
HAVING count(*) > 1;

-- Duplicate ward slugs within same district
SELECT district_id, slug, count(*)
FROM wards
GROUP BY district_id, slug
HAVING count(*) > 1;
```

### 9.3 Count Checks

Run before and after seeding. Compare against official GSO data.

```sql
SELECT
  p.name,
  count(distinct d.id)  as district_count,
  count(distinct w.id)  as ward_count
FROM provinces p
LEFT JOIN districts d ON d.province_id = p.id
LEFT JOIN wards     w ON w.province_id = p.id
WHERE p.id IN (66, 68, 70, 75)
GROUP BY p.name
ORDER BY p.name;
```

Expected Phase 1 counts (approximate — verify against current GSO data):

| Province | Districts | Wards |
|---|---|---|
| Đắk Lắk (66) | 15 | ~184 |
| Lâm Đồng (68) | 12 | ~147 |
| Bình Phước (70) | 12 | ~113 |
| Đồng Nai (75) | 12 | ~171 |

### 9.4 Alias Integrity

```sql
-- Active alias slugs that accidentally match a canonical slug
-- (would make redirect logic ambiguous)
SELECT a.alias_slug, a.entity_type
FROM geographic_aliases a
JOIN provinces p ON a.province_id = p.id AND a.alias_slug = p.slug
WHERE a.is_active AND a.entity_type = 'province';
-- Expected: 0 rows

-- Aliases with no active target
SELECT a.id, a.alias_slug FROM geographic_aliases a
WHERE a.is_active
  AND a.province_id IS NULL
  AND a.district_id IS NULL
  AND a.ward_id IS NULL;
-- Expected: 0 rows (caught by CHECK constraint, but belt-and-suspenders)
```

---

## 10. DATA SOURCES

### 10.1 Official Source

All GSO codes and names come from:
**Tổng cục Thống kê (General Statistics Office of Vietnam)**
Administrative boundary data is published periodically as part of the Statistical Yearbook.

### 10.2 Recommended Seed File Format

Store seed data as JSON in `supabase/seed/geo/`:

```
supabase/seed/geo/
├── provinces.json       — 4 provinces (Phase 1)
├── districts/
│   ├── 66_dak-lak.json
│   ├── 68_lam-dong.json
│   ├── 70_binh-phuoc.json
│   └── 75_dong-nai.json
├── wards/
│   ├── 66_dak-lak.json
│   ├── 68_lam-dong.json
│   ├── 70_binh-phuoc.json
│   └── 75_dong-nai.json
└── aliases.json         — all alias entries
```

Each JSON file drives a migration seed script (TypeScript or SQL). JSON is easier to
diff and review than embedded SQL INSERT blocks.

### 10.3 Lat/Lng Sources

For Phase 1, use approximate district/ward centroids from OpenStreetMap data
(export via Overpass API or GADM dataset). Precision to 4 decimal places is sufficient
for map centering at this stage.

---

## 11. EXPANSION STRATEGY (Phase 2+)

When adding the next provinces, follow the same order:

1. Add the province row
2. Add its districts (referencing the new province_id)
3. Add its wards (referencing the new district_ids)
4. Add any aliases
5. Run validation queries from Section 9

There is no migration to modify — just new seed data. The schema supports all 63
Vietnamese provinces without any structural changes.

**Do not add all 63 provinces at once.** Each province added means ~10–15 districts
and ~100–180 wards. Start with depth (quality data for 4 provinces) before breadth.

---

**END OF GEO_SEED_STRATEGY.md v1.0**

*The geographic system is the foundation. Bad data here cascades into bad SEO,
broken URLs, and wrong discovery results. Seed carefully, validate rigorously,
change slowly.*
