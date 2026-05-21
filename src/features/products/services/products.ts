import { createBrowserSupabaseClient } from '#/services/supabase/client'
import type { Product, ProductImage, CreateProductInput, UpdateProductInput } from '../types'

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single()
  return data ?? null
}

export async function getProductImages(productId: string): Promise<ProductImage[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  return data ?? []
}

export async function getProductsByStorefront(storefrontId: string): Promise<Product[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('storefront_id', storefrontId)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getProductsByDistrict(
  districtId: number,
  categoryId?: number,
  limit = 20,
  offset = 0,
): Promise<Product[]> {
  const supabase = createBrowserSupabaseClient()
  let query = supabase
    .from('products')
    .select('*')
    .eq('district_id', districtId)
    .eq('is_available', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (categoryId !== undefined) query = query.eq('category_id', categoryId)
  const { data } = await query
  return data ?? []
}

export async function getProductsByProvince(
  provinceId: number,
  categoryId?: number,
  limit = 20,
  offset = 0,
): Promise<Product[]> {
  const supabase = createBrowserSupabaseClient()
  let query = supabase
    .from('products')
    .select('*')
    .eq('province_id', provinceId)
    .eq('is_available', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (categoryId !== undefined) query = query.eq('category_id', categoryId)
  const { data } = await query
  return data ?? []
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function productSlugExists(slug: string): Promise<boolean> {
  const supabase = createBrowserSupabaseClient()
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
  return (count ?? 0) > 0
}
