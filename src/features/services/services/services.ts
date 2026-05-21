import { createBrowserSupabaseClient } from '#/services/supabase/client'
import type { Service, ServiceImage, CreateServiceInput, UpdateServiceInput } from '../types'

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('slug', slug)
    .single()
  return data ?? null
}

export async function getServiceImages(serviceId: string): Promise<ServiceImage[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('service_images')
    .select('*')
    .eq('service_id', serviceId)
    .order('sort_order', { ascending: true })
  return data ?? []
}

export async function getServicesByStorefront(storefrontId: string): Promise<Service[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('storefront_id', storefrontId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getServicesByProvince(
  provinceId: number,
  categoryId?: number,
  limit = 20,
  offset = 0,
): Promise<Service[]> {
  const supabase = createBrowserSupabaseClient()
  let query = supabase
    .from('services')
    .select('*')
    .eq('province_id', provinceId)
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (categoryId !== undefined) query = query.eq('category_id', categoryId)
  const { data } = await query
  return data ?? []
}

export async function createService(input: CreateServiceInput): Promise<Service> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('services')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<Service> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('services')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function serviceSlugExists(slug: string): Promise<boolean> {
  const supabase = createBrowserSupabaseClient()
  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
  return (count ?? 0) > 0
}
