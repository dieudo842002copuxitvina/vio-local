import { createBrowserSupabaseClient } from '#/services/supabase/client'
import type { Storefront, CreateStorefrontInput, UpdateStorefrontInput } from '../types'

export async function getStorefrontBySlug(slug: string): Promise<Storefront | null> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('storefronts')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()
  return data ?? null
}

// Includes drafts — use inside owner dashboard only
export async function getOwnStorefronts(ownerId: string): Promise<Storefront[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('storefronts')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getStorefrontsByProvince(
  provinceId: number,
  limit = 20,
  offset = 0,
): Promise<Storefront[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('storefronts')
    .select('*')
    .eq('province_id', provinceId)
    .eq('is_public', true)
    .order('is_verified', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  return data ?? []
}

export async function getStorefrontsByDistrict(
  districtId: number,
  limit = 20,
  offset = 0,
): Promise<Storefront[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('storefronts')
    .select('*')
    .eq('district_id', districtId)
    .eq('is_public', true)
    .order('is_verified', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  return data ?? []
}

export async function createStorefront(
  ownerId: string,
  input: CreateStorefrontInput,
): Promise<Storefront> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('storefronts')
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStorefront(
  id: string,
  input: UpdateStorefrontInput,
): Promise<Storefront> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('storefronts')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function publishStorefront(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase
    .from('storefronts')
    .update({ is_public: true })
    .eq('id', id)
  if (error) throw error
}

export async function slugExists(slug: string): Promise<boolean> {
  const supabase = createBrowserSupabaseClient()
  const { count } = await supabase
    .from('storefronts')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
  return (count ?? 0) > 0
}
