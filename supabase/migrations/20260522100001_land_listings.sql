-- =============================================================================
-- VIO LOCAL — Agricultural Land Listings
-- =============================================================================
-- Bounded context: land listings are SEPARATE from products and services.
-- They share the geographic system but have their own ownership, moderation,
-- image pipeline, and discovery routes (/dat-nong-nghiep/*).
--
-- Depends on:
--   20260521141240_init_profiles_and_roles.sql  (profiles)
--   20260521150001_geographic_system.sql        (provinces, districts, wards)
--
-- Key design decisions:
--   moderation_status — four-state gate. Spam is very high for land listings
--     (fake listings, inflated prices, fraudulent legal status). A listing
--     MUST be both is_public=true AND moderation_status='approved' to appear.
--   is_featured — admin/moderator only (monetization signal, not owner-settable).
--   land_type  — CHECK constraint; values map to Vietnamese land law categories.
--   price_text — free-form text ("850 triệu", "Thương lượng") — contact-first,
--     no decimal/currency complexity.
--   coordinates_text — plain text lat/long ("11.5, 107.2") — no PostGIS.
--   crop_type — free-form text; too diverse across Central Highlands + SE
--     regions to enumerate (cà phê, sầu riêng, hồ tiêu, cao su, bơ, điều…).
-- =============================================================================


-- ── UPDATED_AT TRIGGER FUNCTION ───────────────────────────────────────────────
-- Idempotent — safe to define even if already present from another migration.

create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── LAND LISTINGS ─────────────────────────────────────────────────────────────

create table if not exists public.land_listings (
  id                 uuid         not null default gen_random_uuid(),
  owner_id           uuid         not null,
  slug               varchar(160) not null,
  title              varchar(200) not null,
  description        text,

  -- Geographic scope (all nullable — owner may not fill in all levels)
  province_id        smallint,
  district_id        integer,
  ward_id            integer,

  -- Land-specific metadata
  land_area_text     varchar(100),           -- "2 hectares", "5.000 m²"
  land_type          varchar(30),            -- see CHECK below
  crop_type          varchar(200),           -- free text: "cà phê, sầu riêng"
  price_text         varchar(100),           -- "850 triệu", "Thương lượng"
  phone              varchar(20),
  coordinates_text   varchar(120),           -- "11.5234, 107.8912" — no PostGIS
  legal_status_text  varchar(200),           -- "Sổ đỏ đầy đủ", "Đang cấp sổ"

  -- Visibility and moderation
  is_featured        boolean      not null default false,
  is_public          boolean      not null default false,
  moderation_status  varchar(20)  not null default 'pending',

  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  -- ── CONSTRAINTS ────────────────────────────────────────────────────────────

  constraint land_listings_pkey
    primary key (id),

  constraint land_listings_slug_unique
    unique (slug),

  constraint land_listings_owner_fk
    foreign key (owner_id) references public.profiles(id)
    on delete cascade,

  constraint land_listings_province_fk
    foreign key (province_id) references public.provinces(id)
    on delete set null,

  constraint land_listings_district_fk
    foreign key (district_id) references public.districts(id)
    on delete set null,

  constraint land_listings_ward_fk
    foreign key (ward_id) references public.wards(id)
    on delete set null,

  -- Vietnamese land law categories (Luật Đất đai).
  -- 'lua'         — lúa (wetland rice)
  -- 'rau_mau'     — rau màu, cây ngắn ngày (vegetables, short-cycle crops)
  -- 'cay_lau_nam' — cây lâu năm (coffee, pepper, rubber, cocoa)
  -- 'an_trai'     — cây ăn trái (durian, rambutan, avocado, mango)
  -- 'lam_nghiep'  — lâm nghiệp (forestry, timber)
  -- 'mat_nuoc'    — mặt nước nuôi trồng thủy sản (aquaculture ponds)
  -- 'hon_hop'     — hỗn hợp (mixed use)
  constraint land_listings_land_type_check
    check (land_type is null or land_type in (
      'lua', 'rau_mau', 'cay_lau_nam', 'an_trai',
      'lam_nghiep', 'mat_nuoc', 'hon_hop'
    )),

  -- Moderation gate — four states:
  --   pending   — newly submitted, awaiting review
  --   approved  — passes moderation, visible when is_public=true
  --   rejected  — fails moderation (spam, fraud, missing info), hidden from all
  --   hidden    — previously approved but taken down (post-approval issue)
  constraint land_listings_moderation_check
    check (moderation_status in ('pending', 'approved', 'rejected', 'hidden'))
);


-- ── LAND LISTING IMAGES ───────────────────────────────────────────────────────

create table if not exists public.land_listing_images (
  id                bigserial    not null,
  land_listing_id   uuid         not null,
  image_url         text         not null,
  sort_order        smallint     not null default 0,
  created_at        timestamptz  not null default now(),

  constraint land_listing_images_pkey
    primary key (id),

  constraint land_listing_images_listing_fk
    foreign key (land_listing_id) references public.land_listings(id)
    on delete cascade
);


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Slug lookup for /dat-nong-nghiep/:slug route resolution
create unique index if not exists idx_land_listings_slug
  on public.land_listings(slug);

-- Owner dashboard: all listings for a given owner
create index if not exists idx_land_listings_owner
  on public.land_listings(owner_id, created_at desc);

-- Province discovery: /dat-nong-nghiep/dong-nai
-- Only public + approved listings. Featured listings sort first.
create index if not exists idx_land_listings_province
  on public.land_listings(province_id, is_featured desc, created_at desc)
  where is_public = true and moderation_status = 'approved';

-- District discovery: /dat-nong-nghiep/dong-nai/xuan-loc
create index if not exists idx_land_listings_district
  on public.land_listings(district_id, is_featured desc, created_at desc)
  where is_public = true and moderation_status = 'approved';

-- Land type filter on province discovery pages
-- Powers /dat-nong-nghiep/dong-nai?land_type=cay_lau_nam (if enabled)
-- and the land-type section headings on discovery pages
create index if not exists idx_land_listings_province_type
  on public.land_listings(province_id, land_type)
  where is_public = true and moderation_status = 'approved';

-- Ward-level nearby lookup (same pattern as storefronts nearby algorithm)
create index if not exists idx_land_listings_ward
  on public.land_listings(ward_id)
  where is_public = true and moderation_status = 'approved';

-- Moderation queue: pending listings sorted oldest-first (FIFO review)
create index if not exists idx_land_listings_pending
  on public.land_listings(created_at asc)
  where moderation_status = 'pending';

-- Images: ordered retrieval per listing
create index if not exists idx_land_listing_images_listing
  on public.land_listing_images(land_listing_id, sort_order asc);


-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────

create trigger land_listings_updated_at
  before update on public.land_listings
  for each row
  execute function public.set_updated_at();


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.land_listings        enable row level security;
alter table public.land_listing_images  enable row level security;


-- ── LAND LISTINGS POLICIES ───────────────────────────────────────────────────

-- Public: only approved + published listings
create policy "land_listings_select_public"
  on public.land_listings
  for select
  to anon, authenticated
  using (is_public = true and moderation_status = 'approved');

-- Owner: full view of their own listings (all states — including pending/rejected)
create policy "land_listings_select_own"
  on public.land_listings
  for select
  to authenticated
  using (owner_id = auth.uid());

-- Admin: full view of all listings
create policy "land_listings_select_admin"
  on public.land_listings
  for select
  to authenticated
  using (public.is_admin());

-- Owner: insert their own listings
-- New listings always start as: is_public=false, moderation_status='pending'
-- The application layer enforces these defaults; the policy only checks ownership.
create policy "land_listings_insert_own"
  on public.land_listings
  for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Owner: update their own listings
-- NOTE: is_featured and moderation_status are excluded from UpdateLandListingInput
--       in TypeScript — owners cannot elevate their own listing or bypass moderation.
create policy "land_listings_update_own"
  on public.land_listings
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Admin: update any listing (moderation actions, featured flag)
create policy "land_listings_update_admin"
  on public.land_listings
  for update
  to authenticated
  using (public.is_admin());

-- Owner: delete their own listings
create policy "land_listings_delete_own"
  on public.land_listings
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- Admin: delete any listing
create policy "land_listings_delete_admin"
  on public.land_listings
  for delete
  to authenticated
  using (public.is_admin());


-- ── LAND LISTING IMAGES POLICIES ─────────────────────────────────────────────

-- Public: images of public + approved listings only
create policy "land_images_select_public"
  on public.land_listing_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.land_listings l
      where l.id = land_listing_id
        and l.is_public = true
        and l.moderation_status = 'approved'
    )
  );

-- Owner: images of their own listings (all moderation states)
create policy "land_images_select_own"
  on public.land_listing_images
  for select
  to authenticated
  using (
    exists (
      select 1 from public.land_listings l
      where l.id = land_listing_id
        and l.owner_id = auth.uid()
    )
  );

-- Owner: add images to their own listings
create policy "land_images_insert_own"
  on public.land_listing_images
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.land_listings l
      where l.id = land_listing_id
        and l.owner_id = auth.uid()
    )
  );

-- Owner: manage sort order and remove their own images
create policy "land_images_update_own"
  on public.land_listing_images
  for update
  to authenticated
  using (
    exists (
      select 1 from public.land_listings l
      where l.id = land_listing_id
        and l.owner_id = auth.uid()
    )
  );

create policy "land_images_delete_own"
  on public.land_listing_images
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.land_listings l
      where l.id = land_listing_id
        and l.owner_id = auth.uid()
    )
  );

-- Admin: full image management
create policy "land_images_admin"
  on public.land_listing_images
  for all
  to authenticated
  using (public.is_admin());


-- ── COMMENTS ─────────────────────────────────────────────────────────────────

comment on table public.land_listings is
  'Agricultural land listings — separate bounded context from products/services. '
  'Discovery routes: /dat-nong-nghiep, /dat-nong-nghiep/:province, '
  '/dat-nong-nghiep/:province/:district, /dat-nong-nghiep/:slug. '
  'Visibility rule: is_public = true AND moderation_status = ''approved''.';

comment on column public.land_listings.moderation_status is
  'Four-state moderation gate. '
  'pending = awaiting review; approved = visible when is_public=true; '
  'rejected = spam/fraud/incomplete, permanently hidden; '
  'hidden = post-approval takedown (legal issue, owner dispute).';

comment on column public.land_listings.is_featured is
  'Admin/moderator only — monetization signal. '
  'Featured listings appear first in discovery sort. '
  'Never settable by listing owner via UpdateLandListingInput.';

comment on column public.land_listings.coordinates_text is
  'Plain-text coordinates ("11.5234, 107.8912"). '
  'No PostGIS dependency. If precise geo queries are needed later, '
  'add a geometry column in a separate migration without touching this field.';

comment on table public.land_listing_images is
  'Images for a land listing. sort_order=0 is the cover image. '
  'Storage path convention: land-listings/{listing_id}/{sort_order}.webp';
