-- =============================================================================
-- VIO LOCAL — Saved Items
-- =============================================================================
-- Purpose: Personal bookmark table. Authenticated users save storefronts,
-- products, services, and land listings for later reference.
-- Not a social feed. Not a recommendation signal. A personal bookmark.
--
-- Depends on:
--   20260521141240_init_profiles_and_roles.sql  (profiles)
--
-- Intentional omissions vs. inquiries:
--
--   No owner_id resolution trigger.
--   In inquiries, owner_id (the entity owner) differs from the submitter.
--   Here, profile_id IS the actor — auth.uid() suffices for all RLS checks.
--   No trigger, no SECURITY DEFINER function, no cross-table join.
--
--   No FK on target_id.
--   Referential integrity across four entity tables in a single FK is not
--   possible in PostgreSQL. If a saved entity is deleted, the saved_items row
--   becomes a dangling reference. Application shows "no longer available" for
--   those rows. No cleanup trigger — keeps the schema lightweight. If cleanup
--   is needed later, a periodic job or ON DELETE trigger per entity table can
--   be added without a schema change here.
--
--   No UPDATE.
--   A saved item has no mutable fields. The only operations are save (INSERT)
--   and unsave (DELETE). No UPDATE policy is defined.
--
-- Duplicate saves:
--   UNIQUE (profile_id, target_type, target_id) prevents duplicate bookmarks.
--   The application must use INSERT ... ON CONFLICT DO NOTHING for idempotent
--   save actions (e.g. a double-tap). No error, no duplicate.
-- =============================================================================


-- ── TABLE ─────────────────────────────────────────────────────────────────────

create table if not exists public.saved_items (
  id          uuid         not null default gen_random_uuid(),
  profile_id  uuid         not null,
  target_type varchar(20)  not null,
  target_id   uuid         not null,
  created_at  timestamptz  not null default now(),

  -- ── CONSTRAINTS ────────────────────────────────────────────────────────────

  constraint saved_items_pkey
    primary key (id),

  constraint saved_items_profile_fk
    foreign key (profile_id) references public.profiles(id)
    on delete cascade,

  -- One bookmark per entity per user.
  -- Application uses INSERT ... ON CONFLICT DO NOTHING for idempotent saves.
  constraint saved_items_unique_bookmark
    unique (profile_id, target_type, target_id),

  -- Supported entity types — must stay in sync with inquiries_target_type_check.
  -- To add a new type: DROP + re-add this constraint in a new migration.
  constraint saved_items_target_type_check
    check (target_type in ('storefront', 'product', 'service', 'land_listing'))
);


-- ── INDEXES ───────────────────────────────────────────────────────────────────

-- Hot path: user opens their saved items list, newest first.
-- Also supports pagination (profile_id + created_at cursor).
create index if not exists idx_saved_items_profile
  on public.saved_items(profile_id, created_at desc);

-- Filtered view: "show my saved storefronts" / "show my saved land listings".
-- Covers profile_id + target_type in a single scan; created_at for ordering.
create index if not exists idx_saved_items_profile_type
  on public.saved_items(profile_id, target_type, created_at desc);

-- Entity perspective: "how many times has this item been saved?" (analytics)
-- and application-layer checks: "has the current user saved this item?"
-- The UNIQUE constraint already creates an index on (profile_id, target_type,
-- target_id) but that index is not efficient for (target_type, target_id)
-- lookups without profile_id. This dedicated index serves the entity side.
create index if not exists idx_saved_items_target
  on public.saved_items(target_type, target_id);


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.saved_items enable row level security;

-- ── SELECT ────────────────────────────────────────────────────────────────────

-- Users see only their own saved items.
-- No cross-user bookmark visibility — saves are private.
create policy "saved_items_select_own"
  on public.saved_items
  for select
  to authenticated
  using (profile_id = auth.uid());

-- Admin: full read for support and abuse detection.
create policy "saved_items_select_admin"
  on public.saved_items
  for select
  to authenticated
  using (public.is_admin());

-- ── INSERT ────────────────────────────────────────────────────────────────────

-- Users may only create bookmarks for themselves.
-- WITH CHECK prevents profile_id spoofing: the inserted row's profile_id
-- must equal auth.uid(). A user cannot save on behalf of another user.
create policy "saved_items_insert_own"
  on public.saved_items
  for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Admin: may insert directly (e.g. onboarding, data migration).
create policy "saved_items_insert_admin"
  on public.saved_items
  for insert
  to authenticated
  with check (public.is_admin());

-- ── DELETE ────────────────────────────────────────────────────────────────────

-- Users may unsave (delete) their own bookmarks.
create policy "saved_items_delete_own"
  on public.saved_items
  for delete
  to authenticated
  using (profile_id = auth.uid());

-- Admin: may remove any bookmark (e.g. spam / abuse cleanup).
create policy "saved_items_delete_admin"
  on public.saved_items
  for delete
  to authenticated
  using (public.is_admin());

-- No UPDATE policy. Saved items are immutable — save or unsave, nothing in between.


-- ── COMMENTS ─────────────────────────────────────────────────────────────────

comment on table public.saved_items is
  'Personal bookmark table. One row per (profile_id, target_type, target_id). '
  'target_type: storefront | product | service | land_listing. '
  'No FK on target_id — dangling references handled gracefully in the application. '
  'Application must use INSERT ... ON CONFLICT DO NOTHING for idempotent save actions.';

comment on column public.saved_items.target_type is
  'storefront   — saved storefront page. '
  'product      — saved product listing. '
  'service      — saved service listing. '
  'land_listing — saved agricultural land listing.';

comment on column public.saved_items.target_id is
  'UUID of the saved entity (storefront, product, service, or land_listing). '
  'No FK constraint — integrity across four tables is not expressible as a single FK. '
  'If the target entity is deleted, this row becomes a dangling reference. '
  'Application shows "no longer available" for rows where the entity cannot be found.';

comment on constraint saved_items_unique_bookmark on public.saved_items is
  'Prevents duplicate bookmarks. Application uses INSERT ... ON CONFLICT DO NOTHING. '
  'Attempting to save an already-saved item is silently ignored — not an error.';
