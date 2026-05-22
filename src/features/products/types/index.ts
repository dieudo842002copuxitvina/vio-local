import type { Storefront } from '../../storefronts/types'

export interface Product {
  id: string
  storefront_id: string
  category_id: number | null
  slug: string
  title: string
  description: string | null
  price_text: string | null
  quantity_text: string | null
  harvest_season: string | null
  province_id: number | null
  district_id: number | null
  ward_id: number | null
  is_available: boolean
  is_featured: boolean
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: number
  product_id: string
  image_url: string
  sort_order: number
  created_at: string
}

// Product row joined with its first image — used in listing cards
export interface ProductWithCover extends Product {
  cover_image_url: string | null
}

// Product page — full data with storefront context for SEO
export interface ProductWithStorefront extends Product {
  storefront: Pick<Storefront, 'id' | 'business_name' | 'slug' | 'avatar_url' | 'is_verified'>
  images: ProductImage[]
}

export interface CreateProductInput {
  storefront_id: string
  category_id?: number
  slug: string
  title: string
  description?: string
  price_text?: string
  quantity_text?: string
  harvest_season?: string
  province_id?: number
  district_id?: number
  ward_id?: number
}

export interface UpdateProductInput {
  category_id?: number | null
  title?: string
  description?: string | null
  price_text?: string | null
  quantity_text?: string | null
  harvest_season?: string | null
  province_id?: number | null
  district_id?: number | null
  ward_id?: number | null
  is_available?: boolean
  is_featured?: boolean
}
