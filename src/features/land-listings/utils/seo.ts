// ---------------------------------------------------------------------------
// SEO metadata builder for land listing pages.
//
// Covers three page types:
//   1. Listing detail   — /dat-nong-nghiep/:slug
//   2. Province hub     — /dat-nong-nghiep/:province
//   3. District hub     — /dat-nong-nghiep/:province/:district
//
// See docs/LAND_SEO.md for full rationale and anti-patterns.
// ---------------------------------------------------------------------------

import type { LandListing, LandType } from '../types'
import { LAND_TYPE_LABELS } from '../types'

// ---------------------------------------------------------------------------
// Geo context (from route loader, same shape as storefronts/utils/seo.ts)
// ---------------------------------------------------------------------------

export interface LandGeoContext {
  province: { name: string; name_full: string; slug: string } | null
  district: { name: string; name_full: string; slug: string } | null
  ward:     { name: string; name_full: string; slug: string } | null
}

// ---------------------------------------------------------------------------
// Land listing detail page meta
// ---------------------------------------------------------------------------

export interface LandListingPageMeta {
  title:       string
  description: string
  canonical:   string
  robots:      string
  og: {
    title:       string
    description: string
    url:         string
    image:       string | null
    type:        'website'
    locale:      'vi_VN'
    siteName:    'VIO LOCAL'
  }
  jsonLd:      Record<string, unknown>
}

export interface LandListingSeoInput {
  listing:    LandListing
  coverImage: string | null
  geo:        LandGeoContext
  siteUrl:    string
}

/**
 * Builds all SEO signals for a single land listing detail page.
 * Called from the /dat-nong-nghiep/:slug route loader.
 */
export function buildLandListingMeta(input: LandListingSeoInput): LandListingPageMeta {
  const { listing, coverImage, geo, siteUrl } = input

  const base    = siteUrl.replace(/\/$/, '')
  const pageUrl = `${base}/dat-nong-nghiep/${listing.slug}`

  // ── Title ──────────────────────────────────────────────────────────────────
  // Formula: {title} tại {district|province} | VIO LOCAL
  // Examples:
  //   "Đất vườn 2ha Xuân Lộc tại Xuân Lộc, Đồng Nai | VIO LOCAL"
  //   "Đất cà phê 5ha tại Đắk Lắk | VIO LOCAL"

  const geoSuffix = geo.district
    ? `${geo.district.name}, ${geo.province?.name ?? ''}`
    : (geo.province?.name ?? '')

  const title = geoSuffix
    ? `${listing.title} tại ${geoSuffix} | VIO LOCAL`
    : `${listing.title} | VIO LOCAL`

  // ── Description ────────────────────────────────────────────────────────────
  // Lead with the most scannable signals (area, land type, legal, price).
  // Close with contact nudge.

  const parts: string[] = []

  if (listing.land_area_text) {
    parts.push(`Diện tích: ${listing.land_area_text}`)
  }
  if (listing.land_type) {
    parts.push(LAND_TYPE_LABELS[listing.land_type as LandType])
  }
  if (listing.crop_type) {
    parts.push(`Cây trồng: ${listing.crop_type}`)
  }
  if (listing.legal_status_text) {
    parts.push(listing.legal_status_text)
  }
  if (listing.price_text) {
    parts.push(`Giá: ${listing.price_text}`)
  }

  const details    = parts.length > 0 ? parts.join(' · ') + '. ' : ''
  const geoText    = geoSuffix ? `Vị trí: ${geoSuffix}. ` : ''
  const contactNudge = listing.phone ? 'Liên hệ trực tiếp qua số điện thoại.' : 'Liên hệ để biết thêm chi tiết.'
  const description = `${details}${geoText}${contactNudge}`.slice(0, 160)

  // ── robots ─────────────────────────────────────────────────────────────────
  // Unapproved/unpublished listings: full noindex + nofollow (owner-only access)
  const robots = (listing.is_public && listing.moderation_status === 'approved')
    ? 'index, follow'
    : 'noindex, nofollow'

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  // schema.org/RealEstateListing — added 2021, well-supported by Google by 2026.
  // Do NOT include price as a numeric field — use description for price_text.
  // Do NOT include geo coordinates in schema until PostGIS is added.

  const additionalProperties: Record<string, string>[] = []
  if (listing.land_area_text) {
    additionalProperties.push({ '@type': 'PropertyValue', name: 'Diện tích', value: listing.land_area_text })
  }
  if (listing.land_type) {
    additionalProperties.push({ '@type': 'PropertyValue', name: 'Loại đất', value: LAND_TYPE_LABELS[listing.land_type as LandType] })
  }
  if (listing.crop_type) {
    additionalProperties.push({ '@type': 'PropertyValue', name: 'Cây trồng', value: listing.crop_type })
  }
  if (listing.legal_status_text) {
    additionalProperties.push({ '@type': 'PropertyValue', name: 'Pháp lý', value: listing.legal_status_text })
  }
  if (listing.price_text) {
    additionalProperties.push({ '@type': 'PropertyValue', name: 'Giá', value: listing.price_text })
  }

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type':    'RealEstateListing',
    name:        listing.title,
    description: listing.description ?? description,
    url:         pageUrl,
    ...(coverImage && { image: coverImage }),
    ...(listing.phone && { telephone: formatPhone(listing.phone) }),
    address: {
      '@type':          'PostalAddress',
      addressCountry:   'VN',
      ...(geo.province && { addressRegion:   geo.province.name_full }),
      ...(geo.district && { addressLocality: geo.district.name_full }),
      ...(geo.ward     && { streetAddress:   geo.ward.name_full }),
    },
    ...(additionalProperties.length > 0 && { additionalProperty: additionalProperties }),
  }

  return {
    title,
    description,
    canonical: pageUrl,
    robots,
    og: {
      title,
      description,
      url:      pageUrl,
      image:    coverImage,
      type:     'website',
      locale:   'vi_VN',
      siteName: 'VIO LOCAL',
    },
    jsonLd,
  }
}

// ---------------------------------------------------------------------------
// Discovery page meta
// ---------------------------------------------------------------------------

export interface LandDiscoveryPageMeta {
  title:       string
  description: string
  canonical:   string
  robots:      string
  jsonLd:      Record<string, unknown>
}

export interface LandProvinceDiscoverySeoInput {
  province:     { name: string; name_full: string; slug: string }
  total:        number
  pageState:    'indexed' | 'noindex'
  pageIndex:    number
  siteUrl:      string
}

/**
 * Meta for /dat-nong-nghiep/:province (province-level discovery page).
 */
export function buildLandProvinceDiscoveryMeta(
  input: LandProvinceDiscoverySeoInput,
): LandDiscoveryPageMeta {
  const { province, total, pageState, pageIndex, siteUrl } = input
  const base      = siteUrl.replace(/\/$/, '')
  const page1Url  = `${base}/dat-nong-nghiep/${province.slug}`
  const canonical = pageIndex === 0 ? page1Url : page1Url  // pagination canonical always → page 1
  const robots    = (pageState === 'indexed' && pageIndex === 0) ? 'index, follow' : 'noindex, follow'

  const title = pageIndex === 0
    ? `Đất nông nghiệp ${province.name_full} — ${total} tin đăng | VIO LOCAL`
    : `Đất nông nghiệp ${province.name_full} trang ${pageIndex + 1} | VIO LOCAL`

  const description =
    `Tổng hợp ${total} tin đăng đất nông nghiệp tại ${province.name_full}. ` +
    `Đất lúa, cây lâu năm, cây ăn trái, vườn rau — đăng trực tiếp bởi chủ đất. ` +
    `Liên hệ nhanh không qua trung gian.`

  return {
    title,
    description: description.slice(0, 160),
    canonical,
    robots,
    jsonLd: buildBreadcrumbJsonLd([
      { name: 'Trang chủ',         url: base },
      { name: 'Đất nông nghiệp',   url: `${base}/dat-nong-nghiep` },
      { name: province.name_full,  url: page1Url },
    ]),
  }
}

export interface LandDistrictDiscoverySeoInput {
  province:     { name: string; name_full: string; slug: string }
  district:     { name: string; name_full: string; slug: string }
  total:        number
  pageState:    'indexed' | 'noindex'
  pageIndex:    number
  siteUrl:      string
}

/**
 * Meta for /dat-nong-nghiep/:province/:district.
 */
export function buildLandDistrictDiscoveryMeta(
  input: LandDistrictDiscoverySeoInput,
): LandDiscoveryPageMeta {
  const { province, district, total, pageState, pageIndex, siteUrl } = input
  const base      = siteUrl.replace(/\/$/, '')
  const page1Url  = `${base}/dat-nong-nghiep/${province.slug}/${district.slug}`
  const canonical = pageIndex === 0 ? page1Url : page1Url
  const robots    = (pageState === 'indexed' && pageIndex === 0) ? 'index, follow' : 'noindex, follow'

  const title = pageIndex === 0
    ? `Đất nông nghiệp ${district.name_full} — ${total} tin đăng | VIO LOCAL`
    : `Đất nông nghiệp ${district.name_full} trang ${pageIndex + 1} | VIO LOCAL`

  const description =
    `${total} tin đăng đất nông nghiệp tại ${district.name_full}, ${province.name_full}. ` +
    `Xem thông tin diện tích, loại đất, pháp lý và liên hệ trực tiếp chủ đất.`

  return {
    title,
    description: description.slice(0, 160),
    canonical,
    robots,
    jsonLd: buildBreadcrumbJsonLd([
      { name: 'Trang chủ',         url: base },
      { name: 'Đất nông nghiệp',   url: `${base}/dat-nong-nghiep` },
      { name: province.name_full,  url: `${base}/dat-nong-nghiep/${province.slug}` },
      { name: district.name_full,  url: page1Url },
    ]),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalises a Vietnamese phone number to +84 format for schema.org telephone. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('84')) return `+${digits}`
  if (digits.startsWith('0'))  return `+84${digits.slice(1)}`
  return `+84${digits}`
}

function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    '@context':        'https://schema.org',
    '@type':           'BreadcrumbList',
    itemListElement:   items.map((item, index) => ({
      '@type':   'ListItem',
      position:  index + 1,
      name:      item.name,
      item:      item.url,
    })),
  }
}
