// ---------------------------------------------------------------------------
// Land listings service — query and mutation functions.
//
// Pattern: accept SupabaseClient as first param → usable both server-side
// (SSR route loaders) and client-side (browser Supabase client).
//
// Visibility contract (enforced by DB RLS + repeated here for clarity):
//   Public queries  → only is_public=true AND moderation_status='approved'
//   Owner queries   → all moderation states for owner's own listings
//   Admin queries   → handled server-side with service role key (not here)
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  LandListing,
  LandListingImage,
  LandListingWithCover,
  LandDiscoveryPage,
  CreateLandListingInput,
  UpdateLandListingInput,
  LandType,
} from '../types'

export const LAND_PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Public discovery queries
// ---------------------------------------------------------------------------

/**
 * Single listing by slug. Returns null if not found or not publicly visible.
 * Used by the /dat-nong-nghiep/:slug route loader.
 *
 * RLS enforces is_public=true AND moderation_status='approved' for anon.
 * Owner can see their own regardless of state — RLS has separate policy.
 */
export async function getLandListingBySlug(
  supabase: SupabaseClient,
  slug:     string,
): Promise<LandListing | null> {
  const { data } = await supabase
    .from('land_listings')
    .select('*')
    .eq('slug', slug)
    .single()

  return data ?? null
}

/**
 * Province-level discovery: /dat-nong-nghiep/dong-nai
 * Featured listings first, then newest.
 */
export async function getLandListingsByProvince(
  supabase:    SupabaseClient,
  provinceId:  number,
  page = 0,
): Promise<LandDiscoveryPage> {
  const from = page * LAND_PAGE_SIZE
  const { data, count, error } = await supabase
    .from('land_listings')
    .select('*', { count: 'exact' })
    .eq('province_id', provinceId)
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + LAND_PAGE_SIZE - 1)

  if (error) throw error
  return {
    items:   (data ?? []) as LandListing[],
    total:   count ?? 0,
    hasMore: (count ?? 0) > from + LAND_PAGE_SIZE,
  }
}

/**
 * District-level discovery: /dat-nong-nghiep/dong-nai/xuan-loc
 * Featured listings first, then newest.
 */
export async function getLandListingsByDistrict(
  supabase:   SupabaseClient,
  districtId: number,
  page = 0,
): Promise<LandDiscoveryPage> {
  const from = page * LAND_PAGE_SIZE
  const { data, count, error } = await supabase
    .from('land_listings')
    .select('*', { count: 'exact' })
    .eq('district_id', districtId)
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + LAND_PAGE_SIZE - 1)

  if (error) throw error
  return {
    items:   (data ?? []) as LandListing[],
    total:   count ?? 0,
    hasMore: (count ?? 0) > from + LAND_PAGE_SIZE,
  }
}

/**
 * Filter by land type within a province.
 * Used for land-type section headings on province discovery pages.
 * e.g. "Đất cây lâu năm tại Đồng Nai"
 */
export async function getLandListingsByType(
  supabase:   SupabaseClient,
  provinceId: number,
  landType:   LandType,
  page = 0,
): Promise<LandDiscoveryPage> {
  const from = page * LAND_PAGE_SIZE
  const { data, count, error } = await supabase
    .from('land_listings')
    .select('*', { count: 'exact' })
    .eq('province_id', provinceId)
    .eq('land_type', landType)
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + LAND_PAGE_SIZE - 1)

  if (error) throw error
  return {
    items:   (data ?? []) as LandListing[],
    total:   count ?? 0,
    hasMore: (count ?? 0) > from + LAND_PAGE_SIZE,
  }
}

/**
 * Nearby land listings using the same hierarchical fill-up strategy
 * as getNearbyStorefronts() — ward → district → province.
 * No PostGIS. Used on listing detail pages.
 */
export async function getNearbyLandListings(
  supabase: SupabaseClient,
  origin: {
    id:          string
    ward_id:     number | null
    district_id: number | null
    province_id: number | null
  },
  limit = 6,
): Promise<LandListing[]> {
  const results: LandListing[] = []
  const excludeIds = new Set([origin.id])

  const publicApproved = (query: ReturnType<typeof supabase.from>) =>
    query
      .eq('is_public', true)
      .eq('moderation_status', 'approved')
      .not('id', 'in', `(${[...excludeIds].join(',')})`)
      .order('is_featured', { ascending: false })

  // Level 1 — same ward
  if (origin.ward_id && results.length < limit) {
    const { data } = await publicApproved(
      supabase.from('land_listings').select('*')
        .eq('ward_id', origin.ward_id)
    ).limit(limit - results.length)

    for (const row of data ?? []) {
      results.push(row as LandListing)
      excludeIds.add(row.id)
    }
  }

  // Level 2 — same district (fill remaining)
  if (origin.district_id && results.length < limit) {
    const { data } = await publicApproved(
      supabase.from('land_listings').select('*')
        .eq('district_id', origin.district_id)
    ).order('created_at', { ascending: false })
     .limit(limit - results.length)

    for (const row of data ?? []) {
      results.push(row as LandListing)
      excludeIds.add(row.id)
    }
  }

  // Level 3 — same province, different district (fill remaining)
  if (origin.province_id && origin.district_id && results.length < limit) {
    const { data } = await publicApproved(
      supabase.from('land_listings').select('*')
        .eq('province_id', origin.province_id)
        .neq('district_id', origin.district_id)
    ).order('created_at', { ascending: false })
     .limit(limit - results.length)

    for (const row of data ?? []) {
      results.push(row as LandListing)
    }
  }

  return results
}

/**
 * Listing images ordered by sort_order.
 * sort_order=0 is always the cover image.
 */
export async function getLandListingImages(
  supabase:   SupabaseClient,
  listingId:  string,
): Promise<LandListingImage[]> {
  const { data } = await supabase
    .from('land_listing_images')
    .select('*')
    .eq('land_listing_id', listingId)
    .order('sort_order', { ascending: true })

  return (data ?? []) as LandListingImage[]
}

/**
 * Province-level district summary for province discovery pages.
 * Returns districts with at least one public+approved land listing,
 * sorted by listing count descending — used for district nav links.
 */
export async function getLandDistrictSummary(
  supabase:   SupabaseClient,
  provinceId: number,
): Promise<{ district_id: number; slug: string; name: string; listing_count: number }[]> {
  // PostgREST can't GROUP BY — use the RPC helper from sitemap_helpers migration
  // or fall back to a client-side aggregation from per-district counts.
  // For now: fetch active districts via a simple aggregation RPC.
  const { data, error } = await supabase
    .rpc('get_land_district_summary', { p_province_id: provinceId })

  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------------
// Owner queries
// ---------------------------------------------------------------------------

/**
 * All listings owned by a user, including drafts and pending-moderation.
 * Sorted newest first for the dashboard.
 */
export async function getOwnLandListings(
  supabase: SupabaseClient,
  ownerId:  string,
): Promise<LandListing[]> {
  const { data, error } = await supabase
    .from('land_listings')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as LandListing[]
}

// ---------------------------------------------------------------------------
// Mutation functions
// ---------------------------------------------------------------------------

/**
 * Creates a new land listing.
 * New listings always start with is_public=false, moderation_status='pending'.
 * The owner can publish (set is_public=true) after the listing is approved.
 */
export async function createLandListing(
  supabase: SupabaseClient,
  ownerId:  string,
  input:    CreateLandListingInput,
): Promise<LandListing> {
  const { data, error } = await supabase
    .from('land_listings')
    .insert({
      ...input,
      owner_id:          ownerId,
      is_public:         false,      // draft by default
      is_featured:       false,      // admin-only
      moderation_status: 'pending',  // always starts pending
    })
    .select()
    .single()

  if (error) throw error
  return data as LandListing
}

/**
 * Updates owner-controlled fields on a listing.
 * is_featured and moderation_status are NOT accepted — they are admin-only.
 */
export async function updateLandListing(
  supabase:  SupabaseClient,
  id:        string,
  input:     UpdateLandListingInput,
): Promise<LandListing> {
  const { data, error } = await supabase
    .from('land_listings')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as LandListing
}

/**
 * Publishes a listing (sets is_public=true).
 * Only works if moderation_status='approved' — otherwise listing remains invisible.
 * Owners can re-publish after unpublishing.
 */
export async function publishLandListing(
  supabase: SupabaseClient,
  id:       string,
): Promise<void> {
  const { error } = await supabase
    .from('land_listings')
    .update({ is_public: true })
    .eq('id', id)

  if (error) throw error
}

/**
 * Unpublishes a listing (sets is_public=false).
 * Owner can take their listing offline without deleting it.
 */
export async function unpublishLandListing(
  supabase: SupabaseClient,
  id:       string,
): Promise<void> {
  const { error } = await supabase
    .from('land_listings')
    .update({ is_public: false })
    .eq('id', id)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a land listing slug is already taken.
 * Used by slug generation to ensure uniqueness before insert.
 *
 * IMPORTANT: land listing slugs must not collide with province slugs.
 * The route loader for /dat-nong-nghiep/:segment resolves province slugs
 * first — a collision would cause the listing to be unreachable.
 * Enforce by: appending district name + year to generated slugs.
 */
export async function landListingSlugExists(
  supabase: SupabaseClient,
  slug:     string,
): Promise<boolean> {
  const { count } = await supabase
    .from('land_listings')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
    .single()

  return (count ?? 0) > 0
}

/**
 * Checks whether a segment is a province slug.
 * Used by the route loader to disambiguate /dat-nong-nghiep/:segment.
 */
export async function isProvinceSlug(
  supabase: SupabaseClient,
  segment:  string,
): Promise<boolean> {
  const { count } = await supabase
    .from('provinces')
    .select('id', { count: 'exact', head: true })
    .eq('slug', segment)
    .single()

  return (count ?? 0) > 0
}
