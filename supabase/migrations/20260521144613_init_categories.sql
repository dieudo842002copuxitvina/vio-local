-- =============================================================================
-- VIO LOCAL — Categories
-- =============================================================================
-- Depends on: nothing (reference data, no FKs to other app tables)
--
-- Design decisions:
--   • type = 'product' | 'service' — discovery logic diverges at this level.
--       Product discovery: harvest season, price, quantity.
--       Service discovery: service area, availability.
--   • Max 2 levels: root → child. No grandchildren.
--       Enforced by trigger. Deep trees kill SEO (thin pages) and UX.
--   • Slugs globally unique — powers /danh-muc/:slug discovery pages.
--   • No RLS — categories are public reference data shared across all storefronts.
--   • icon: free-text emoji or Lucide icon name ("leaf", "truck", "snowflake").
--       Renderer decides how to display it — migration stays icon-agnostic.
-- =============================================================================


-- ── CATEGORIES ────────────────────────────────────────────────────────────────

create table if not exists public.categories (
  id          serial        primary key,

  -- Null = root category. Non-null = child of root. Max depth = 2.
  parent_id   integer       references public.categories(id) on delete restrict,

  name        varchar(100)  not null,
  slug        varchar(100)  not null unique,

  -- Drives discovery routing — product vs service pages use different layouts,
  -- structured data, and SEO formulas.
  type        varchar(20)   not null,

  description text,

  -- Emoji or Lucide icon name. Renderer decides presentation.
  icon        varchar(50),

  created_at  timestamptz   not null default now(),

  constraint categories_type_check
    check (type in ('product', 'service'))
);

comment on table public.categories is
  'Product and service categories. Max 2 levels (root → child). '
  'type = product | service drives discovery layout and SEO. '
  'No RLS — public reference data.';

comment on column public.categories.type is
  'product = physical/agricultural goods. '
  'service = local/rural services (irrigation, logistics, cold storage, etc.)';

comment on column public.categories.parent_id is
  'Null = root. Non-null = child of root. Grandchildren are rejected by trigger.';


-- ── DEPTH GUARD ───────────────────────────────────────────────────────────────
-- Prevents category tree depth > 2 (root + one child level).
-- A grandchild category would create thin, fragmented discovery pages with
-- near-zero content — a classic SEO trap.

create or replace function public.check_category_depth()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    if exists (
      select 1 from public.categories
      where id = new.parent_id
        and parent_id is not null
    ) then
      raise exception
        'Category depth is limited to 2 levels (root → child). '
        'Parent id=% already has a parent — cannot add a grandchild.',
        new.parent_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger trg_categories_depth_check
  before insert or update on public.categories
  for each row execute function public.check_category_depth();


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Slug lookup for /danh-muc/:slug routes
create index if not exists idx_categories_slug
  on public.categories(slug);

-- List all children of a root (navigation menus, discovery sidebars)
create index if not exists idx_categories_parent
  on public.categories(parent_id)
  where parent_id is not null;

-- Filter by type — product vs service browse
create index if not exists idx_categories_type
  on public.categories(type);

-- Compound: all product subcategories, all service subcategories
create index if not exists idx_categories_type_parent
  on public.categories(type, parent_id);
