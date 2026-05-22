import type { Storefront } from '../../storefronts/types'

export interface Service {
  id: string
  storefront_id: string
  category_id: number | null
  slug: string
  title: string
  description: string | null
  phone: string | null
  service_area_text: string | null
  province_id: number | null
  district_id: number | null
  ward_id: number | null
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface ServiceImage {
  id: number
  service_id: string
  image_url: string
  sort_order: number
  created_at: string
}

export interface ServiceWithStorefront extends Service {
  storefront: Pick<Storefront, 'id' | 'business_name' | 'slug' | 'avatar_url' | 'is_verified'>
  images: ServiceImage[]
}

export interface CreateServiceInput {
  storefront_id: string
  category_id?: number
  slug: string
  title: string
  description?: string
  phone?: string
  service_area_text?: string
  province_id?: number
  district_id?: number
  ward_id?: number
}

export interface UpdateServiceInput {
  category_id?: number | null
  title?: string
  description?: string | null
  phone?: string | null
  service_area_text?: string | null
  province_id?: number | null
  district_id?: number | null
  ward_id?: number | null
  is_available?: boolean
}
