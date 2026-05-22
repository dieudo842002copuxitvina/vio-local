// Mirrors public.storefronts row
export interface Storefront {
  id: string
  owner_id: string
  slug: string
  business_name: string
  description: string | null
  phone: string | null
  zalo_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  province_id: number | null
  district_id: number | null
  ward_id: number | null
  avatar_url: string | null
  cover_image_url: string | null
  is_verified: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface CreateStorefrontInput {
  slug: string
  business_name: string
  description?: string
  phone?: string
  zalo_url?: string
  facebook_url?: string
  tiktok_url?: string
  province_id?: number
  district_id?: number
  ward_id?: number
  avatar_url?: string
  cover_image_url?: string
}

// Owner-safe update — never includes is_verified (admin-only field)
export interface UpdateStorefrontInput {
  slug?: string
  business_name?: string
  description?: string
  phone?: string
  zalo_url?: string
  facebook_url?: string
  tiktok_url?: string
  province_id?: number | null
  district_id?: number | null
  ward_id?: number | null
  avatar_url?: string | null
  cover_image_url?: string | null
  is_public?: boolean
}
