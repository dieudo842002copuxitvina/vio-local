import type { Storefront } from '../types'

// ---------------------------------------------------------------------------
// Geo context — resolved names from DB, passed alongside the storefront row.
// Never embed raw IDs in metadata; always resolve to human-readable strings.
// ---------------------------------------------------------------------------
export interface GeoContext {
  province: { name: string; name_full: string; slug: string } | null
  district: { name: string; name_full: string; slug: string } | null
  ward:     { name: string; name_full: string; slug: string } | null
}

export interface StorefrontSeoInput {
  storefront: Storefront
  geo:        GeoContext
}

// Output shape — maps 1:1 to <head> tags.
// Feed this into TanStack Start's useHead() or a route loader's head config.
export interface StorefrontPageMeta {
  title:       string
  description: string
  canonical:   string
  robots:      string
  openGraph:   OpenGraphMeta
  twitter:     TwitterMeta
  structuredData: LocalBusinessSchema
}

interface OpenGraphMeta {
  title:       string
  description: string
  url:         string
  image:       string
  imageAlt:    string
  type:        string       // 'website' | 'business.business'
  locale:      string       // 'vi_VN'
  siteName:    string
}

interface TwitterMeta {
  card:        string       // 'summary_large_image'
  title:       string
  description: string
  image:       string
}

// Schema.org LocalBusiness — only the fields VIO LOCAL can reliably populate.
// Do not add fields we can't fill (opens/closes hours, etc.) — empty schema
// fields hurt more than they help.
export interface LocalBusinessSchema {
  '@context': 'https://schema.org'
  '@type':    'LocalBusiness'
  '@id':      string
  name:       string
  url:        string
  description?: string
  image?:     string[]
  telephone?: string
  address:    PostalAddressSchema
  sameAs?:    string[]
}

interface PostalAddressSchema {
  '@type':         'PostalAddress'
  addressLocality?: string
  addressRegion?:   string
  addressCountry:   'VN'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_URL  = 'https://violocal.vn'
const SITE_NAME = 'VIO LOCAL'
const FALLBACK_OG_IMAGE = `${SITE_URL}/images/og-default.jpg`

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function buildStorefrontMeta(input: StorefrontSeoInput): StorefrontPageMeta {
  const { storefront, geo } = input
  const canonical = `${SITE_URL}/ho-kinh-doanh/${storefront.slug}`
  const ogImage   = storefront.cover_image_url ?? storefront.avatar_url ?? FALLBACK_OG_IMAGE

  const title       = buildTitle(storefront, geo)
  const description = buildDescription(storefront, geo)
  const robots      = storefront.is_public ? 'index, follow' : 'noindex, nofollow'

  return {
    title,
    description,
    canonical,
    robots,
    openGraph: {
      title,
      description,
      url:      canonical,
      image:    ogImage,
      imageAlt: `${storefront.business_name} — ảnh bìa`,
      type:     'business.business',
      locale:   'vi_VN',
      siteName: SITE_NAME,
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      image:       ogImage,
    },
    structuredData: buildLocalBusinessSchema(input, canonical),
  }
}

// ---------------------------------------------------------------------------
// Title
// Max 60 chars. Formula varies by available geo context.
// ---------------------------------------------------------------------------

function buildTitle(storefront: Storefront, geo: GeoContext): string {
  const { business_name } = storefront
  const district  = geo.district?.name  ?? null
  const province  = geo.province?.name  ?? null

  let location: string
  if (district && province) {
    location = `${district}, ${province}`
  } else if (province) {
    location = province
  } else {
    // No geo — rare for a published storefront, but handled gracefully
    return truncate(`${business_name} | ${SITE_NAME}`, 60)
  }

  return truncate(`${business_name} tại ${location} | ${SITE_NAME}`, 60)
}

// ---------------------------------------------------------------------------
// Description
// 150–155 chars. Always includes a geo signal and a contact nudge.
// ---------------------------------------------------------------------------

function buildDescription(storefront: Storefront, geo: GeoContext): string {
  const location = buildLocationString(geo)
  const contact  = buildContactNudge(storefront)

  if (storefront.description) {
    // Use the owner's description, trimmed to leave room for location + contact
    const maxDescLen = 155 - location.length - contact.length - 2 // 2 for '. '
    const trimmed    = truncate(storefront.description.trim(), Math.max(maxDescLen, 40))
    return `${trimmed}. ${location}${contact}`
  }

  // Fallback: generic but geo-specific — not "generic ecommerce" copy
  return truncate(
    `${storefront.business_name} — hộ kinh doanh tại ${location}. ${contact}`,
    155,
  )
}

function buildLocationString(geo: GeoContext): string {
  if (geo.district && geo.province) return `${geo.district.name_full}, ${geo.province.name_full}`
  if (geo.province) return geo.province.name_full
  return 'Việt Nam'
}

function buildContactNudge(storefront: Storefront): string {
  if (storefront.zalo_url) return 'Liên hệ qua Zalo.'
  if (storefront.phone)    return `Gọi ${formatPhone(storefront.phone)}.`
  if (storefront.facebook_url) return 'Nhắn tin Facebook.'
  return 'Xem thông tin liên hệ.'
}

// ---------------------------------------------------------------------------
// JSON-LD structured data
// ---------------------------------------------------------------------------

function buildLocalBusinessSchema(
  input: StorefrontSeoInput,
  canonical: string,
): LocalBusinessSchema {
  const { storefront, geo } = input

  const schema: LocalBusinessSchema = {
    '@context': 'https://schema.org',
    '@type':    'LocalBusiness',
    '@id':      `${canonical}#business`,
    name:       storefront.business_name,
    url:        canonical,
    address: {
      '@type':        'PostalAddress',
      addressCountry: 'VN',
    },
  }

  if (storefront.description) schema.description = storefront.description
  if (storefront.phone)       schema['telephone'] = `+84${stripLeadingZero(storefront.phone)}`

  // Image array — cover first (wider, better for rich results), then avatar
  const images: string[] = []
  if (storefront.cover_image_url) images.push(storefront.cover_image_url)
  if (storefront.avatar_url)      images.push(storefront.avatar_url)
  if (images.length > 0)          schema.image = images

  // sameAs — only standard web profile URLs (not Zalo phone links)
  const sameAs: string[] = []
  if (storefront.facebook_url) sameAs.push(storefront.facebook_url)
  if (storefront.tiktok_url)   sameAs.push(storefront.tiktok_url)
  if (sameAs.length > 0)       schema.sameAs = sameAs

  // Address — use name_full for schema (full administrative name, not slug)
  if (geo.district) schema.address.addressLocality = geo.district.name_full
  if (geo.province) schema.address.addressRegion   = geo.province.name_full

  return schema
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // "0912345678" → "0912 345 678" (Vietnamese mobile format)
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return phone
}

function stripLeadingZero(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? digits.slice(1) : digits
}
