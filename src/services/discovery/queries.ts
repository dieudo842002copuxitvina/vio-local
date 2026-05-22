// ---------------------------------------------------------------------------
// Discovery query functions — run in TanStack Start route loaders (SSR)
// for SEO-indexed pages. Client-side pagination reuses the same functions
// via createBrowserSupabaseClient().
//
// Pattern: accept a SupabaseClient param → works both server-side and
// client-side without duplicating the SQL.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Storefront } from '../../features/storefronts/types'
import type { Product } from '../../features/products/types'
import type { Service } from '../../features/services/types'

export const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistrictSummary {
  district_id: number
  province_id: number
  name: string
  name_full: string
  slug: string
  storefront_count: number
  product_count: number
  service_count: number
}

export interface DiscoveryPage<T> {
  items: T[]
  total: number
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Province-level discovery
// ---------------------------------------------------------------------------

/** All storefronts in a province. Verified first, then newest. */
export async function getProvinceStorefronts(
  supabase: SupabaseClient,
  provinceId: number,
  page = 0,
): Promise<DiscoveryPage<Storefront>> {
  const from = page * PAGE_SIZE
  const { data, count, error } = await supabase
    .from('storefronts')
    .select('*', { count: 'exact' })
    .eq('province_id', provinceId)
    .eq('is_public', true)
    .order('is_verified', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error
  return {
    items:   data ?? [],
    total:   count ?? 0,
    hasMore: (count ?? 0) > from + PAGE_SIZE,
  }
}

/** District list for a province page — uses materialized view. O(1) reads. */
export async function getProvinceDistrictSummary(
  supabase: SupabaseClient,
  provinceId: number,
): Promise<DistrictSummary[]> {
  const { data, error } = await supabase
    .from('district_discovery_summary')
    .select('*')
    .eq('province_id', provinceId)
    .gt('storefront_count', 0)   // skip empty districts (thin page guard)
    .order('storefront_count', { ascending: false })

  if (error) throw error
  return (data ?? []) as DistrictSummary[]
}

// ---------------------------------------------------------------------------
// District-level discovery
// ---------------------------------------------------------------------------

/** All storefronts in a district. Verified first, then newest. */
export async function getDistrictStorefronts(
  supabase: SupabaseClient,
  districtId: number,
  page = 0,
): Promise<DiscoveryPage<Storefront>> {
  const from = page * PAGE_SIZE
  const { data, count, error } = await supabase
    .from('storefronts')
    .select('*', { count: 'exact' })
    .eq('district_id', districtId)
    .eq('is_public', true)
    .order('is_verified', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error
  return {
    items:   data ?? [],
    total:   count ?? 0,
    hasMore: (count ?? 0) > from + PAGE_SIZE,
  }
}

// ---------------------------------------------------------------------------
// Category + geo discovery
// ---------------------------------------------------------------------------

/** Products in a province filtered by category. Used by /[province]/[category]. */
export async function getProvinceProducts(
  supabase: SupabaseClient,
  provinceId: number,
  categoryId: number,
  page = 0,
): Promise<DiscoveryPage<Product>> {
  const from = page * PAGE_SIZE
  const { data, count, error } = await supabase
    .from('products')
    .select('*, storefronts!inner(is_public, is_verified, business_name, slug)', { count: 'exact' })
    .eq('province_id', provinceId)
    .eq('category_id', categoryId)
    .eq('is_available', true)
    .eq('storefronts.is_public', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error
  return {
    items:   (data ?? []) as unknown as Product[],
    total:   count ?? 0,
    hasMore: (count ?? 0) > from + PAGE_SIZE,
  }
}

/** Products in a district filtered by category. */
export async function getDistrictProducts(
  supabase: SupabaseClient,
  districtId: number,
  categoryId: number,
  page = 0,
): Promise<DiscoveryPage<Product>> {
  const from = page * PAGE_SIZE
  const { data, count, error } = await supabase
    .from('products')
    .select('*, storefronts!inner(is_public, is_verified, business_name, slug)', { count: 'exact' })
    .eq('district_id', districtId)
    .eq('category_id', categoryId)
    .eq('is_available', true)
    .eq('storefronts.is_public', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error
  return {
    items:   (data ?? []) as unknown as Product[],
    total:   count ?? 0,
    hasMore: (count ?? 0) > from + PAGE_SIZE,
  }
}

/** Services in a province filtered by category. */
export async function getProvinceServices(
  supabase: SupabaseClient,
  provinceId: number,
  categoryId: number,
  page = 0,
): Promise<DiscoveryPage<Service>> {
  const from = page * PAGE_SIZE
  const { data, count, error } = await supabase
    .from('services')
    .select('*, storefronts!inner(is_public, business_name, slug)', { count: 'exact' })
    .eq('province_id', provinceId)
    .eq('category_id', categoryId)
    .eq('is_available', true)
    .eq('storefronts.is_public', true)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error
  return {
    items:   (data ?? []) as unknown as Service[],
    total:   count ?? 0,
    hasMore: (count ?? 0) > from + PAGE_SIZE,
  }
}

// ---------------------------------------------------------------------------
// Nearby discovery — hierarchical fill-up (no PostGIS, no lat/lng math)
//
// Strategy: ward → district → province
// "Nearby" in rural Vietnam IS the administrative hierarchy.
// A farmer searches "nearby" meaning: same commune first, then same district,
// then same province. PostGIS Haversine is overkill and slower for this model.
// ---------------------------------------------------------------------------

export interface NearbyStorefront extends Storefront {
  proximity: 'ward' | 'district' | 'province'
}

/**
 * Fills a nearby storefront list from narrow to wide geographic scope.
 * Starts at ward, expands to district, expands to province until `limit` is reached.
 * Excludes the origin storefront.
 */
export async function getNearbyStorefronts(
  supabase: SupabaseClient,
  origin: {
    id: string
    ward_id: number | null
    district_id: number | null
    province_id: number | null
  },
  limit = 8,
): Promise<NearbyStorefront[]> {
  const results: NearbyStorefront[] = []
  const excludeIds = new Set([origin.id])

  // Level 1 — same ward
  if (origin.ward_id && results.length < limit) {
    const { data } = await supabase
      .from('storefronts')
      .select('*')
      .eq('ward_id', origin.ward_id)
      .eq('is_public', true)
      .not('id', 'in', `(${[...excludeIds].join(',')})`)
      .order('is_verified', { ascending: false })
      .limit(limit - results.length)

    for (const row of data ?? []) {
      results.push({ ...(row as Storefront), proximity: 'ward' })
      excludeIds.add(row.id)
    }
  }

  // Level 2 — same district (fill remaining slots)
  if (origin.district_id && results.length < limit) {
    const { data } = await supabase
      .from('storefronts')
      .select('*')
      .eq('district_id', origin.district_id)
      .eq('is_public', true)
      .not('id', 'in', `(${[...excludeIds].join(',')})`)
      .order('is_verified', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit - results.length)

    for (const row of data ?? []) {
      results.push({ ...(row as Storefront), proximity: 'district' })
      excludeIds.add(row.id)
    }
  }

  // Level 3 — same province, different district (fill remaining slots)
  if (origin.province_id && origin.district_id && results.length < limit) {
    const { data } = await supabase
      .from('storefronts')
      .select('*')
      .eq('province_id', origin.province_id)
      .neq('district_id', origin.district_id)
      .eq('is_public', true)
      .not('id', 'in', `(${[...excludeIds].join(',')})`)
      .order('is_verified', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit - results.length)

    for (const row of data ?? []) {
      results.push({ ...(row as Storefront), proximity: 'province' })
    }
  }

  return results
}

/**
 * Nearby products: same category, widening geo scope.
 * Used on product pages: "Sản phẩm tương tự gần đây"
 */
export async function getNearbyProducts(
  supabase: SupabaseClient,
  origin: {
    id: string
    category_id: number | null
    district_id: number | null
    province_id: number | null
  },
  limit = 6,
): Promise<Product[]> {
  if (!origin.category_id) return []

  const results: Product[] = []
  const excludeIds = new Set([origin.id])

  // Level 1 — same district + category
  if (origin.district_id && results.length < limit) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('district_id', origin.district_id)
      .eq('category_id', origin.category_id)
      .eq('is_available', true)
      .not('id', 'in', `(${[...excludeIds].join(',')})`)
      .order('is_featured', { ascending: false })
      .limit(limit - results.length)

    for (const row of data ?? []) {
      results.push(row as Product)
      excludeIds.add(row.id)
    }
  }

  // Level 2 — same province + category (fill remaining)
  if (origin.province_id && results.length < limit) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('province_id', origin.province_id)
      .eq('category_id', origin.category_id)
      .eq('is_available', true)
      .not('id', 'in', `(${[...excludeIds].join(',')})`)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit - results.length)

    for (const row of data ?? []) results.push(row as Product)
  }

  return results
}

// ---------------------------------------------------------------------------
// Internal linking data — powers the SEO link graph sections on every page
// ---------------------------------------------------------------------------

/** Products from the same storefront. Used on storefront and product pages. */
export async function getStorefrontProducts(
  supabase: SupabaseClient,
  storefrontId: string,
  excludeId?: string,
  limit = 6,
): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .eq('storefront_id', storefrontId)
    .eq('is_available', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query
  return (data ?? []) as Product[]
}

/** Districts in a province that have at least one public storefront.
 *  Used on province pages to generate the district nav link list. */
export async function getActiveDistricts(
  supabase: SupabaseClient,
  provinceId: number,
): Promise<DistrictSummary[]> {
  const { data, error } = await supabase
    .from('district_discovery_summary')
    .select('*')
    .eq('province_id', provinceId)
    .gt('storefront_count', 0)
    .order('storefront_count', { ascending: false })

  if (error) throw error
  return (data ?? []) as DistrictSummary[]
}

// ---------------------------------------------------------------------------
// Thin page guard — noindex if below minimum content threshold
// ---------------------------------------------------------------------------

export const THIN_PAGE_THRESHOLDS = {
  province:         10,  // province page needs ≥10 storefronts
  district:          3,  // district page needs ≥3 storefronts
  categoryProvince:  3,  // /[province]/[category] needs ≥3 listings
  categoryDistrict:  2,  // /[province]/[district]/[category] needs ≥2 listings
} as const

export function isThinPage(
  type: keyof typeof THIN_PAGE_THRESHOLDS,
  count: number,
): boolean {
  return count < THIN_PAGE_THRESHOLDS[type]
}
