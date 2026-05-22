// ---------------------------------------------------------------------------
// Sitemap generation service for VIO LOCAL.
//
// Architecture:
//   Four sub-sitemaps served at /sitemap-{geo,storefronts,products,services}.xml
//   A sitemap index at /sitemap.xml references all four.
//
// All generation happens server-side in TanStack Start route handlers.
// Responses must be cached (1 hour) — sitemap generation queries are
// expensive and change slowly.
//
// Thin-page guard:
//   Only pages that pass the indexed threshold (from thin-page.ts) appear
//   in the sitemap. noindex pages are excluded even if they render.
//
// SQL dependencies:
//   Requires migration 20260522000002_sitemap_helpers.sql for the RPC
//   functions used by getGeoSitemapEntries().
//
// URL convention:
//   VITE_SITE_URL must be set in .env.local (e.g. https://violocal.vn).
//   Never hardcode the domain — staging and production share this file.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import { THRESHOLDS } from './thin-page'

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

export function getSiteUrl(): string {
  const url = import.meta.env.VITE_SITE_URL
  if (!url) throw new Error('VITE_SITE_URL is not set — add it to .env.local')
  return url.replace(/\/$/, '')  // strip trailing slash
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeFreq =
  | 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

export interface SitemapEntry {
  /** Absolute URL — already includes getSiteUrl() prefix. */
  loc:         string
  /** YYYY-MM-DD format. */
  lastmod?:    string
  changefreq?: ChangeFreq
  /** 0.0–1.0. Informational only — Google ignores this field. */
  priority?:   number
}

export interface SitemapIndexEntry {
  loc:      string
  lastmod?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const today = new Date().toISOString().split('T')[0]

function toDate(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return today
  return isoTimestamp.split('T')[0]
}

// ---------------------------------------------------------------------------
// Geo sitemap
//
// Includes four URL classes, each filtered by the thin-page thresholds:
//   Province pages         /:province                (≥ 10 storefronts)
//   District pages         /:province/:district      (≥  3 storefronts)
//   Category+Province      /:province/:category      (≥  3 listings)
//   Category+District      /:province/:dist/:cat     (≥  2 listings)
// ---------------------------------------------------------------------------

export async function getGeoSitemapEntries(
  supabase: SupabaseClient,
): Promise<SitemapEntry[]> {
  const base    = getSiteUrl()
  const entries: SitemapEntry[] = []

  // ── Province pages ────────────────────────────────────────────────────────
  // Uses get_province_storefront_counts() to avoid N+1 queries.
  const { data: provinceCounts, error: provErr } = await supabase
    .rpc('get_province_storefront_counts')

  if (provErr) throw provErr

  for (const p of provinceCounts ?? []) {
    if (Number(p.total) < THRESHOLDS.province) continue
    entries.push({
      loc:         `${base}/${p.province_slug}`,
      lastmod:     today,
      changefreq:  'daily',
      priority:    0.9,
    })
  }

  // ── District pages ────────────────────────────────────────────────────────
  // district_discovery_summary materialized view already has counts.
  // We need province slugs for URL construction — join via provinces table.
  const [{ data: districtRows, error: distErr }, { data: allProvinces, error: provSlugErr }] =
    await Promise.all([
      supabase
        .from('district_discovery_summary')
        .select('slug, province_id, storefront_count')
        .gte('storefront_count', THRESHOLDS.district),
      supabase
        .from('provinces')
        .select('id, slug'),
    ])

  if (distErr)    throw distErr
  if (provSlugErr) throw provSlugErr

  const provinceSlugMap = new Map<number, string>(
    (allProvinces ?? []).map(p => [p.id, p.slug])
  )

  for (const d of districtRows ?? []) {
    const provSlug = provinceSlugMap.get(d.province_id)
    if (!provSlug) continue
    entries.push({
      loc:         `${base}/${provSlug}/${d.slug}`,
      lastmod:     today,
      changefreq:  'daily',
      priority:    0.8,
    })
  }

  // ── Category + Province pages ─────────────────────────────────────────────
  // Both products and services can occupy the same URL (/province/category).
  // Run both and de-duplicate by loc.
  const [{ data: catProvProducts }, { data: catProvServices }] = await Promise.all([
    supabase.rpc('get_category_province_counts', {
      p_entity:    'product',
      p_min_count: THRESHOLDS.categoryProvince,
    }),
    supabase.rpc('get_category_province_counts', {
      p_entity:    'service',
      p_min_count: THRESHOLDS.categoryProvince,
    }),
  ])

  const catProvSeen = new Set<string>()
  for (const row of [...(catProvProducts ?? []), ...(catProvServices ?? [])]) {
    const loc = `${base}/${row.province_slug}/${row.category_slug}`
    if (catProvSeen.has(loc)) continue
    catProvSeen.add(loc)
    entries.push({
      loc,
      lastmod:     toDate(row.last_updated),
      changefreq:  'weekly',
      priority:    0.7,
    })
  }

  // ── Category + District pages ─────────────────────────────────────────────
  const [{ data: catDistProducts }, { data: catDistServices }] = await Promise.all([
    supabase.rpc('get_category_district_counts', {
      p_entity:    'product',
      p_min_count: THRESHOLDS.categoryDistrict,
    }),
    supabase.rpc('get_category_district_counts', {
      p_entity:    'service',
      p_min_count: THRESHOLDS.categoryDistrict,
    }),
  ])

  const catDistSeen = new Set<string>()
  for (const row of [...(catDistProducts ?? []), ...(catDistServices ?? [])]) {
    const loc = `${base}/${row.province_slug}/${row.district_slug}/${row.category_slug}`
    if (catDistSeen.has(loc)) continue
    catDistSeen.add(loc)
    entries.push({
      loc,
      lastmod:     toDate(row.last_updated),
      changefreq:  'weekly',
      priority:    0.6,
    })
  }

  return entries
}

// ---------------------------------------------------------------------------
// Storefront sitemap
// Only public storefronts. Ordered by most-recently updated.
// ---------------------------------------------------------------------------

export async function getStorefrontSitemapEntries(
  supabase: SupabaseClient,
): Promise<SitemapEntry[]> {
  const base = getSiteUrl()

  const { data, error } = await supabase
    .from('storefronts')
    .select('slug, updated_at')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(40_000)  // Google limit is 50k per file — 40k leaves headroom

  if (error) throw error

  return (data ?? []).map(row => ({
    loc:        `${base}/ho-kinh-doanh/${row.slug}`,
    lastmod:    toDate(row.updated_at),
    changefreq: 'weekly' as ChangeFreq,
    priority:   0.8,
  }))
}

// ---------------------------------------------------------------------------
// Product sitemap
// Only available products whose storefront is public.
// ---------------------------------------------------------------------------

export async function getProductSitemapEntries(
  supabase: SupabaseClient,
): Promise<SitemapEntry[]> {
  const base = getSiteUrl()

  const { data, error } = await supabase
    .from('products')
    .select('slug, updated_at, storefronts!inner(is_public)')
    .eq('is_available', true)
    .eq('storefronts.is_public', true)
    .order('updated_at', { ascending: false })
    .limit(40_000)

  if (error) throw error

  return (data ?? []).map(row => ({
    loc:        `${base}/san-pham/${row.slug}`,
    lastmod:    toDate(row.updated_at),
    changefreq: 'weekly' as ChangeFreq,
    priority:   0.6,
  }))
}

// ---------------------------------------------------------------------------
// Service sitemap
// ---------------------------------------------------------------------------

export async function getServiceSitemapEntries(
  supabase: SupabaseClient,
): Promise<SitemapEntry[]> {
  const base = getSiteUrl()

  const { data, error } = await supabase
    .from('services')
    .select('slug, updated_at, storefronts!inner(is_public)')
    .eq('is_available', true)
    .eq('storefronts.is_public', true)
    .order('updated_at', { ascending: false })
    .limit(40_000)

  if (error) throw error

  return (data ?? []).map(row => ({
    loc:        `${base}/dich-vu/${row.slug}`,
    lastmod:    toDate(row.updated_at),
    changefreq: 'weekly' as ChangeFreq,
    priority:   0.6,
  }))
}

// ---------------------------------------------------------------------------
// XML builders
// ---------------------------------------------------------------------------

/** Escapes the five XML special characters in URLs and text values. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Builds a `<urlset>` sitemap XML string.
 * Pass as the response body with Content-Type: application/xml; charset=utf-8.
 */
export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(entry => {
      const parts = [`  <loc>${escapeXml(entry.loc)}</loc>`]
      if (entry.lastmod)              parts.push(`  <lastmod>${entry.lastmod}</lastmod>`)
      if (entry.changefreq)           parts.push(`  <changefreq>${entry.changefreq}</changefreq>`)
      if (entry.priority != null)     parts.push(`  <priority>${entry.priority.toFixed(1)}</priority>`)
      return `<url>\n${parts.join('\n')}\n</url>`
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('\n')
}

/**
 * Builds the `<sitemapindex>` XML served at /sitemap.xml.
 */
export function buildSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string {
  const items = sitemaps
    .map(s => {
      const loc     = `  <loc>${escapeXml(s.loc)}</loc>`
      const lastmod = s.lastmod ? `\n  <lastmod>${s.lastmod}</lastmod>` : ''
      return `<sitemap>\n${loc}${lastmod}\n</sitemap>`
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    items,
    '</sitemapindex>',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Sitemap index convenience builder
// ---------------------------------------------------------------------------

/**
 * Builds the sitemap index pointing to all four sub-sitemaps.
 * Use this directly in the /sitemap.xml route handler.
 *
 * TanStack Start example:
 *   export const Route = createServerFileRoute('/sitemap.xml').methods({
 *     GET: async () => new Response(buildSitemapIndex(), {
 *       headers: {
 *         'Content-Type':  'application/xml; charset=utf-8',
 *         'Cache-Control': SITEMAP_CACHE_CONTROL,
 *       },
 *     }),
 *   })
 */
export function buildSitemapIndex(): string {
  const base = getSiteUrl()
  return buildSitemapIndexXml([
    { loc: `${base}/sitemap-geo.xml`,         lastmod: today },
    { loc: `${base}/sitemap-storefronts.xml`, lastmod: today },
    { loc: `${base}/sitemap-products.xml`,    lastmod: today },
    { loc: `${base}/sitemap-services.xml`,    lastmod: today },
  ])
}

// ---------------------------------------------------------------------------
// HTTP headers
// ---------------------------------------------------------------------------

/**
 * Cache-Control for sitemap responses.
 * 1 hour public cache — sitemaps change slowly and generation is expensive.
 * s-maxage targets Cloudflare / edge caches.
 */
export const SITEMAP_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600'

/** Content-Type for all sitemap XML responses. */
export const SITEMAP_CONTENT_TYPE = 'application/xml; charset=utf-8'
