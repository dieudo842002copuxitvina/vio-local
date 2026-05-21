-- =============================================================================
-- VIO LOCAL — Services + Service Images
-- =============================================================================
-- Depends on:
--   20260521144613_init_categories.sql   (categories — type='service')
--   20260521150001_geographic_system.sql (provinces, districts, wards)
--   20260521160001_storefronts.sql       (storefronts)
--
-- Service examples:
--   tưới tiêu (irrigation), vận chuyển (logistics), máy nông nghiệp (machinery),
--   sấy nông sản (drying), cơ khí (mechanical), kho lạnh (cold storage)
--
-- Design decisions:
--   • phone on service (not storefront phone) — services often have dedicated
--       contact lines separate from the storefront's general number.
--   • service_area_text as TEXT — "Toàn tỉnh Đồng Nai", "Bán kính 50km",
--       "Huyện Xuân Lộc và lân cận". No geographic FK here: coverage is
--       prose, not a discrete geo unit.
--   • No price field — services are always contact-for-quote in rural Vietnam.
--   • No booking/scheduling system — contact-first only.
--   • slug globally unique — powers /dich-vu/:slug canonical pages.
-- =============================================================================


-- ── SERVICES ──────────────────────────────────────────────────────────────────

create table if not exists public.services (
  id              uuid          primary key default gen_random_uuid(),

  storefront_id   uuid          not null
    references public.storefronts(id) on delete cascade,

  -- Should only reference categories with type = 'service'
  -- Enforced at app layer, not DB — avoids cross-type FK complexity
  category_id     integer
    references public.categories(id) on delete set null,

  -- SEO slug — globally unique, powers /dich-vu/:slug
  slug            varchar(150)  not null unique,

  -- Content
  title           varchar(200)  not null,
  description     text,

  -- Dedicated contact line for this service (may differ from storefront)
  phone           varchar(20),

  -- Free-text service coverage area
  -- "Toàn tỉnh Đồng Nai", "Các huyện miền núi Bình Phước"
  service_area_text varchar(200),

  -- Service HQ / base location (for geo discovery)
  province_id     smallint      references public.provinces(id) on delete set null,
  district_id     integer       references public.districts(id) on delete set null,
  ward_id         integer       references public.wards(id)     on delete set null,

  is_available    boolean       not null default true,

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

comment on table public.services is
  'Rural/local services offered by storefronts. Contact-first: no pricing, no booking. '
  'Slug globally unique → /dich-vu/:slug.';

comment on column public.services.phone is
  'Dedicated service contact. May differ from storefront.phone.';

comment on column public.services.service_area_text is
  'Free-text coverage: "Toàn tỉnh Đồng Nai", "Bán kính 50km". Not a geo FK.';


-- ── SERVICE IMAGES ────────────────────────────────────────────────────────────

create table if not exists public.service_images (
  id          bigserial     primary key,
  service_id  uuid          not null
    references public.services(id) on delete cascade,
  image_url   text          not null,
  sort_order  smallint      not null default 0,
  created_at  timestamptz   not null default now()
);

comment on table public.service_images is
  'Images for a service listing. Sort by sort_order ASC.';


-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────

create or replace trigger trg_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Canonical page lookup
create index if not exists idx_services_slug
  on public.services(slug);

-- Dashboard: owner lists their services
create index if not exists idx_services_storefront
  on public.services(storefront_id);

-- Category browse (service type only)
create index if not exists idx_services_category
  on public.services(category_id)
  where is_available = true;

-- Geo discovery — service base location
create index if not exists idx_services_province
  on public.services(province_id)
  where is_available = true;

create index if not exists idx_services_district
  on public.services(district_id)
  where is_available = true;

-- Service images: ordered display
create index if not exists idx_service_images_service
  on public.service_images(service_id, sort_order);


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.services       enable row level security;
alter table public.service_images enable row level security;

-- ── services policies ─────────────────────────────────────────────────────────

create policy "services_select_public"
  on public.services
  for select
  using (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and is_public = true
    )
  );

create policy "services_select_own"
  on public.services
  for select
  using (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and owner_id = auth.uid()
    )
  );

create policy "services_insert_own"
  on public.services
  for insert
  with check (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and owner_id = auth.uid()
    )
  );

create policy "services_update_own"
  on public.services
  for update
  using (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and owner_id = auth.uid()
    )
  );

create policy "services_delete_own"
  on public.services
  for delete
  using (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and owner_id = auth.uid()
    )
  );

create policy "services_admin_all"
  on public.services
  for all
  using  (public.is_admin())
  with check (public.is_admin());

-- ── service_images policies ───────────────────────────────────────────────────

create policy "service_images_select_public"
  on public.service_images
  for select
  using (
    exists (
      select 1 from public.services sv
      join public.storefronts s on s.id = sv.storefront_id
      where sv.id = service_id
        and s.is_public = true
    )
  );

create policy "service_images_manage_own"
  on public.service_images
  for all
  using (
    exists (
      select 1 from public.services sv
      join public.storefronts s on s.id = sv.storefront_id
      where sv.id = service_id
        and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.services sv
      join public.storefronts s on s.id = sv.storefront_id
      where sv.id = service_id
        and s.owner_id = auth.uid()
    )
  );

create policy "service_images_admin_all"
  on public.service_images
  for all
  using  (public.is_admin())
  with check (public.is_admin());
