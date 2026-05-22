-- =============================================================================
-- VIO LOCAL — Usage Tracking
-- =============================================================================
-- Purpose: Track free-tier usage for land listings per profile.
--
-- Depends on:
--   20260521141240_init_profiles_and_roles.sql  (profiles)
--   20260522100001_land_listings.sql            (land_listings)
--
-- Design decisions (see docs for rationale):
--
--   One row per profile (UNIQUE on profile_id).
--
--   Lazy row creation — the usage_tracking row is created automatically
--   via UPSERT when a user posts their first land listing. No migration
--   needed for existing profiles without listings.
--
--   Lazy monthly reset — the counter auto-resets when the user creates
--   their first listing in a new calendar month. No pg_cron required.
--   reset_period stores the first day of the current billing month.
--
--   Decrement on delete — land_listing_count decreases when a listing is
--   removed. Acceptable for free-tier; moderation gate already prevents
--   create→delete→recreate abuse.
--
--   SECURITY DEFINER trigger functions — bypass RLS on usage_tracking.
--   Only triggers may write to this table; authenticated users can only
--   SELECT their own row.
--
--   No billing logic — just counters. Limit enforcement is application-layer.
--   To add a subscription tier: ALTER TABLE ADD COLUMN subscription_tier.
-- =============================================================================


-- ── TABLE ─────────────────────────────────────────────────────────────────────

create table if not exists public.usage_tracking (
  id                     uuid        not null default gen_random_uuid(),
  profile_id             uuid        not null,

  -- Counts for the current reset_period
  land_listing_count     integer     not null default 0,
  featured_listing_count integer     not null default 0,

  -- First day of the current calendar month.
  -- When land_listing_count is incremented and reset_period < current month,
  -- the trigger resets land_listing_count to 1 and updates reset_period.
  -- featured_listing_count is NOT reset — it tracks currently active featured
  -- listings, not a per-period quota.
  reset_period           date        not null default (date_trunc('month', now())::date),

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- ── CONSTRAINTS ────────────────────────────────────────────────────────────

  constraint usage_tracking_pkey
    primary key (id),

  -- One row per profile — enforced at DB level
  constraint usage_tracking_profile_unique
    unique (profile_id),

  constraint usage_tracking_profile_fk
    foreign key (profile_id) references public.profiles(id)
    on delete cascade,

  -- Counts must never go negative
  constraint usage_tracking_land_count_nonneg
    check (land_listing_count >= 0),

  constraint usage_tracking_featured_count_nonneg
    check (featured_listing_count >= 0)
);


-- ── INDEX ─────────────────────────────────────────────────────────────────────

-- Admin: query active users in the current period or find heavy users
create index if not exists idx_usage_tracking_period
  on public.usage_tracking(reset_period, land_listing_count desc);


-- ── TRIGGER: INCREMENT ON LISTING CREATED ─────────────────────────────────────
--
-- Fires AFTER INSERT on land_listings.
-- Upserts a usage_tracking row for the listing owner.
-- If reset_period is a previous month, resets land_listing_count to 1
-- and updates reset_period — the lazy monthly reset.
-- SECURITY DEFINER: runs as the function owner, bypasses RLS on usage_tracking.

create or replace function public.usage_tracking_on_land_insert()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  v_current_month date := date_trunc('month', now())::date;
begin
  insert into public.usage_tracking (
    profile_id,
    land_listing_count,
    featured_listing_count,
    reset_period
  )
  values (
    new.owner_id,
    1,
    0,
    v_current_month
  )
  on conflict (profile_id) do update
    set
      -- Lazy reset: if we're in a new month, start the counter fresh
      land_listing_count = case
        when usage_tracking.reset_period < v_current_month then 1
        else usage_tracking.land_listing_count + 1
      end,
      reset_period = v_current_month,
      updated_at   = now();

  return new;
end;
$$;

create trigger land_listings_usage_insert
  after insert on public.land_listings
  for each row
  execute function public.usage_tracking_on_land_insert();


-- ── TRIGGER: DECREMENT ON LISTING DELETED ─────────────────────────────────────
--
-- Fires AFTER DELETE on land_listings.
-- Decrements land_listing_count (floor 0).
-- Also decrements featured_listing_count if the deleted listing was featured.
-- Silently skips if no usage_tracking row exists (historical listings
-- created before this migration).

create or replace function public.usage_tracking_on_land_delete()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  update public.usage_tracking
  set
    land_listing_count = greatest(0, land_listing_count - 1),
    featured_listing_count = case
      when old.is_featured then greatest(0, featured_listing_count - 1)
      else featured_listing_count
    end,
    updated_at = now()
  where profile_id = old.owner_id;

  -- No error if row doesn't exist — historical listings pre-migration are safe
  return old;
end;
$$;

create trigger land_listings_usage_delete
  after delete on public.land_listings
  for each row
  execute function public.usage_tracking_on_land_delete();


-- ── TRIGGER: SYNC FEATURED COUNT ON is_featured CHANGE ───────────────────────
--
-- Fires AFTER UPDATE on land_listings when is_featured changes.
-- featured_listing_count tracks CURRENTLY ACTIVE featured listings —
-- it increments when is_featured is set true and decrements when unset.
-- This counter is NOT reset monthly; it reflects current state at all times.

create or replace function public.usage_tracking_on_featured_change()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  -- Only act when is_featured actually changes
  if new.is_featured = old.is_featured then
    return new;
  end if;

  if new.is_featured = true then
    -- Listing is being featured — increment
    update public.usage_tracking
    set
      featured_listing_count = featured_listing_count + 1,
      updated_at             = now()
    where profile_id = new.owner_id;

  else
    -- Listing is being un-featured — decrement (floor 0)
    update public.usage_tracking
    set
      featured_listing_count = greatest(0, featured_listing_count - 1),
      updated_at             = now()
    where profile_id = new.owner_id;
  end if;

  return new;
end;
$$;

create trigger land_listings_usage_featured
  after update of is_featured on public.land_listings
  for each row
  execute function public.usage_tracking_on_featured_change();


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table public.usage_tracking enable row level security;

-- Authenticated users: read their own usage (for dashboard, limit checks)
create policy "usage_tracking_select_own"
  on public.usage_tracking
  for select
  to authenticated
  using (profile_id = auth.uid());

-- Admin: read all rows (reporting, support, abuse detection)
create policy "usage_tracking_select_admin"
  on public.usage_tracking
  for select
  to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- All writes flow through SECURITY DEFINER trigger functions.
-- Direct writes from the application layer are intentionally blocked.


-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────
-- set_updated_at() is defined in 20260522100001_land_listings.sql (idempotent).

create trigger usage_tracking_updated_at
  before update on public.usage_tracking
  for each row
  execute function public.set_updated_at();


-- ── COMMENTS ─────────────────────────────────────────────────────────────────

comment on table public.usage_tracking is
  'Free-tier usage counters per profile. '
  'Rows created lazily on first land listing insert (UPSERT). '
  'land_listing_count resets monthly (lazy: on first action of the new month). '
  'featured_listing_count tracks currently active featured listings — never resets. '
  'All writes via SECURITY DEFINER triggers; application layer reads only.';

comment on column public.usage_tracking.reset_period is
  'First day of the current billing month (DATE). '
  'On INSERT trigger: if reset_period < current month, land_listing_count resets to 1. '
  'No pg_cron required — reset is lazy, triggered by user action.';

comment on column public.usage_tracking.featured_listing_count is
  'Count of currently active featured land listings for this profile. '
  'NOT a per-period counter — tracks live state. '
  'Increments when is_featured is set true, decrements when unset or listing deleted.';

comment on column public.usage_tracking.land_listing_count is
  'Listings created in the current reset_period. '
  'Decrements on listing delete (floor 0). '
  'Application layer compares this against the free-tier limit constant.';
