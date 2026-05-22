-- =============================================================================
-- VIO LOCAL — Storefronts
-- =============================================================================
-- Depends on:
--   20260521141240_init_profiles_and_roles.sql  (profiles, is_admin())
--   20260521150001_geographic_system.sql         (provinces, districts, wards)
--
-- Design decisions:
--   • owner_id → profiles.id (not auth.users.id directly)
--       Keeps app layer consistent: always join through profiles, not auth schema.
--   • slug globally unique — SEO canonical /ho-kinh-doanh/:slug depends on it.
--   • is_public defaults false — storefronts start as drafts.
--       Owner controls publish; moderator/admin can force-publish or unpublish.
--   • is_verified is admin/moderator-only. App layer MUST NOT let owners set
--       this. Column-level security (GRANT UPDATE) can enforce it when needed.
--   • No UNIQUE(owner_id) constraint — one owner may run multiple businesses.
--       Enforce a soft limit (e.g. max 3 active) in app logic if needed.
--   • Geographic columns ON DELETE SET NULL — address becomes unresolved if
--       an admin unit is removed, but the storefront row is never lost.
-- =============================================================================


-- ── STOREFRONTS ───────────────────────────────────────────────────────────────

create table if not exists public.storefronts (
  id              uuid          primary key default gen_random_uuid(),

  -- Ownership: profile, not raw auth.users
  owner_id        uuid          not null
    references public.profiles(id) on delete cascade,

  -- SEO slug — globally unique, drives /ho-kinh-doanh/:slug
  slug            varchar(120)  not null unique,

  -- Business identity
  business_name   varchar(200)  not null,
  description     text,

  -- Contact methods — this is a contact-first platform
  phone           varchar(20),
  zalo_url        text,
  facebook_url    text,
  tiktok_url      text,

  -- Hyperlocal location
  province_id     smallint      references public.provinces(id) on delete set null,
  district_id     integer       references public.districts(id) on delete set null,
  ward_id         integer       references public.wards(id)     on delete set null,

  -- Media
  avatar_url      text,
  cover_image_url text,

  -- Lifecycle flags
  is_verified     boolean       not null default false,
  -- IMPORTANT: is_verified must only be set true by admin/moderator via
  -- server function. Never expose this field to owner update endpoints.

  is_public       boolean       not null default false,
  -- false = draft (visible only to owner)
  -- true  = published (visible to everyone)
  -- Moderators can flip this for approval / take-down

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

comment on table public.storefronts is
  'Merchant storefronts. Canonical URL: /ho-kinh-doanh/:slug. '
  'is_public controls draft vs published. is_verified is admin/moderator-only.';

comment on column public.storefronts.is_public is
  'Draft/publish gate. Owner controls. Moderator can override for take-down.';

comment on column public.storefronts.is_verified is
  'Platform-issued trust badge. Set only by admin/moderator server functions.';


-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────

create or replace trigger trg_storefronts_updated_at
  before update on public.storefronts
  for each row execute function public.set_updated_at();


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Primary public lookup: slug → storefront page
create index if not exists idx_storefronts_slug
  on public.storefronts(slug);

-- Owner dashboard: list own storefronts
create index if not exists idx_storefronts_owner
  on public.storefronts(owner_id);

-- Geo discovery: province-level browse
create index if not exists idx_storefronts_province
  on public.storefronts(province_id)
  where is_public = true;

-- Geo discovery: district-level browse
create index if not exists idx_storefronts_district
  on public.storefronts(district_id)
  where is_public = true;

-- Verification badge filter
create index if not exists idx_storefronts_verified
  on public.storefronts(is_verified)
  where is_verified = true and is_public = true;

-- Admin / moderation queue: unpublished storefronts
create index if not exists idx_storefronts_drafts
  on public.storefronts(owner_id, created_at)
  where is_public = false;


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.storefronts enable row level security;

-- 1. Anyone (including anon) can read published storefronts
create policy "storefronts_select_public"
  on public.storefronts
  for select
  using (is_public = true);

-- 2. Owner can always read their own (even drafts)
create policy "storefronts_select_own"
  on public.storefronts
  for select
  using (auth.uid() = owner_id);

-- 3. Admin sees everything
create policy "storefronts_select_admin"
  on public.storefronts
  for select
  using (public.is_admin());

-- 4. Authenticated owner can create their own storefront
--    with check: prevents spoofing a different owner_id on insert
create policy "storefronts_insert_own"
  on public.storefronts
  for insert
  with check (auth.uid() = owner_id);

-- 5. Owner can update their own storefront
--    Note: app layer must NOT expose is_verified in owner update endpoints
create policy "storefronts_update_own"
  on public.storefronts
  for update
  using  (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- 6. Admin can update any storefront (covers moderation: is_public, is_verified)
create policy "storefronts_update_admin"
  on public.storefronts
  for update
  using  (public.is_admin())
  with check (public.is_admin());

-- 7. Owner can delete their own storefront
create policy "storefronts_delete_own"
  on public.storefronts
  for delete
  using (auth.uid() = owner_id);

-- 8. Admin can delete any storefront
create policy "storefronts_delete_admin"
  on public.storefronts
  for delete
  using (public.is_admin());
