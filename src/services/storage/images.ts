// ---------------------------------------------------------------------------
// Image upload pipeline for VIO LOCAL.
// Validates → compresses → uploads to deterministic storage paths.
//
// Requires: npm install browser-image-compression
//
// Usage:
//   const path = await uploadStorefrontAvatar(storefrontId, file)
//   storefront.avatar_url = path  ← store path, not full URL
// ---------------------------------------------------------------------------

import imageCompression from 'browser-image-compression'
import { createBrowserSupabaseClient } from '../supabase/client'

// ---------------------------------------------------------------------------
// Path builder — deterministic, no random names
// ---------------------------------------------------------------------------

export function buildStoragePath(
  entity: 'storefront-avatar' | 'storefront-cover',
  entityId: string,
): string
export function buildStoragePath(
  entity: 'product' | 'service',
  entityId: string,
  sortOrder: number,
): string
export function buildStoragePath(
  entity: 'storefront-avatar' | 'storefront-cover' | 'product' | 'service',
  entityId: string,
  sortOrder?: number,
): string {
  switch (entity) {
    case 'storefront-avatar': return `storefronts/${entityId}/avatar.webp`
    case 'storefront-cover':  return `storefronts/${entityId}/cover.webp`
    case 'product':           return `products/${entityId}/${sortOrder ?? 0}.webp`
    case 'service':           return `services/${entityId}/${sortOrder ?? 0}.webp`
  }
}

// ---------------------------------------------------------------------------
// URL builders — construct from path at render time, never store full URL
// ---------------------------------------------------------------------------

export function getPublicUrl(path: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string
  return `${base}/storage/v1/object/public/media/${path}`
}

export function getTransformUrl(
  path: string,
  width: number,
  quality = 80,
): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string
  return `${base}/storage/v1/render/image/public/media/${path}?width=${width}&quality=${quality}&format=webp`
}

// Build a srcset string for a product/service image at standard breakpoints
export function buildSrcSet(path: string): string {
  return [280, 560, 800]
    .map(w => `${getTransformUrl(path, w)} ${w}w`)
    .join(', ')
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const RAW_MAX_BYTES    = 20 * 1024 * 1024  // 20MB — pre-compression
const OUTPUT_MAX_BYTES = 1.5 * 1024 * 1024 // 1.5MB — post-compression hard cap

export type ValidationError =
  | 'INVALID_TYPE'
  | 'TOO_LARGE'
  | 'TOO_SMALL'
  | 'COMPRESS_FAILED'
  | 'UPLOAD_FAILED'

export class ImageError extends Error {
  constructor(public code: ValidationError) {
    super(code)
  }
}

export function validateImageFile(file: File): void {
  if (!ACCEPTED_TYPES.has(file.type)) throw new ImageError('INVALID_TYPE')
  if (file.size > RAW_MAX_BYTES)       throw new ImageError('TOO_LARGE')
}

// ---------------------------------------------------------------------------
// Compression settings by slot
// ---------------------------------------------------------------------------

const COMPRESSION_OPTIONS: Record<
  'storefront-avatar' | 'storefront-cover' | 'product' | 'service',
  Parameters<typeof imageCompression>[1]
> = {
  'storefront-avatar': {
    maxWidthOrHeight: 400,
    maxSizeMB: 0.15,
    useWebWorker: true,
    initialQuality: 0.85,
  },
  'storefront-cover': {
    maxWidthOrHeight: 1400,
    maxSizeMB: 0.4,
    useWebWorker: true,
    initialQuality: 0.85,
  },
  'product': {
    maxWidthOrHeight: 1200,
    maxSizeMB: 0.6,
    useWebWorker: true,
    initialQuality: 0.8,
  },
  'service': {
    maxWidthOrHeight: 1200,
    maxSizeMB: 0.5,
    useWebWorker: true,
    initialQuality: 0.8,
  },
}

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

export async function compressImage(
  file: File,
  slot: keyof typeof COMPRESSION_OPTIONS,
): Promise<File> {
  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS[slot])
    if (compressed.size > OUTPUT_MAX_BYTES) throw new ImageError('COMPRESS_FAILED')
    return compressed
  } catch (err) {
    if (err instanceof ImageError) throw err
    throw new ImageError('COMPRESS_FAILED')
  }
}

// ---------------------------------------------------------------------------
// Upload — validate → compress → upsert to deterministic path
// ---------------------------------------------------------------------------

interface UploadStorefrontImageArgs {
  storefrontId: string
  file: File
  slot: 'storefront-avatar' | 'storefront-cover'
}

interface UploadListingImageArgs {
  entity: 'product' | 'service'
  entityId: string
  file: File
  sortOrder: number
}

async function uploadToStorage(
  path: string,
  file: File,
  slot: keyof typeof COMPRESSION_OPTIONS,
): Promise<string> {
  validateImageFile(file)
  const compressed = await compressImage(file, slot)

  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.storage
    .from('media')
    .upload(path, compressed, {
      contentType: compressed.type,
      upsert: true,  // replace existing — keeps path deterministic
    })

  if (error) throw new ImageError('UPLOAD_FAILED')
  return path
}

// Returns the storage path (not full URL) — store this in the DB column
export async function uploadStorefrontImage(args: UploadStorefrontImageArgs): Promise<string> {
  const { storefrontId, file, slot } = args
  const path = buildStoragePath(slot, storefrontId)
  return uploadToStorage(path, file, slot)
}

export async function uploadListingImage(args: UploadListingImageArgs): Promise<string> {
  const { entity, entityId, file, sortOrder } = args
  const path = buildStoragePath(entity, entityId, sortOrder)
  return uploadToStorage(path, file, entity)
}

// ---------------------------------------------------------------------------
// Delete — call before deleting the DB row
// ---------------------------------------------------------------------------

export async function deleteEntityImages(
  entity: 'storefronts' | 'products' | 'services',
  entityId: string,
): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  const prefix = `${entity}/${entityId}/`

  const { data: files } = await supabase.storage
    .from('media')
    .list(prefix)

  if (!files?.length) return

  const paths = files.map(f => `${prefix}${f.name}`)
  await supabase.storage.from('media').remove(paths)
}
