// ---------------------------------------------------------------------------
// Thin-page decision engine for VIO LOCAL discovery pages.
//
// Three states (see docs/THIN_PAGE_RULES.md):
//   'not-found' → 404, no page rendered
//   'noindex'   → 200, renders for users, <meta name="robots" content="noindex, follow">
//   'indexed'   → 200, full SEO treatment, included in sitemap
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Thresholds — single source of truth for the entire platform
// ---------------------------------------------------------------------------

export const THRESHOLDS = {
  // Geographic discovery pages (storefront count)
  province:              10,
  district:               3,

  // Category+geo discovery pages (listing count — products or services)
  categoryProvince:       3,
  categoryDistrict:       2,

  // Province nav: minimum storefronts for a district to appear in province nav.
  // Must equal or exceed `district` threshold — never link to noindex pages.
  provinceNavDistrict:    3,

  // Land listing discovery pages (/dat-nong-nghiep/:province, /:province/:district)
  // Lower than storefront thresholds — land listings are rarer than storefronts.
  landProvince:           5,
  landDistrict:           2,

  // Province land nav: minimum land listings for a district link to appear.
  // Must equal landDistrict — never link from indexed to noindex pages.
  landProvinceNavDistrict: 2,

  // Content pages — crop × province (/nong-san/:crop/:province)
  // Minimum storefronts selling this crop in this province for the page to index.
  // Higher than categoryProvince (3) — content pages claim editorial authority.
  cropProvince:   5,

  // Minimum provinces meeting cropProvince for the national crop page (/nong-san/:crop).
  cropNational:   2,

  // Minimum storefronts active during a harvest season for /mua-vu/:season pages.
  // Lower than cropProvince — seasonal pages are time-bounded, lower density is acceptable.
  seasonProvince: 3,

  // Province page crop nav: minimum storefronts for a crop link to appear in province nav.
  // Must equal cropProvince — never link indexed province page to noindex content page.
  provinceCropNav: 5,
} as const

export type PageType = keyof typeof THRESHOLDS

// ---------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------

export type PageState = 'not-found' | 'noindex' | 'indexed'

/**
 * Returns the SEO state for a discovery page given its listing count.
 *
 * Usage in route loaders:
 *   const state = getPageState('district', total)
 *   if (state === 'not-found') throw notFound()
 *   return { items, total, robots: getRobotsMeta(state) }
 */
export function getPageState(type: PageType, count: number): PageState {
  if (count === 0)                       return 'not-found'
  if (count < THRESHOLDS[type])          return 'noindex'
  return 'indexed'
}

// ---------------------------------------------------------------------------
// robots meta string
// ---------------------------------------------------------------------------

export type RobotsDirective =
  | 'index, follow'
  | 'noindex, follow'
  | 'noindex, nofollow'

/**
 * Maps a PageState to the correct robots meta content string.
 * Call this after getPageState() — do not call for 'not-found' (throw notFound() instead).
 */
export function getRobotsMeta(state: Exclude<PageState, 'not-found'>): RobotsDirective {
  return state === 'indexed' ? 'index, follow' : 'noindex, follow'
}

/**
 * Pagination: page 2+ is always noindex regardless of total count.
 * Page 1 inherits the page state robots directive.
 */
export function getPaginatedRobots(
  pageIndex: number,
  pageOneState: Exclude<PageState, 'not-found'>,
): RobotsDirective {
  if (pageIndex === 0) return getRobotsMeta(pageOneState)
  return 'noindex, follow'
}

// ---------------------------------------------------------------------------
// Canonical URL helpers
// ---------------------------------------------------------------------------

/**
 * Returns the canonical URL for a discovery page.
 *
 * Rules:
 *   - INDEXED and NOINDEX pages: canonical = their own URL (never manipulate to parent)
 *   - Paginated pages: canonical = page 1 URL
 */
export function getCanonical(
  pageUrl: string,
  pageIndex: number,
  page1Url: string,
): string {
  return pageIndex === 0 ? pageUrl : page1Url
}

// ---------------------------------------------------------------------------
// Nav link guard
// ---------------------------------------------------------------------------

/**
 * Whether a district should appear in the province page nav.
 * Only links from indexed pages should lead to indexed pages.
 */
export function shouldShowInProvinceNav(districtStorefrontCount: number): boolean {
  return districtStorefrontCount >= THRESHOLDS.provinceNavDistrict
}

// ---------------------------------------------------------------------------
// Sitemap inclusion guard
// ---------------------------------------------------------------------------

/**
 * Whether a discovery page should be included in the sitemap.
 * Thin and empty pages are excluded.
 */
export function shouldIncludeInSitemap(
  type: PageType,
  count: number,
  pageIndex = 0,
): boolean {
  if (pageIndex > 0) return false  // paginated pages never in sitemap
  return getPageState(type, count) === 'indexed'
}

// ---------------------------------------------------------------------------
// Thin-page static content builder
// ---------------------------------------------------------------------------

export interface ThinPageGeoContext {
  districtNameFull: string
  provinceNameFull: string
  provinceName:     string
  provinceSlug:     string
  total:            number
}

/**
 * Returns the static paragraph shown on thin pages (noindex state).
 * This text makes the page genuinely informative even with 1-2 listings,
 * avoiding a completely empty page without adding keyword-stuffed boilerplate.
 */
export function buildThinPageContext(geo: ThinPageGeoContext): string {
  return (
    `${geo.districtNameFull} thuộc ${geo.provinceNameFull}. ` +
    `Hiện có ${geo.total} hộ kinh doanh được đăng ký trên VIO LOCAL tại khu vực này. ` +
    `Khám phá thêm hộ kinh doanh tại ` +
    `<a href="/${geo.provinceSlug}">${geo.provinceName}</a>.`
  )
}

// ---------------------------------------------------------------------------
// Convenience: full page decision for route loaders
// ---------------------------------------------------------------------------

export interface PageDecision {
  state:    PageState
  robots:   RobotsDirective | null  // null for 'not-found'
  canonical: string | null           // null for 'not-found'
  inSitemap: boolean
}

/**
 * One call returns all SEO signals for a discovery page loader.
 *
 * Example:
 *   const decision = resolvePageDecision('district', total, pageIndex, canonicalUrl)
 *   if (decision.state === 'not-found') throw notFound()
 *   return { items, ...decision }
 */
export function resolvePageDecision(
  type:         PageType,
  count:        number,
  pageIndex:    number,
  canonicalUrl: string,
  page1Url:     string = canonicalUrl,
): PageDecision {
  const state = getPageState(type, count)

  if (state === 'not-found') {
    return { state, robots: null, canonical: null, inSitemap: false }
  }

  return {
    state,
    robots:    getPaginatedRobots(pageIndex, state),
    canonical: getCanonical(canonicalUrl, pageIndex, page1Url),
    inSitemap: shouldIncludeInSitemap(type, count, pageIndex),
  }
}
