// ---------------------------------------------------------------------------
// OpenGraph foundations for VIO LOCAL.
//
// This file is the single source of truth for:
//   - OG tag types used across all entity seo.ts files
//   - Image transform helpers (1200×630 for Facebook/TikTok/Zalo)
//   - Platform-specific documentation (what each crawler reads)
//   - Head meta array builder for TanStack Start route loaders
//
// Import from here in every entity seo.ts:
//   import type { OgMeta } from '../../../services/seo/og'
//   import { buildOgImageUrl, ogToHeadMeta } from '../../../services/seo/og'
//
// See docs/OPENGRAPH_ARCHITECTURE.md for the full rationale.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Image dimensions
// ---------------------------------------------------------------------------

/**
 * Standard OG image size.
 * - Facebook: displayed at 1200×630 in feed; 600×315 on mobile.
 * - TikTok:   displayed at 1200×630 in bio link previews.
 * - Zalo:     displayed at full size when link is tapped; thumbnail is cropped.
 */
export const OG_IMAGE_WIDTH  = 1200
export const OG_IMAGE_HEIGHT = 630

/**
 * Zalo safe zone — content critical to the thumbnail must stay within this
 * centered rectangle. Zalo crops the OG image to a square thumbnail in some
 * surfaces (chat message previews). Center-crop of 1200×630 = 630×630.
 *
 * Rule: product name, storefront name, or land title must be readable if
 * the outer 285px on each side are hidden.
 *
 * This is a design guideline for OG images, not a transform parameter.
 */
export const OG_ZALO_SAFE_ZONE_SIZE = 630   // pixels — centered in 1200×630

// ---------------------------------------------------------------------------
// Core OG types
// ---------------------------------------------------------------------------

/**
 * og:type values used on VIO LOCAL.
 *
 * 'business.business' — Facebook-specific extended type. Renders a rich
 *   business card in Facebook feed with address and phone number fields.
 *   Only valid for storefront pages. Requires og:latitude/longitude and
 *   og:street-address to get the full card — omit these until PostGIS lands.
 *
 * 'website' — universal fallback. Used for products, services, land listings,
 *   and all discovery pages. Renders as a standard link card on all platforms.
 */
export type OgType = 'website' | 'business.business'

/**
 * Twitter card type.
 * TikTok reads twitter:card to determine layout — always use
 * 'summary_large_image' for the full-width image preview in TikTok bio links.
 */
export type TwitterCard = 'summary_large_image' | 'summary'

// ---------------------------------------------------------------------------
// OgImageMeta — image-specific sub-type
// ---------------------------------------------------------------------------

export interface OgImageMeta {
  url:     string        // Absolute URL — required; relative URLs are ignored
  width:   typeof OG_IMAGE_WIDTH   // always 1200
  height:  typeof OG_IMAGE_HEIGHT  // always 630
  alt:     string        // Descriptive alt text for screen readers and crawlers
  type:    'image/webp'  // all transforms use WebP
}

// ---------------------------------------------------------------------------
// OgMeta — canonical shape for all entities
// ---------------------------------------------------------------------------

/**
 * Complete set of OG + Twitter/TikTok meta tags for a single page.
 *
 * All fields are required except image (null = no image, use platform default).
 * Pass this to ogToHeadMeta() to get a TanStack Start head meta array.
 */
export interface OgMeta {
  // ── Core OG ──────────────────────────────────────────────────────────────
  title:       string           // og:title — 60–90 chars; include geo for discovery pages
  description: string           // og:description — max 160 chars
  url:         string           // og:url — canonical absolute URL
  image:       OgImageMeta | null
  type:        OgType           // og:type
  locale:      'vi_VN'          // og:locale — always Vietnamese
  siteName:    'VIO LOCAL'      // og:site_name

  // ── Twitter / TikTok ─────────────────────────────────────────────────────
  // TikTok reads twitter:* tags. Keep these in sync with og:* values.
  twitterCard: TwitterCard      // twitter:card
}

// ---------------------------------------------------------------------------
// Image transform — Supabase Storage Transform API
// ---------------------------------------------------------------------------

/**
 * Builds an absolute Supabase Storage Transform URL sized to OG dimensions.
 *
 * Uses resize=cover: crops to EXACTLY 1200×630 (centre crop).
 * This is intentional — do not use resize=contain (adds letterbox bars
 * that look broken in Facebook/Zalo previews).
 *
 * @param storagePath  Relative path inside the `media` bucket.
 *                     e.g. "storefronts/uuid/cover.webp"
 *                     e.g. "products/uuid/0.webp"
 *                     e.g. "land-listings/uuid/0.webp"
 * @returns            Absolute Supabase Transform URL, or null if no path.
 */
export function buildOgImageUrl(storagePath: string | null | undefined): OgImageMeta | null {
  if (!storagePath) return null

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) return null

  const url = [
    `${supabaseUrl}/storage/v1/render/image/public/media/${storagePath}`,
    `?width=${OG_IMAGE_WIDTH}`,
    `&height=${OG_IMAGE_HEIGHT}`,
    `&resize=cover`,
    `&quality=80`,
    `&format=webp`,
  ].join('')

  return {
    url,
    width:  OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt:    '',  // caller must set a descriptive alt
    type:   'image/webp',
  }
}

/**
 * Attaches an alt text string to an OgImageMeta.
 * Chain after buildOgImageUrl():
 *   const image = withAlt(buildOgImageUrl(path), 'Cà phê Buôn Me tại Đắk Lắk')
 */
export function withAlt(image: OgImageMeta | null, alt: string): OgImageMeta | null {
  if (!image) return null
  return { ...image, alt }
}

// ---------------------------------------------------------------------------
// Storage path helpers — OG image source selection per entity type
// ---------------------------------------------------------------------------

/**
 * Returns the storage path that should be used as the OG image for a storefront.
 *
 * Priority:
 *   1. cover_image_url (wide, fills 1200×630 well)
 *   2. avatar_url (square — Transform API crops to 1200×630, may lose sides)
 *   3. null → platform default image used client-side
 */
export function storefrontOgImagePath(
  cover_image_url: string | null,
  avatar_url:      string | null,
): string | null {
  return cover_image_url ?? avatar_url ?? null
}

/**
 * Returns the storage path for the cover image of a listing (product / service /
 * land listing). sort_order=0 is always the cover.
 *
 * @param firstImageUrl  image_url from the first row of the images table
 *                       (sorted by sort_order ASC, LIMIT 1)
 */
export function listingOgImagePath(firstImageUrl: string | null): string | null {
  return firstImageUrl ?? null
}

// ---------------------------------------------------------------------------
// TanStack Start head meta builder
// ---------------------------------------------------------------------------

export interface HeadMetaTag {
  name?:     string
  property?: string
  content:   string
}

/**
 * Converts an OgMeta object into a TanStack Start head meta array.
 *
 * Usage in a route loader:
 *   return { meta: ogToHeadMeta(og) }
 *
 * Usage in route component:
 *   export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
 *     head: ({ loaderData }) => ({ meta: loaderData.meta }),
 *   })
 */
export function ogToHeadMeta(og: OgMeta): HeadMetaTag[] {
  const tags: HeadMetaTag[] = [
    // ── Core OG ──────────────────────────────────────────────────────────────
    { property: 'og:title',       content: og.title },
    { property: 'og:description', content: og.description },
    { property: 'og:url',         content: og.url },
    { property: 'og:type',        content: og.type },
    { property: 'og:locale',      content: og.locale },
    { property: 'og:site_name',   content: og.siteName },
  ]

  // ── OG image ─────────────────────────────────────────────────────────────
  if (og.image) {
    tags.push(
      { property: 'og:image',        content: og.image.url },
      { property: 'og:image:width',  content: String(og.image.width) },
      { property: 'og:image:height', content: String(og.image.height) },
      { property: 'og:image:type',   content: og.image.type },
    )
    if (og.image.alt) {
      tags.push({ property: 'og:image:alt', content: og.image.alt })
    }
  }

  // ── Twitter / TikTok ─────────────────────────────────────────────────────
  // TikTok reads twitter:* tags when rendering link previews in bio and
  // video descriptions. Keep in sync with og:* values above.
  tags.push(
    { name: 'twitter:card',        content: og.twitterCard },
    { name: 'twitter:title',       content: og.title },
    { name: 'twitter:description', content: og.description },
  )
  if (og.image) {
    tags.push({ name: 'twitter:image', content: og.image.url })
    if (og.image.alt) {
      tags.push({ name: 'twitter:image:alt', content: og.image.alt })
    }
  }

  return tags
}

// ---------------------------------------------------------------------------
// Per-entity OG type rules (documentation as code)
// ---------------------------------------------------------------------------

/**
 * OG type matrix — reference when building entity seo.ts files.
 *
 * Entity type        og:type               twitter:card           Notes
 * ─────────────────  ────────────────────  ─────────────────────  ───────────────────────────────
 * Storefront         business.business     summary_large_image    Facebook renders rich biz card
 * Product            website               summary_large_image    No og:type for single products
 * Service            website               summary_large_image    Same as product
 * Land listing       website               summary_large_image    RealEstateListing has no og:type
 * Province page      website               summary                Discovery page, no single image
 * District page      website               summary                Discovery page, no single image
 * Homepage           website               summary_large_image    Platform default OG image
 */
export const OG_TYPE_REFERENCE = {
  storefront:    { ogType: 'business.business' as OgType, twitterCard: 'summary_large_image' as TwitterCard },
  product:       { ogType: 'website'           as OgType, twitterCard: 'summary_large_image' as TwitterCard },
  service:       { ogType: 'website'           as OgType, twitterCard: 'summary_large_image' as TwitterCard },
  landListing:   { ogType: 'website'           as OgType, twitterCard: 'summary_large_image' as TwitterCard },
  discoveryPage: { ogType: 'website'           as OgType, twitterCard: 'summary'             as TwitterCard },
} as const
