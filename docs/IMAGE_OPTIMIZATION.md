# Image Optimization Architecture — VIO LOCAL

Implementation companion to [`IMAGE_SYSTEM.md`](IMAGE_SYSTEM.md).

`IMAGE_SYSTEM.md` covers: storage paths, bucket config, compression targets, srcset basics, RLS policies.  
This document covers: named preset system, complete `images.ts` API, `<VioImage>` component,
upload pipeline with progress + abort, lazy loading priority tiers, placeholder strategy,
land listing images, error handling.

Implementation files:
- `src/services/storage/images.ts` — URL builders, presets, upload helpers
- `src/services/storage/compress.ts` — client-side compression pipeline
- `src/services/storage/validate.ts` — upload validation
- `src/components/ui/VioImage.tsx` — single image rendering component
- `src/hooks/useImageUpload.ts` — upload state machine

Related:
- [`IMAGE_SYSTEM.md`](IMAGE_SYSTEM.md) — storage paths, bucket RLS, compression targets
- [`PERFORMANCE_RULES.md`](PERFORMANCE_RULES.md) — CLS rules, LCP rules, budget
- [`OPENGRAPH_ARCHITECTURE.md`](OPENGRAPH_ARCHITECTURE.md) — OG image transform (`buildOgImageUrl`)

---

## Target

```
Device:    Entry-level Android, 2 GB RAM
Network:   3G — 1.5 Mbps down, 750 Kbps up
Goal:      Discovery page images < 200 KB total weight
           Detail page images < 400 KB total weight
           Upload: user sees progress within 500 ms of file selection
```

---

## 1. Compression Strategy

### 1.1 Principle

Two-stage pipeline:

```
User's camera file (3–15 MB JPEG/HEIC)
  │
  ├─ Stage 1: Client-side compression (browser)
  │    ↓ resize + re-encode to WebP / JPEG
  │    Target: ≤ 600 KB source image
  │
  └─ Stage 2: Supabase Transform API (delivery)
       ↓ on-the-fly resize per named preset
       Target: 15–100 KB per image on screen
```

Never upload the original camera file. Never serve the source image directly.
Every pixel displayed in the UI passes through Stage 2.

### 1.2 Compression targets per entity type

| Entity | Max input size | Max width | Max height | Quality | Target output |
|---|---|---|---|---|---|
| Storefront avatar | 20 MB raw | 400 px | 400 px | 88% | ≤ 120 KB |
| Storefront cover | 20 MB raw | 1920 px | — | 82% | ≤ 550 KB |
| Product image | 20 MB raw | 1600 px | — | 82% | ≤ 480 KB |
| Service image | 20 MB raw | 1600 px | — | 82% | ≤ 480 KB |
| Land listing image | 20 MB raw | 1600 px | — | 80% | ≤ 480 KB |

`—` means unconstrained: the image is resized by width; height scales proportionally.
Square images (avatar) constrain both dimensions to prevent elongated avatars.

### 1.3 `src/services/storage/compress.ts`

```typescript
// src/services/storage/compress.ts
//
// Client-side compression using browser-image-compression.
// install: npm install browser-image-compression
//
// Called before every upload. Never called on the server.

import imageCompression from 'browser-image-compression'

export type CompressionSlot =
  | 'avatar'      // storefront avatar — square crop target
  | 'cover'       // storefront cover — wide landscape
  | 'product'     // product / service image — flexible aspect
  | 'land'        // land listing image — outdoor/field photos

interface CompressionOptions {
  maxWidthOrHeight: number
  maxSizeMB:        number
  initialQuality:   number
  useWebWorker:     boolean
  fileType:         'image/webp'
}

const SLOT_OPTIONS: Record<CompressionSlot, CompressionOptions> = {
  avatar: {
    maxWidthOrHeight: 400,
    maxSizeMB:        0.12,
    initialQuality:   0.88,
    useWebWorker:     true,
    fileType:         'image/webp',
  },
  cover: {
    maxWidthOrHeight: 1920,
    maxSizeMB:        0.55,
    initialQuality:   0.82,
    useWebWorker:     true,
    fileType:         'image/webp',
  },
  product: {
    maxWidthOrHeight: 1600,
    maxSizeMB:        0.48,
    initialQuality:   0.82,
    useWebWorker:     true,
    fileType:         'image/webp',
  },
  land: {
    maxWidthOrHeight: 1600,
    maxSizeMB:        0.48,
    initialQuality:   0.80,
    useWebWorker:     true,
    fileType:         'image/webp',
  },
}

export interface CompressResult {
  file:           File
  originalSizeKB: number
  compressedSizeKB: number
  reductionPct:   number
}

/**
 * Compresses a user-supplied image file for upload.
 *
 * Returns a new File ready for upload to Supabase Storage.
 * Throws if compression fails — caller must catch and show a user error.
 *
 * Usage:
 *   const result = await compressForUpload(file, 'product')
 *   await uploadImage(result.file, path)
 */
export async function compressForUpload(
  input: File,
  slot:  CompressionSlot,
): Promise<CompressResult> {
  const originalSizeKB = Math.round(input.size / 1024)

  // HEIC/HEIF from iPhone: browser-image-compression handles these natively
  // on Safari iOS. On Chrome Android they will be JPEG from camera.
  const compressed = await imageCompression(input, SLOT_OPTIONS[slot])

  const compressedSizeKB = Math.round(compressed.size / 1024)
  const reductionPct     = Math.round((1 - compressed.size / input.size) * 100)

  return {
    file:           compressed,
    originalSizeKB,
    compressedSizeKB,
    reductionPct,
  }
}

/**
 * Hard cap check AFTER compression.
 * If the compressed file still exceeds this limit, reject with COMPRESS_FAILED.
 * This handles edge cases: already-compressed WebP input, corrupt metadata.
 */
export const COMPRESSED_SIZE_HARD_CAP_BYTES = 1.5 * 1024 * 1024   // 1.5 MB

export function isWithinHardCap(file: File): boolean {
  return file.size <= COMPRESSED_SIZE_HARD_CAP_BYTES
}
```

---

## 2. Thumbnail Strategy

### 2.1 Named presets — single source of truth

Named presets replace ad-hoc width arguments scattered across components.
Every call to the Transform API goes through a preset.

```typescript
// src/services/storage/images.ts

interface TransformParams {
  width:   number
  height?: number           // omit for proportional scaling
  resize:  'cover' | 'contain'
  quality: number           // 1-100
}

/**
 * Named image presets.
 *
 * 'cover'  mode: crops to exact w×h (centre crop). Use for fixed-aspect containers.
 * 'contain' mode: fits within w×h, preserves aspect ratio. Use only for OG fallback.
 *
 * All presets output WebP via the Transform API (format=webp is appended in
 * buildPresetUrl — it is NOT in this table so preset definitions stay clean).
 */
export const IMAGE_PRESETS = {
  // ── Avatars ─────────────────────────────────────────────────────────────────
  // Used in: nav chip, list row, storefront card badge
  'avatar-xs':  { width: 48,   height: 48,   resize: 'cover',   quality: 80 },
  // Used in: storefront card avatar, inquiry list, search result
  'avatar-sm':  { width: 80,   height: 80,   resize: 'cover',   quality: 82 },
  // Used in: storefront page header
  'avatar-md':  { width: 128,  height: 128,  resize: 'cover',   quality: 84 },
  // Used in: owner profile section, large storefront card
  'avatar-lg':  { width: 256,  height: 256,  resize: 'cover',   quality: 85 },

  // ── Cards ────────────────────────────────────────────────────────────────────
  // Used in: compact product lists, recently-viewed rail
  'card-sm':    { width: 180,  height: 120,  resize: 'cover',   quality: 78 },
  // Used in: standard discovery cards (products, services, storefronts)
  'card':       { width: 360,  height: 240,  resize: 'cover',   quality: 80 },
  // Used in: featured cards, top-of-page highlight
  'card-lg':    { width: 560,  height: 375,  resize: 'cover',   quality: 82 },

  // ── Heroes ───────────────────────────────────────────────────────────────────
  // Used in: storefront page hero on mobile (750px viewport)
  'hero-sm':    { width: 750,  height: 500,  resize: 'cover',   quality: 82 },
  // Used in: storefront page hero on desktop, product detail main image
  'hero':       { width: 1200, height: 800,  resize: 'cover',   quality: 85 },

  // ── Land listing ─────────────────────────────────────────────────────────────
  // Used in: land listing detail gallery — landscape fields, wider than 3:2
  'land-card':  { width: 360,  height: 220,  resize: 'cover',   quality: 80 },
  'land-hero':  { width: 1200, height: 675,  resize: 'cover',   quality: 83 },

  // ── Square thumbnail ─────────────────────────────────────────────────────────
  // Used in: image gallery strip at bottom of detail pages
  'thumb-sq':   { width: 80,   height: 80,   resize: 'cover',   quality: 75 },

  // ── OG ───────────────────────────────────────────────────────────────────────
  // See src/services/seo/og.ts — buildOgImageUrl() uses a separate transform path.
  // Do not duplicate that here. Reference only.
  'og':         { width: 1200, height: 630,  resize: 'cover',   quality: 80 },
} as const

export type ImagePreset = keyof typeof IMAGE_PRESETS
```

### 2.2 URL builders

```typescript
// src/services/storage/images.ts (continued)

function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url) throw new Error('VITE_SUPABASE_URL is not set')
  return url
}

/**
 * Builds a Supabase Storage Transform URL for a given named preset.
 *
 * @param storagePath  Relative path inside the `media` bucket.
 *                     e.g. "storefronts/uuid/avatar.webp"
 * @param preset       Named preset from IMAGE_PRESETS.
 * @returns            Absolute Transform URL, or null if path is null/empty.
 */
export function buildPresetUrl(
  storagePath: string | null | undefined,
  preset:      ImagePreset,
): string | null {
  if (!storagePath) return null

  const params = IMAGE_PRESETS[preset]
  const base   = `${getSupabaseUrl()}/storage/v1/render/image/public/media/${storagePath}`
  const qs = new URLSearchParams({
    width:   String(params.width),
    ...(params.height ? { height: String(params.height) } : {}),
    resize:  params.resize,
    quality: String(params.quality),
    format:  'webp',
  })

  return `${base}?${qs.toString()}`
}

/**
 * Builds a srcset string for responsive images.
 * Returns widths in ascending order for browser negotiation.
 *
 * @param storagePath  Storage path.
 * @param widthPresets Array of preset names in ascending width order.
 */
export function buildSrcSet(
  storagePath: string | null | undefined,
  widthPresets: ImagePreset[],
): string {
  if (!storagePath) return ''

  return widthPresets
    .map(preset => {
      const url   = buildPresetUrl(storagePath, preset)
      const width = IMAGE_PRESETS[preset].width
      return url ? `${url} ${width}w` : null
    })
    .filter(Boolean)
    .join(', ')
}
```

---

## 3. Responsive Image Strategy

### 3.1 Srcset combinations per component context

| Component context | Presets used | `sizes` value |
|---|---|---|
| Storefront cover (hero) | `hero-sm`, `hero` | `(max-width: 750px) 750px, 1200px` |
| Storefront card | `card`, `card-lg` | `(max-width: 640px) 360px, 560px` |
| Product card | `card-sm`, `card` | `(max-width: 640px) 180px, 360px` |
| Land listing card | `land-card` | `(max-width: 640px) 360px, 360px` |
| Land listing hero | `land-card`, `land-hero` | `(max-width: 750px) 360px, 1200px` |
| Avatar (nav chip) | `avatar-xs` | `48px` |
| Avatar (storefront card) | `avatar-sm` | `80px` |
| Avatar (profile header) | `avatar-md`, `avatar-lg` | `(max-width: 640px) 128px, 256px` |
| Gallery thumbnail strip | `thumb-sq` | `80px` |
| Product detail main | `card`, `hero-sm`, `hero` | `(max-width: 640px) 100vw, (max-width: 1024px) 750px, 1200px` |

**Rule:** Avatars at fixed pixel sizes use a single preset — no srcset needed.
`sizes="48px"` with `width={48}` is sufficient; the browser will never download a larger variant.

### 3.2 `<picture>` element structure

Use `<picture>` with `<source type="image/webp">` and `<img>` fallback.
Even though the Transform API outputs WebP, the `<source>` type attribute is
belt-and-suspenders for crawlers and older WebView environments:

```tsx
function ResponsiveProductImage({ path, alt }: { path: string; alt: string }) {
  const srcSet = buildSrcSet(path, ['card-sm', 'card'])
  const src    = buildPresetUrl(path, 'card')

  return (
    <picture>
      <source
        type="image/webp"
        srcSet={srcSet}
        sizes="(max-width: 640px) 180px, 360px"
      />
      <img
        src={src ?? ''}
        alt={alt}
        width={360}
        height={240}
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}
```

### 3.3 CLS prevention — always set `width` + `height`

The `width` and `height` attributes on `<img>` are not display dimensions —
they are aspect ratio hints. The browser uses them to reserve space before
the image loads, preventing Cumulative Layout Shift (CLS).

```tsx
// ✅ Browser reserves 360×240 immediately — zero CLS
<img width={360} height={240} src={...} />

// ❌ Browser doesn't know the size — layout shifts when image loads
<img src={...} />
```

Set `width` and `height` to the **intrinsic size of the largest preset used**,
not the CSS display size. CSS controls display; attributes control aspect ratio reservation.

---

## 4. Upload Validation

Two gates in sequence:

```
File selected by user
  │
  ├─ Gate 1: validateBeforeCompress()   ← client-side, immediate feedback
  │    checks: type, raw size, min dimensions
  │    errors shown BEFORE upload starts — saves bandwidth on rejection
  │
  └─ Gate 2: validateAfterCompress()    ← after compression
       checks: compressed size ≤ hard cap
       errors rare but possible (already-compressed input, corrupt file)
```

```typescript
// src/services/storage/validate.ts

export type ImageValidationError =
  | 'INVALID_TYPE'      // unsupported MIME type
  | 'TOO_LARGE_RAW'     // raw file exceeds 20 MB
  | 'TOO_SMALL'         // image dimensions below 200×200
  | 'TOO_SMALL_COVER'   // cover image below 1200×630
  | 'COMPRESS_FAILED'   // post-compression size still exceeds hard cap
  | 'MAX_IMAGES'        // entity already has max images

export const VALIDATION_MESSAGES: Record<ImageValidationError, string> = {
  INVALID_TYPE:     'Chỉ chấp nhận ảnh JPG, PNG, WebP, hoặc HEIC.',
  TOO_LARGE_RAW:    'Ảnh quá lớn (tối đa 20MB). Hãy chọn ảnh khác.',
  TOO_SMALL:        'Ảnh quá nhỏ (tối thiểu 200×200 px).',
  TOO_SMALL_COVER:  'Ảnh bìa cần tối thiểu 1200×630 px để hiển thị đẹp.',
  COMPRESS_FAILED:  'Không thể xử lý ảnh này. Vui lòng chọn ảnh khác.',
  MAX_IMAGES:       'Đã đạt số lượng ảnh tối đa cho mục này.',
}

const ACCEPTED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
])
const MAX_RAW_BYTES   = 20 * 1024 * 1024    // 20 MB
const MIN_DIMENSION   = 200                  // px

/** Maximum images per entity type — enforced client-side before upload. */
export const MAX_IMAGES: Record<'storefront_cover' | 'storefront_avatar' | 'product' | 'service' | 'land_listing', number> = {
  storefront_cover:  1,
  storefront_avatar: 1,
  product:           5,
  service:           5,
  land_listing:      10,
}

export interface ValidationResult {
  ok:    boolean
  error: ImageValidationError | null
}

/**
 * Gate 1 — validate before compression.
 * Fast synchronous checks plus an async dimensions check.
 */
export async function validateBeforeCompress(
  file: File,
  slot: 'avatar' | 'cover' | 'product' | 'service' | 'land',
): Promise<ValidationResult> {
  // Type check
  if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) {
    return { ok: false, error: 'INVALID_TYPE' }
  }

  // Raw size check
  if (file.size > MAX_RAW_BYTES) {
    return { ok: false, error: 'TOO_LARGE_RAW' }
  }

  // Dimension check — requires loading the image
  const dimensions = await getImageDimensions(file)

  if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
    return { ok: false, error: 'TOO_SMALL' }
  }

  // Cover images require a minimum aspect ratio for quality OG images
  if (slot === 'cover' && (dimensions.width < 1200 || dimensions.height < 630)) {
    return { ok: false, error: 'TOO_SMALL_COVER' }
  }

  return { ok: true, error: null }
}

/**
 * Gate 2 — validate after compression.
 * Only checks compressed file size.
 */
export function validateAfterCompress(file: File): ValidationResult {
  if (!isWithinHardCap(file)) {
    return { ok: false, error: 'COMPRESS_FAILED' }
  }
  return { ok: true, error: null }
}

/** Reads image dimensions without adding a DOM element. */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve({ width: img.width, height: img.height }) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to read image dimensions')) }
    img.src = url
  })
}
```

---

## 5. Lazy Loading Strategy

### 5.1 Priority tiers

Every image rendered in the app falls into exactly one tier.
Tier assignment determines `loading`, `fetchPriority`, and whether to use
Intersection Observer for progressive enhancement.

| Tier | Loading | fetchPriority | Use case |
|---|---|---|---|
| **1 — LCP** | `eager` | `high` | First visible image on the page |
| **2 — Above fold** | `eager` | `auto` | Images in first viewport row of lists |
| **3 — Below fold** | `lazy` | `auto` | Discovery cards below row 1, detail page gallery |
| **4 — Deferred** | `lazy` | `low` | Gallery lightbox full-res, expanded sections |

**Exactly one Tier 1 image per page.** If multiple images are marked `fetchPriority="high"`,
the browser treats them equally and the LCP signal is diluted.

### 5.2 Tier assignment per component

| Component | Tier | Rationale |
|---|---|---|
| Storefront cover (detail page) | **1** | LCP element on storefront page |
| Product hero (detail page) | **1** | LCP element on product page |
| Land listing first image (detail) | **1** | LCP element on land listing page |
| Province page: first storefront card | **2** | In viewport on load, not LCP |
| Province page: cards 2+ | **3** | Below fold on mobile |
| Storefront card avatar | **3** | Small, below hero, rarely LCP |
| Gallery thumbnails | **3** | Below fold |
| Full-res gallery image (lightbox) | **4** | Not visible until user opens gallery |

### 5.3 `<VioImage>` component

Single component for all image rendering. Encapsulates preset resolution, srcset
construction, lazy loading tier, CLS prevention, and broken-image fallback.

```tsx
// src/components/ui/VioImage.tsx

import { buildPresetUrl, buildSrcSet, type ImagePreset } from '../../services/storage/images'

interface VioImageProps {
  /**
   * Storage path relative to the `media` bucket.
   * e.g. "storefronts/uuid/avatar.webp"
   * Pass null to render the entity-type placeholder.
   */
  path:            string | null

  /** Named preset — controls dimensions and quality. */
  preset:          ImagePreset

  /**
   * Additional presets to include in srcset (ascending width order).
   * Include when the image can render at multiple viewport widths.
   * Omit for fixed-size images (avatars, thumbnails).
   */
  srcSetPresets?:  ImagePreset[]

  /** CSS `sizes` attribute. Required when srcSetPresets is provided. */
  sizes?:          string

  /** Descriptive alt text. Empty string only for decorative images. */
  alt:             string

  /**
   * Tier 1 LCP image flag.
   * Sets loading="eager" fetchPriority="high".
   * Use on at most ONE image per page.
   */
  priority?:       boolean

  /** Additional class names for the <img> element. */
  className?:      string

  /**
   * Placeholder to render when path is null or image fails to load.
   * Defaults to a grey box with the entity icon.
   */
  placeholder?:    'storefront' | 'product' | 'land' | 'user' | 'generic'
}

const PLACEHOLDER_SVG: Record<NonNullable<VioImageProps['placeholder']>, string> = {
  storefront: '/placeholders/storefront.svg',
  product:    '/placeholders/product.svg',
  land:       '/placeholders/land.svg',
  user:       '/placeholders/user.svg',
  generic:    '/placeholders/generic.svg',
}

export function VioImage({
  path,
  preset,
  srcSetPresets,
  sizes,
  alt,
  priority = false,
  className,
  placeholder = 'generic',
}: VioImageProps) {
  const { width, height } = IMAGE_PRESETS[preset]
  const src = buildPresetUrl(path, preset) ?? PLACEHOLDER_SVG[placeholder]

  return (
    <picture>
      {path && srcSetPresets && srcSetPresets.length > 0 && (
        <source
          type="image/webp"
          srcSet={buildSrcSet(path, [preset, ...srcSetPresets])}
          sizes={sizes}
        />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height ?? width}         // height falls back to width for squares
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={className}
        onError={e => {
          // Swap to placeholder on load failure — prevents broken-image icon
          const img = e.currentTarget
          if (img.src !== PLACEHOLDER_SVG[placeholder]) {
            img.src = PLACEHOLDER_SVG[placeholder]
          }
        }}
      />
    </picture>
  )
}
```

### 5.4 Placeholder strategy

Placeholders are inline SVGs served from `public/placeholders/`. They must:
- Be under 1 KB each (inline SVG, no external fetch)
- Have the correct aspect ratio for their entity type (prevents CLS)
- Use a neutral grey fill, not a branded colour (avoids Flash Of Styled Content)
- Never be base64-encoded inline in the component (defeats caching)

```
public/
  placeholders/
    storefront.svg    ← 360×240 grey box with shop icon
    product.svg       ← 360×240 grey box with tag icon
    land.svg          ← 360×220 grey box with terrain icon (wider crop for fields)
    user.svg          ← 80×80 grey circle with person icon
    generic.svg       ← 1×1 transparent pixel (fallback for unknown context)
```

**Skeleton loading pattern** — use CSS skeleton instead of placeholder SVG for
discovery card lists, where multiple images load simultaneously:

```tsx
// StorefrontCard.tsx
function StorefrontCardImage({ path, name }: { path: string | null; name: string }) {
  return (
    <div className="relative overflow-hidden rounded-t-xl bg-gray-100">
      {/* Skeleton sits behind the image — visible only while image loads */}
      <div className="absolute inset-0 animate-pulse bg-gray-200" aria-hidden />
      <VioImage
        path={path}
        preset="card"
        srcSetPresets={['card-lg']}
        sizes="(max-width: 640px) 360px, 560px"
        alt={`Ảnh bìa ${name}`}
        placeholder="storefront"
        className="relative z-10 w-full"  // z-10 sits above skeleton
      />
    </div>
  )
}
```

The skeleton is pure CSS — no JS state needed. The image element's natural load
lifecycle handles the visual: skeleton visible → image renders on top.

---

## 6. Image Delivery Strategy

### 6.1 Upload pipeline — `useImageUpload` hook

```typescript
// src/hooks/useImageUpload.ts

import { useState, useRef } from 'react'
import { validateBeforeCompress, validateAfterCompress, type ImageValidationError } from '../services/storage/validate'
import { compressForUpload, type CompressionSlot } from '../services/storage/compress'

type UploadState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'compressing'; progress: number }   // 0-100 compression progress
  | { status: 'uploading';   progress: number }   // 0-100 upload progress
  | { status: 'done';        path: string }
  | { status: 'error';       code: ImageValidationError | 'UPLOAD_FAILED' }

interface UseImageUploadOptions {
  slot:        CompressionSlot
  storagePath: string        // deterministic path to upload to
  onSuccess:   (path: string) => void
}

export function useImageUpload({ slot, storagePath, onSuccess }: UseImageUploadOptions) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  async function upload(file: File, supabase: SupabaseClient) {
    // Cancel any in-flight upload
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // Gate 1: validate before compression
    setState({ status: 'validating' })
    const preResult = await validateBeforeCompress(file, slot)
    if (!preResult.ok) {
      setState({ status: 'error', code: preResult.error! })
      return
    }

    // Compression (with simulated progress — browser-image-compression
    // doesn't emit progress events; show indeterminate 0-80% range)
    setState({ status: 'compressing', progress: 0 })
    let compressed: File
    try {
      const result = await compressForUpload(file, slot)
      compressed   = result.file
    } catch {
      setState({ status: 'error', code: 'COMPRESS_FAILED' })
      return
    }
    setState({ status: 'compressing', progress: 100 })

    // Gate 2: validate after compression
    const postResult = validateAfterCompress(compressed)
    if (!postResult.ok) {
      setState({ status: 'error', code: postResult.error! })
      return
    }

    // Upload
    setState({ status: 'uploading', progress: 0 })
    const { error } = await supabase.storage
      .from('media')
      .upload(storagePath, compressed, {
        upsert:      true,
        contentType: compressed.type,
      })

    if (error) {
      if (abortRef.current?.signal.aborted) return   // silently discard aborted upload
      setState({ status: 'error', code: 'UPLOAD_FAILED' })
      return
    }

    setState({ status: 'done', path: storagePath })
    onSuccess(storagePath)
  }

  function cancel() {
    abortRef.current?.abort()
    setState({ status: 'idle' })
  }

  function reset() {
    abortRef.current?.abort()
    setState({ status: 'idle' })
  }

  return { state, upload, cancel, reset }
}
```

### 6.2 Cache-Control headers

| Image type | Cache-Control | Rationale |
|---|---|---|
| Source image (original upload) | `public, max-age=31536000, immutable` | Deterministic paths — re-upload creates a new file at the same path via upsert; CDN cache should treat path as immutable within a version |
| Transform API result | `public, max-age=86400` | Supabase CDN caches transforms; same URL = same output |
| Placeholder SVGs (`/placeholders/*.svg`) | `public, max-age=31536000, immutable` | Static assets, versioned by filename |

Supabase automatically sets Cache-Control on Storage objects. The transform results
are cached by the Supabase CDN. No additional configuration needed for the defaults
above — verify in the Supabase Storage dashboard if custom TTLs are required.

### 6.3 Delivery URL anatomy

Every pixel shown in the UI is a Transform URL. Never use the raw `/object/public/`
URL in a component — it serves full-resolution source files:

```
❌ Raw URL (serves full source — up to 600 KB):
https://project.supabase.co/storage/v1/object/public/media/products/uuid/0.webp

✅ Transform URL (serves 50–80 KB resized WebP):
https://project.supabase.co/storage/v1/render/image/public/media/products/uuid/0.webp
  ?width=360&height=240&resize=cover&quality=80&format=webp
```

Use `buildPresetUrl(path, 'card')` — never construct Transform URLs by hand in components.

### 6.4 Land listing image delivery

Land listing images are added in `supabase/migrations/20260522100001_land_listings.sql`
(`land_listing_images` table) but not yet in `IMAGE_SYSTEM.md`. The storage path
convention follows the same pattern:

```
media/
  land-listings/
    {listing_id}/
      0.webp    ← cover image (sort_order = 0) — used as OG image
      1.webp
      2.webp
      ...       (up to 10 images per listing)
```

Path builder:
```typescript
export function landListingImagePath(listingId: string, sortOrder: number): string {
  return `land-listings/${listingId}/${sortOrder}.webp`
}
```

Preset usage per context:

| Context | Preset |
|---|---|
| Land listing discovery card | `land-card` (360×220) |
| Land listing detail hero | `land-hero` (1200×675) with priority=true |
| Land listing gallery thumb | `thumb-sq` (80×80) |
| Land listing OG image | `og` (1200×630) via `buildOgImageUrl()` in `og.ts` |

`land-hero` uses a 16:9 crop (1200×675) rather than the standard 3:2 `hero` preset.
Aerial and field photos are inherently wide; 3:2 crops often cut the sky or horizon.

### 6.5 Entity deletion — storage cleanup order

Supabase does NOT cascade-delete storage objects when a DB row is deleted.
Always delete storage before the DB row:

```typescript
// src/features/land-listings/services/land-listings.ts

export async function deleteLandListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<void> {
  // 1. List all image files for this listing
  const { data: files } = await supabase.storage
    .from('media')
    .list(`land-listings/${listingId}`)

  // 2. Delete storage files
  if (files && files.length > 0) {
    const paths = files.map(f => `land-listings/${listingId}/${f.name}`)
    await supabase.storage.from('media').remove(paths)
  }

  // 3. Delete DB row (cascades to land_listing_images)
  await supabase.from('land_listings').delete().eq('id', listingId)
}
```

The same order applies for storefronts, products, and services (already documented
in `IMAGE_SYSTEM.md` §7).

---

## Appendix A: `images.ts` complete export surface

```typescript
// src/services/storage/images.ts — public API

// Presets
export { IMAGE_PRESETS, type ImagePreset }

// URL builders
export { buildPresetUrl }      // single preset → URL | null
export { buildSrcSet }         // array of presets → srcset string

// Path builders
export { storefrontAvatarPath }   // (id) → 'storefronts/{id}/avatar.webp'
export { storefrontCoverPath }    // (id) → 'storefronts/{id}/cover.webp'
export { productImagePath }       // (id, sortOrder) → 'products/{id}/{n}.webp'
export { serviceImagePath }       // (id, sortOrder) → 'services/{id}/{n}.webp'
export { landListingImagePath }   // (id, sortOrder) → 'land-listings/{id}/{n}.webp'

// Slot type (used by compress.ts and validate.ts)
export type { CompressionSlot }
```

All path builders and URL builders are pure functions. They have no side effects
and can be called on both the server and client.

---

## Appendix B: Quick-reference anti-patterns

| Anti-pattern | Consequence | Fix |
|---|---|---|
| `select('*')` returning `cover_image_url` as full Transform URL | DB stores full URL; URL breaks on project domain change | Store path only; build URL at render time via `buildPresetUrl` |
| `<img src={buildPresetUrl(path, 'hero')} />` without `width`/`height` | CLS — layout shifts on image load | Always set `width={1200} height={800}` matching the preset |
| Same image as `priority={true}` in a list component | Every item is LCP — no browser prioritisation | `priority` only on the first item; pass as prop from the page, not hardcoded in the card component |
| `loading="lazy"` on the hero/cover image | Delays LCP — hero takes longer to appear | Cover and hero images always `priority={true}` |
| Raw `/object/public/` URL in a component | Serves full source file (up to 600 KB) on mobile | Always use `buildPresetUrl` → Transform URL |
| `new Image()` in `useEffect` to preload | Double-fetches the image | Use `<link rel="preload" as="image">` in the route's `head` config for LCP images |
| HEIC from iPhone uploaded without compression | iOS HEIC files can be 10+ MB; fails slow uploads | `browser-image-compression` handles HEIC; validate type client-side, reject unsupported browsers early |
| Deleting DB row before storage objects | Ghost storage objects accumulate; no automatic cleanup | Always storage-first, DB second |
| Hard-coded `quality=90` everywhere | Uniformly high quality adds 20-30% file size vs quality=80 | Use per-preset quality from `IMAGE_PRESETS` — hero images get 85, cards get 78-80 |
