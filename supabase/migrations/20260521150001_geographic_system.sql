-- =============================================================================
-- VIO LOCAL — Geographic System: provinces, districts, wards, aliases
-- =============================================================================
-- Depends on: 20260521141240_init_profiles_and_roles.sql (set_updated_at fn)
-- Extensions: unaccent (Supabase built-in — no install needed)
--
-- Design decisions:
--   • GSO official codes as PKs — stable, government-issued, cross-referenceable
--   • Slugs scoped, not globally unique:
--       provinces   → globally unique  (UNIQUE slug)
--       districts   → unique per province  (UNIQUE province_id, slug)
--       wards       → unique per district  (UNIQUE district_id, slug)
--   • lat/lng as plain DOUBLE PRECISION — no PostGIS yet.
--       When nearby-discovery is needed: add geography column via ALTER TABLE.
--   • aliases live in geographic_aliases only — never inside main tables.
--       Embedded arrays make 301 redirect lookups and SEO rewrites painful.
--   • No RLS on geographic tables — public reference data, RLS adds overhead
--       with zero security benefit here.
-- =============================================================================


-- ── SLUG FUNCTION ─────────────────────────────────────────────────────────────
-- Converts Vietnamese text to ASCII-safe URL slug.
-- "Tỉnh Đồng Nai" → "tinh-dong-nai"   "Huyện Tân Phú" → "huyen-tan-phu"
-- Requires: unaccent extension

create or replace function public.slugify_vn(input text)
returns text
language plpgsql
immutable
strict
as $$
declare
  result text;
begin
  result := trim(input);
  result := unaccent(result);           -- strip diacritics: à→a, ô→o, ư→u …
  result := replace(result, 'Đ', 'D'); -- unaccent misses Đ/đ
  result := replace(result, 'đ', 'd');
  result := lower(result);
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := trim(both '-' from result);
  return result;
end;
$$;

comment on function public.slugify_vn(text) is
  'Vietnamese text → URL slug. "Tỉnh Đồng Nai" → "tinh-dong-nai". '
  'Requires unaccent extension (Supabase built-in).';


-- ── PROVINCES ─────────────────────────────────────────────────────────────────

create table if not exists public.provinces (
  -- GSO (Tổng cục Thống kê) official code — immutable PK
  id          smallint      primary key,

  -- Names
  name        varchar(100)  not null,        -- short: "Đồng Nai"
  name_full   varchar(150)  not null,        -- with type: "Tỉnh Đồng Nai"

  -- URL slug — globally unique across all provinces
  slug        varchar(100)  not null unique, -- "dong-nai"

  -- Administrative type
  type        varchar(30)   not null,
  -- 'tinh'         → Tỉnh (province)
  -- 'thanh-pho'    → Thành phố trực thuộc TW (Hanoi, HCM, etc.)

  -- Regional grouping for discovery / filtering
  region      varchar(20)   not null,
  -- 'bac' | 'trung' | 'nam'

  -- Approximate center — for map UI and proximity sorting (no PostGIS yet)
  lat         double precision,
  lng         double precision,

  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

comment on table public.provinces is
  'Vietnam provinces and centrally-administered cities. '
  'Primary key = GSO official code. Slugs are globally unique.';


-- ── DISTRICTS ─────────────────────────────────────────────────────────────────

create table if not exists public.districts (
  id          integer       primary key,     -- GSO code

  -- Parent province (ON DELETE RESTRICT — never cascade-delete a province)
  province_id smallint      not null
    references public.provinces(id) on delete restrict,

  name        varchar(100)  not null,        -- "Tân Phú"
  name_full   varchar(150)  not null,        -- "Huyện Tân Phú"

  -- slug unique within province only — "tan-phu" can exist in multiple provinces
  slug        varchar(100)  not null,

  type        varchar(30)   not null,
  -- 'huyen'    → Huyện (rural district)
  -- 'quan'     → Quận (urban district)
  -- 'thi-xa'   → Thị xã (town)
  -- 'thanh-pho'→ Thành phố thuộc tỉnh (city within province)

  lat         double precision,
  lng         double precision,

  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),

  -- Slug collision scoped to province only
  unique (province_id, slug)
);

comment on table public.districts is
  'Districts/urban districts/towns within provinces. '
  'Slug unique per province, not globally.';


-- ── WARDS ─────────────────────────────────────────────────────────────────────
-- Lowest level in the DB: Xã (rural) / Phường (urban) / Thị trấn (market town)

create table if not exists public.wards (
  id          integer       primary key,     -- GSO code

  district_id integer       not null
    references public.districts(id) on delete restrict,

  -- Denormalized province_id for query efficiency — avoids joining through districts
  province_id smallint      not null
    references public.provinces(id) on delete restrict,

  name        varchar(100)  not null,        -- "Tân Phú"
  name_full   varchar(150)  not null,        -- "Xã Tân Phú"

  slug        varchar(100)  not null,

  type        varchar(20)   not null,
  -- 'xa'       → Xã (rural commune)
  -- 'phuong'   → Phường (urban ward)
  -- 'thi-tran' → Thị trấn (market town / township)

  lat         double precision,
  lng         double precision,

  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),

  -- Slug unique within district only
  unique (district_id, slug)
);

comment on table public.wards is
  'Wards / communes / townships — lowest geographic level stored. '
  'Village/hamlet (ấp/thôn) is stored as free text in the address field, not indexed.';


-- ── GEOGRAPHIC ALIASES ────────────────────────────────────────────────────────
-- Alternate names for geographic entities.
-- Used for: search autocomplete, 301 SEO redirect lookups.
--
-- CRITICAL DESIGN RULE:
--   Aliases NEVER live in the main geo tables (e.g., slug_aliases TEXT[]).
--   A separate table enables:
--     • Efficient slug → entity_id lookups for redirects
--     • Independent lifecycle (activate / deactivate without touching main record)
--     • GIN index on alias_name for fuzzy search
--     • Clean FK cascade when a province is eventually removed

create table if not exists public.geographic_aliases (
  id          bigserial     primary key,

  -- Which level this alias targets
  entity_type varchar(20)   not null,        -- 'province' | 'district' | 'ward'

  -- Exactly one FK is non-null — enforced by the check constraint below
  province_id smallint      references public.provinces(id) on delete cascade,
  district_id integer       references public.districts(id) on delete cascade,
  ward_id     integer       references public.wards(id)     on delete cascade,

  alias_name  varchar(200)  not null,        -- "Sài Gòn"
  alias_slug  varchar(200)  not null,        -- "sai-gon"

  reason      varchar(50)   not null default 'colloquial',
  -- 'colloquial'   → local nickname ("Sài Gòn")
  -- 'historical'   → pre-reorganisation name
  -- 'abbreviation' → short form ("TPHCM", "BRVT")
  -- 'old-name'     → official name before a rename
  -- 'misspelling'  → common search misspelling

  is_active   boolean       not null default true,
  created_at  timestamptz   not null default now(),

  constraint geographic_aliases_entity_check check (
    (entity_type = 'province' and province_id is not null
                              and district_id is null
                              and ward_id     is null) or
    (entity_type = 'district' and district_id is not null
                              and province_id is null
                              and ward_id     is null) or
    (entity_type = 'ward'     and ward_id     is not null
                              and province_id is null
                              and district_id is null)
  )
);

comment on table public.geographic_aliases is
  'Alternate slugs/names for provinces, districts, and wards. '
  'Used for 301 redirects and search autocomplete. '
  'Deactivate with is_active = false — never delete (preserves redirect history).';


-- ── UPDATED_AT TRIGGERS ───────────────────────────────────────────────────────
-- set_updated_at() defined in 20260521141240; CREATE OR REPLACE here for safety.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_provinces_updated_at
  before update on public.provinces
  for each row execute function public.set_updated_at();

create or replace trigger trg_districts_updated_at
  before update on public.districts
  for each row execute function public.set_updated_at();

create or replace trigger trg_wards_updated_at
  before update on public.wards
  for each row execute function public.set_updated_at();

-- geographic_aliases has no updated_at —
-- deactivate by setting is_active = false; never update alias_slug after creation


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- provinces
create index if not exists idx_provinces_slug
  on public.provinces(slug);

create index if not exists idx_provinces_region
  on public.provinces(region);

create index if not exists idx_provinces_type
  on public.provinces(type);

-- districts
create index if not exists idx_districts_province
  on public.districts(province_id);

create index if not exists idx_districts_slug
  on public.districts(province_id, slug);   -- composite: used in slug-resolution queries

create index if not exists idx_districts_type
  on public.districts(type);

-- wards
create index if not exists idx_wards_district
  on public.wards(district_id);

create index if not exists idx_wards_province
  on public.wards(province_id);             -- direct province lookups skip districts join

create index if not exists idx_wards_slug
  on public.wards(district_id, slug);       -- composite: slug resolution within district

create index if not exists idx_wards_type
  on public.wards(type);

-- geographic_aliases
create index if not exists idx_geo_aliases_slug
  on public.geographic_aliases(alias_slug)
  where is_active;                          -- partial: only active aliases hit redirect paths

create index if not exists idx_geo_aliases_name_trgm
  on public.geographic_aliases using gin(alias_name gin_trgm_ops);
  -- requires pg_trgm extension (Supabase built-in) — powers fuzzy search autocomplete

create index if not exists idx_geo_aliases_province
  on public.geographic_aliases(province_id)
  where province_id is not null;

create index if not exists idx_geo_aliases_district
  on public.geographic_aliases(district_id)
  where district_id is not null;

create index if not exists idx_geo_aliases_ward
  on public.geographic_aliases(ward_id)
  where ward_id is not null;


-- ── FK BACK-FILL: profiles.province_id / district_id / ward_id ───────────────
-- profiles was created without FK constraints (geographic tables didn't exist yet).
-- Now that this migration runs, add the constraints.

alter table public.profiles
  add constraint fk_profiles_province
    foreign key (province_id) references public.provinces(id) on delete set null;

alter table public.profiles
  add constraint fk_profiles_district
    foreign key (district_id) references public.districts(id) on delete set null;

alter table public.profiles
  add constraint fk_profiles_ward
    foreign key (ward_id) references public.wards(id) on delete set null;
