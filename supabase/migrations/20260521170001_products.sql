-- =============================================================================
-- VIO LOCAL — Products + Product Images
-- =============================================================================
-- Depends on:
--   20260521144613_init_categories.sql   (categories)
--   20260521150001_geographic_system.sql (provinces, districts, wards)
--   20260521160001_storefronts.sql       (storefronts)
--
-- Design decisions:
--   • price_text / quantity_text as TEXT — not DECIMAL.
--       Contact-first commerce. Prices are conversational: "200k/kg",
--       "Liên hệ báo giá". A DECIMAL field would break this model entirely.
--   • harvest_season as TEXT — agricultural reality.
--       "Tháng 6-8", "Thu hoạch tháng 9, hàng năm". Not ISO dates.
--   • slug globally unique — powers /san-pham/:slug canonical pages.
--   • Geographic columns on products (not just inherited from storefront).
--       A storefront in Xuân Lộc may sell products sourced from another ward.
--       Geo on the product itself is the SEO signal, not the storefront address.
--   • No price column, no inventory column, no cart/order system.
--       This is NOT Shopify. Discovery and direct contact are the only flows.
-- =============================================================================


-- ── PRODUCTS ──────────────────────────────────────────────────────────────────

create table if not exists public.products (
  id              uuid          primary key default gen_random_uuid(),

  -- Ownership: through storefront, not raw auth.uid()
  storefront_id   uuid          not null
    references public.storefronts(id) on delete cascade,

  -- Category: losing a category should not destroy products
  category_id     integer
    references public.categories(id) on delete set null,

  -- SEO slug — globally unique, powers /san-pham/:slug
  slug            varchar(150)  not null unique,

  -- Content
  title           varchar(200)  not null,
  description     text,

  -- Contact-first pricing — free-text only
  -- "200.000đ/kg", "Liên hệ báo giá", "Theo thị trường"
  price_text      varchar(100),

  -- Availability context — free-text
  -- "Còn khoảng 500kg", "Số lượng hạn chế", "Đặt trước 3 ngày"
  quantity_text   varchar(100),

  -- Agricultural commerce — seasonal context drives search intent
  -- "Tháng 6 - Tháng 8", "Rải vụ quanh năm", "Thu hoạch tháng 9-10 hàng năm"
  harvest_season  varchar(100),

  -- Hyperlocal geo — sourced/available location (may differ from storefront)
  province_id     smallint      references public.provinces(id) on delete set null,
  district_id     integer       references public.districts(id) on delete set null,
  ward_id         integer       references public.wards(id)     on delete set null,

  -- Lifecycle
  is_available    boolean       not null default true,
  is_featured     boolean       not null default false,

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

comment on table public.products is
  'Products listed by storefronts. Contact-first: no price decimal, no inventory. '
  'Slug globally unique → /san-pham/:slug. Geo on product, not inherited from storefront.';

comment on column public.products.price_text is
  'Free-text price. "200k/kg", "Liên hệ báo giá". Never a decimal — contact-first platform.';

comment on column public.products.harvest_season is
  'Agricultural season context. "Tháng 6-8", "Rải vụ quanh năm". Drives seasonal SEO.';


-- ── PRODUCT IMAGES ────────────────────────────────────────────────────────────

create table if not exists public.product_images (
  id          bigserial     primary key,
  product_id  uuid          not null
    references public.products(id) on delete cascade,
  image_url   text          not null,
  sort_order  smallint      not null default 0,

  -- No updated_at — images are replaced, not updated
  created_at  timestamptz   not null default now()
);

comment on table public.product_images is
  'Images for a product. Sort by sort_order ASC. First image is the OG/preview image.';


-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────

create or replace trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Canonical page lookup
create index if not exists idx_products_slug
  on public.products(slug);

-- Dashboard: owner lists their products
create index if not exists idx_products_storefront
  on public.products(storefront_id);

-- Category browse
create index if not exists idx_products_category
  on public.products(category_id)
  where is_available = true;

-- Geo discovery
create index if not exists idx_products_province
  on public.products(province_id)
  where is_available = true;

create index if not exists idx_products_district
  on public.products(district_id)
  where is_available = true;

-- Featured products (storefront homepage widget)
create index if not exists idx_products_featured
  on public.products(storefront_id, created_at)
  where is_featured = true and is_available = true;

-- Out-of-season / unavailable (owner management queue)
create index if not exists idx_products_unavailable
  on public.products(storefront_id)
  where is_available = false;

-- Product images: ordered display
create index if not exists idx_product_images_product
  on public.product_images(product_id, sort_order);


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.products       enable row level security;
alter table public.product_images enable row level security;

-- ── products policies ─────────────────────────────────────────────────────────

-- Public reads products from published storefronts
create policy "products_select_public"
  on public.products
  for select
  using (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and is_public = true
    )
  );

-- Owner reads own products (including from draft storefronts)
create policy "products_select_own"
  on public.products
  for select
  using (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and owner_id = auth.uid()
    )
  );

-- Owner creates products for their own storefront
create policy "products_insert_own"
  on public.products
  for insert
  with check (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and owner_id = auth.uid()
    )
  );

-- Owner updates their own products
create policy "products_update_own"
  on public.products
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

-- Owner deletes their own products
create policy "products_delete_own"
  on public.products
  for delete
  using (
    exists (
      select 1 from public.storefronts
      where id = storefront_id
        and owner_id = auth.uid()
    )
  );

-- Admin full access
create policy "products_admin_all"
  on public.products
  for all
  using  (public.is_admin())
  with check (public.is_admin());

-- ── product_images policies ───────────────────────────────────────────────────

-- Public reads images for products they can see
create policy "product_images_select_public"
  on public.product_images
  for select
  using (
    exists (
      select 1 from public.products p
      join public.storefronts s on s.id = p.storefront_id
      where p.id = product_id
        and s.is_public = true
    )
  );

-- Owner manages images for their own products
create policy "product_images_manage_own"
  on public.product_images
  for all
  using (
    exists (
      select 1 from public.products p
      join public.storefronts s on s.id = p.storefront_id
      where p.id = product_id
        and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      join public.storefronts s on s.id = p.storefront_id
      where p.id = product_id
        and s.owner_id = auth.uid()
    )
  );

-- Admin full access
create policy "product_images_admin_all"
  on public.product_images
  for all
  using  (public.is_admin())
  with check (public.is_admin());
