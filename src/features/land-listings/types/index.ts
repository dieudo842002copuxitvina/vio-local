// ---------------------------------------------------------------------------
// Land listings type definitions — VIO LOCAL agricultural land bounded context.
//
// Deliberately separate from products/services/storefronts.
// Do NOT merge these types with listing types from other features.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Vietnamese agricultural land categories per Luật Đất đai.
 * Stored as VARCHAR in DB with a CHECK constraint.
 *
 * lua          — lúa (wetland rice fields)
 * rau_mau      — rau màu, cây ngắn ngày (vegetables, short-cycle crops)
 * cay_lau_nam  — cây lâu năm (coffee, pepper, rubber, cocoa — multi-year)
 * an_trai      — cây ăn trái (durian, avocado, rambutan, mango)
 * lam_nghiep   — lâm nghiệp (forestry, timber plantations)
 * mat_nuoc     — mặt nước nuôi trồng thủy sản (aquaculture ponds)
 * hon_hop      — hỗn hợp (mixed-use agricultural parcel)
 */
export type LandType =
  | 'lua'
  | 'rau_mau'
  | 'cay_lau_nam'
  | 'an_trai'
  | 'lam_nghiep'
  | 'mat_nuoc'
  | 'hon_hop'

/**
 * Four-state moderation gate.
 * A listing is publicly visible ONLY when is_public=true AND status='approved'.
 *
 * pending   — newly submitted, awaiting moderator review
 * approved  — passed review, visible when is_public=true
 * rejected  — spam / fraud / insufficient info — permanently hidden
 * hidden    — post-approval takedown (legal complaint, owner dispute)
 */
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'hidden'

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface LandListing {
  id:                string
  owner_id:          string
  slug:              string
  title:             string
  description:       string | null
  province_id:       number | null
  district_id:       number | null
  ward_id:           number | null
  land_area_text:    string | null   // "2 hectares", "5.000 m²" — free text
  land_type:         LandType | null
  crop_type:         string | null   // "cà phê, sầu riêng" — free text, CSV-like
  price_text:        string | null   // "850 triệu", "Thương lượng" — contact-first
  phone:             string | null
  coordinates_text:  string | null   // "11.5234, 107.8912" — no PostGIS
  legal_status_text: string | null   // "Sổ đỏ đầy đủ", "Đang cấp sổ"
  is_featured:       boolean         // admin/moderator only — monetization signal
  is_public:         boolean         // owner controls: draft vs published
  moderation_status: ModerationStatus
  created_at:        string
  updated_at:        string
}

export interface LandListingImage {
  id:               number
  land_listing_id:  string
  image_url:        string
  sort_order:       number           // 0 = cover image
  created_at:       string
}

// ---------------------------------------------------------------------------
// Composite types used in UI
// ---------------------------------------------------------------------------

/** Listing with its cover image resolved. Used on discovery cards. */
export interface LandListingWithCover extends LandListing {
  cover_image_url: string | null
}

/** Full listing data for the detail page. */
export interface LandListingDetail extends LandListing {
  images: LandListingImage[]
}

// ---------------------------------------------------------------------------
// Mutation inputs
// ---------------------------------------------------------------------------

/**
 * Owner-controlled fields only.
 * is_featured, moderation_status are intentionally excluded:
 *   is_featured        — admin/moderator only (monetization)
 *   moderation_status  — admin/moderator only (anti-spam gate)
 */
export interface CreateLandListingInput {
  slug:               string
  title:              string
  description?:       string
  province_id?:       number
  district_id?:       number
  ward_id?:           number
  land_area_text?:    string
  land_type?:         LandType
  crop_type?:         string
  price_text?:        string
  phone?:             string
  coordinates_text?:  string
  legal_status_text?: string
}

export interface UpdateLandListingInput {
  slug?:              string
  title?:             string
  description?:       string
  province_id?:       number | null
  district_id?:       number | null
  ward_id?:           number | null
  land_area_text?:    string
  land_type?:         LandType | null
  crop_type?:         string
  price_text?:        string
  phone?:             string
  coordinates_text?:  string
  legal_status_text?: string
  /** Owner can publish (true) or unpublish (false) their own listing. */
  is_public?:         boolean
}

// ---------------------------------------------------------------------------
// Discovery page shape (mirrors DiscoveryPage<T> from queries.ts)
// ---------------------------------------------------------------------------

export interface LandDiscoveryPage {
  items:   LandListing[]
  total:   number
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Display helpers — Vietnamese labels for land types
// ---------------------------------------------------------------------------

export const LAND_TYPE_LABELS: Record<LandType, string> = {
  lua:          'Đất lúa',
  rau_mau:      'Đất rau màu',
  cay_lau_nam:  'Đất cây lâu năm',
  an_trai:      'Đất cây ăn trái',
  lam_nghiep:   'Đất lâm nghiệp',
  mat_nuoc:     'Đất mặt nước',
  hon_hop:      'Đất hỗn hợp',
}

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  pending:   'Chờ duyệt',
  approved:  'Đã duyệt',
  rejected:  'Bị từ chối',
  hidden:    'Đã ẩn',
}
