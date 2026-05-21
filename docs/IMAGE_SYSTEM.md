# Image System

Supabase Storage image architecture for VIO LOCAL.  
Implementation: [`src/services/storage/images.ts`](../src/services/storage/images.ts)

---

## 1. Bucket Structure

One public bucket: **`media`**

```
Supabase project
└── Storage
    └── media/          ← single bucket, public read
        ├── storefronts/
        ├── products/
        └── services/
```

**Why one bucket, not three:**  
Supabase bills per bucket for egress, not per object. One bucket simplifies RLS policies, CDN cache configuration, and backup scripts. Folder structure handles the logical separation.

**Bucket settings:**
```
name:          media
public:        true   (read-only for anon; write gated by RLS)
file size:     20MB   (pre-compression cap; real uploads will be ≤800KB after compression)
allowed MIME:  image/jpeg, image/png, image/webp, image/heic, image/heif
```

---

## 2. Storage Path Conventions

**Rule: paths are deterministic, not random.**  
No UUIDs in filenames, no timestamps, no content hashes.  
Each image slot has exactly one canonical path. Re-upload replaces the file in-place.

```
storefronts/{storefront_id}/avatar.webp
storefronts/{storefront_id}/cover.webp

products/{product_id}/0.webp
products/{product_id}/1.webp
products/{product_id}/2.webp
...

services/{service_id}/0.webp
services/{service_id}/1.webp
```

**Why fixed paths:**

| Problem with random names | Fixed-path solution |
|---|---|
| Re-upload creates second file; old file accumulates | Upsert to same path → one file per slot |
| `product_images.image_url` column stores full URL → changes on re-upload | URL never changes — CDN cache stays warm |
| Stale files after entity deletion | Delete `products/{product_id}/` folder → complete cleanup |
| Duplicate uploads from retries | Idempotent: same content → same path |

**Naming rules:**

| Entity | Slot | Path |
|---|---|---|
| Storefront avatar (profile photo) | `avatar` | `storefronts/{id}/avatar.webp` |
| Storefront cover (hero banner) | `cover` | `storefronts/{id}/cover.webp` |
| Product image, first | `0` | `products/{id}/0.webp` |
| Product image, second | `1` | `products/{id}/1.webp` |
| Service image, first | `0` | `services/{id}/0.webp` |

**Sort order = filename integer.** The `product_images.sort_order` column and the filename stay in sync. Reordering images = updating `sort_order` + renaming files.

---

## 3. Upload Validation

Validated client-side before the upload starts. Do not rely on server validation alone — mobile users on slow connections should know about errors before spending upload bandwidth.

### Accepted file types

```
image/jpeg   .jpg .jpeg
image/png    .png
image/webp   .webp
image/heic   .heic   ← Apple iPhone default format; converted to JPEG before compress
image/heif   .heif   ← HEIF variant; same treatment as HEIC
```

Reject everything else — GIF, SVG, BMP, TIFF, PDF. No exceptions.

### Size limits

| Check | Limit | Why |
|---|---|---|
| Raw file (before compression) | 20MB max | Allows uncompressed iPhone HEIC/JPEG |
| After compression | 800KB target, 1.5MB hard cap | Keeps Storage costs and CDN egress low |
| Min dimension | 200 × 200 px | Below this the image is unusable for any display size |
| Max dimension (enforced during compression) | 2000 × 2000 px | Above this adds zero visual benefit at any breakpoint |

### Validation error messages (shown in Vietnamese)

```typescript
'INVALID_TYPE'    → "Chỉ chấp nhận ảnh JPG, PNG, hoặc WebP."
'TOO_LARGE'       → "Ảnh quá lớn (tối đa 20MB). Hãy thử ảnh khác."
'TOO_SMALL'       → "Ảnh quá nhỏ (tối thiểu 200×200px)."
'COMPRESS_FAILED' → "Không thể xử lý ảnh. Thử lại hoặc chọn ảnh khác."
```

---

## 4. Compression Strategy

Compress **client-side** before upload using [`browser-image-compression`](https://github.com/Donaldcwl/browser-image-compression).  
Never upload raw camera photos directly to Storage.

```
install:  npm install browser-image-compression
```

### Compression settings by slot

| Slot | Max width/height | Quality | Max output size |
|---|---|---|---|
| Storefront avatar | 400 × 400 px | 85% | 150KB |
| Storefront cover | 1400 × 600 px | 85% | 400KB |
| Product image | 1200 × 1200 px | 80% | 600KB |
| Service image | 1200 × 900 px | 80% | 500KB |

**Why WebP output:**  
`browser-image-compression` outputs the same format as input. Convert to WebP on the server via Supabase Transform (`format=webp`) at serve time — do not attempt HEIC→WebP conversion client-side (inconsistent browser support).

**HEIC handling:**  
Safari on iOS returns `image/heic` MIME type. `browser-image-compression` handles HEIC natively on supported browsers. On unsupported browsers, prompt the user to select a different file format.

### Compression pipeline

```
User selects file
       ↓
1. validateImageFile()     ← type check, raw size check
       ↓
2. compressImage()         ← resize to max dimensions + quality reduction
       ↓
3. validateCompressed()    ← check output ≤ hard cap (1.5MB)
       ↓
4. uploadImage()           ← upsert to deterministic storage path
       ↓
5. Update DB column        ← storefront.avatar_url or product_images.image_url
```

---

## 5. Image Size Rules

### Storefront avatar

```
Display uses:   storefront card chip (48×48), storefront page header (96×96)
Upload target:  400×400 square (owner can reframe)
Storage:        storefronts/{id}/avatar.webp
Serve at:       ?width=96&quality=80 for display, ?width=400 for OG fallback
```

### Storefront cover

```
Display uses:   storefront page hero (full-width ≤1200px), OG image (1200×630)
Upload target:  min 1200×630 (16:9 or wider)
Storage:        storefronts/{id}/cover.webp
Serve at:       ?width=1200&quality=85 for hero, ?width=400 for card preview
Aspect ratio:   No crop enforcement — show letterbox if not 16:9
```

### Product image

```
Display uses:   product card (280×280), product page gallery (800×800 max), OG image
Upload target:  min 600×600 (square recommended for gallery)
Storage:        products/{id}/{sort_order}.webp
First image:    used as OG image — must be ≥600×600
Serve at:       ?width=280 for cards, ?width=800 for gallery, ?width=1200 for OG
```

### Service image

```
Display uses:   service card (280×200), service page gallery
Upload target:  min 800×560 (landscape recommended)
Storage:        services/{id}/{sort_order}.webp
Serve at:       ?width=280 for cards, ?width=800 for gallery
```

---

## 6. Responsive Images

Supabase Storage has a built-in image transformation API. Use it instead of storing multiple size variants.

**Transform URL format:**
```
{SUPABASE_URL}/storage/v1/render/image/public/media/{path}?width=400&quality=80&format=webp
```

**Transform parameters used in this project:**

| Parameter | Values | Notes |
|---|---|---|
| `width` | 200, 280, 400, 800, 1200 | Height auto-scales maintaining aspect ratio |
| `quality` | 70–85 | 80 is the standard; 85 for hero/OG images |
| `format` | `webp`, `origin` | Always request `webp` in `<source>` elements; `origin` as fallback |
| `resize` | `cover` (default) | `cover` crops to exact dimensions; omit for proportional |

### srcset implementation

Use `<picture>` with WebP source + JPEG fallback:

```html
<picture>
  <!-- WebP for modern browsers -->
  <source
    type="image/webp"
    srcset="
      {transformUrl(path, 280, 'webp')} 280w,
      {transformUrl(path, 560, 'webp')} 560w,
      {transformUrl(path, 800, 'webp')} 800w
    "
    sizes="(max-width: 640px) 280px, (max-width: 1024px) 400px, 800px"
  />
  <!-- JPEG fallback -->
  <img
    src="{transformUrl(path, 400, 'origin')}"
    alt="{alt}"
    width="400"
    height="400"
    loading="lazy"
    decoding="async"
  />
</picture>
```

### Breakpoint reference

| Context | Display size | srcset sizes value |
|---|---|---|
| Product/service card | 280px | `(max-width: 640px) 280px, 280px` |
| Storefront card | 400px | `(max-width: 640px) 100vw, 400px` |
| Product gallery | up to 800px | `(max-width: 640px) 100vw, 800px` |
| Storefront cover hero | full width ≤1200px | `100vw` |
| OG image (not in HTML) | fixed 1200×630 | n/a — fetch once |

### CLS prevention

Always include `width` and `height` on `<img>`. This lets the browser reserve space before the image loads, preventing Cumulative Layout Shift (Core Web Vitals penalty).

```html
<!-- ✅ Always include explicit dimensions -->
<img src="..." width="400" height="400" alt="..." />

<!-- ❌ Missing dimensions causes CLS -->
<img src="..." alt="..." />
```

---

## 7. Storage Organization

### Folder lifecycle

```
When storefront is created:
  mkdir storefronts/{storefront_id}/    ← implicit (Supabase creates on first upload)

When avatar is uploaded:
  upsert storefronts/{storefront_id}/avatar.webp

When storefront is deleted:
  delete storefronts/{storefront_id}/*  ← delete all files in folder
  (triggered by application code — Supabase does not cascade-delete storage on row delete)
```

### Orphan prevention

DB cascade-delete removes the row, but **Storage objects are NOT automatically deleted when a DB row is deleted**. Handle this explicitly:

```typescript
// In the delete storefront server function:
async function deleteStorefront(id: string) {
  // 1. Delete storage objects first
  await deleteStorefrontImages(id)

  // 2. Then delete the DB row (RLS: only owner or admin)
  await supabase.from('storefronts').delete().eq('id', id)
}
```

If a delete fails halfway (storage deleted, DB row intact), the row shows broken image URLs. Prefer storage-first deletion order — a broken URL is visible; a DB ghost row with images is invisible.

### Maximum images per entity

| Entity | Max images | Enforced by |
|---|---|---|
| Storefront avatar | 1 | Fixed slot — upsert overwrites |
| Storefront cover | 1 | Fixed slot — upsert overwrites |
| Product | 5 | App layer check before upload |
| Service | 4 | App layer check before upload |

Enforce the max at upload time, before the file is processed:
```typescript
const existingCount = await countProductImages(productId)
if (existingCount >= 5) throw new Error('MAX_IMAGES')
```

---

## 8. Storage RLS Strategy

Supabase Storage RLS runs as Postgres policies on the `storage.objects` table. The file path is available as `name`.

### Policy logic

```sql
-- Public read: anyone can read any object in 'media' bucket
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

-- Storefront owner can write to their storefront folder
create policy "media_storefront_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'storefronts'
    and exists (
      select 1 from public.storefronts
      where id::text = (storage.foldername(name))[2]
        and owner_id = auth.uid()
    )
  );

-- Product/service image write: owner of the storefront that owns the product
create policy "media_product_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'products'
    and exists (
      select 1 from public.products p
      join public.storefronts s on s.id = p.storefront_id
      where p.id::text = (storage.foldername(name))[2]
        and s.owner_id = auth.uid()
    )
  );
```

These RLS policies belong in a separate migration:  
`supabase/migrations/YYYYMMDD_storage_rls.sql`

**Admin bypass:** The `createServerSupabaseClient()` uses the service role key which bypasses RLS — use it for admin delete operations and cleanup jobs.

---

## 9. URL Column Strategy

After upload, save only the **storage path** (not the full CDN URL) in the database column.

```
✅ Store:   storefronts/{id}/avatar.webp
❌ Store:   https://xxx.supabase.co/storage/v1/object/public/media/storefronts/{id}/avatar.webp
```

**Why path, not full URL:**
- Supabase project URL can change (project migration, custom domain)
- Transform URL is constructed at render time, not at write time
- Path is environment-agnostic (works local, staging, prod)

Build the full URL in the utility function, not in the DB:

```typescript
export function getPublicUrl(path: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  return `${supabaseUrl}/storage/v1/object/public/media/${path}`
}

export function getTransformUrl(path: string, width: number, quality = 80): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  return `${supabaseUrl}/storage/v1/render/image/public/media/${path}?width=${width}&quality=${quality}&format=webp`
}
```

---

## 10. SEO Image Rules

| Rule | Why |
|---|---|
| Always set `alt` text | Screen readers + Google Image Search |
| `alt` = `"{business_name} — {context}"` | Keyword-relevant, not generic "product image" |
| Set `width` + `height` on all `<img>` | Prevents CLS (Core Web Vitals) |
| Use `loading="lazy"` below the fold | Faster LCP for visible images |
| Use `loading="eager"` on hero/cover | Hero image IS the LCP element — preload it |
| Serve WebP via `<source type="image/webp">` | 25-35% smaller than JPEG at same quality |
| OG image ≥ 1200×630 | Facebook + TikTok require this for full-bleed preview |
| First product/service image = OG image | Consistent social share appearance |
| Storefront cover = OG image | Storefront page social share |

**`alt` text formula:**

```typescript
// Product
alt = `${product.title} – ${storefront.business_name}`
// → "Bơ Sáp Xanh – Vườn Bơ Bà Năm"

// Service
alt = `${service.title} – ${storefront.business_name}`
// → "Sấy Nông Sản – Cơ Sở Sấy Anh Tú"

// Storefront avatar
alt = `Logo ${storefront.business_name}`

// Storefront cover
alt = `Ảnh bìa ${storefront.business_name}`
```

---

## 11. Migration Checklist

```
☐ Create 'media' bucket in Supabase Storage (dashboard or migration)
☐ Set bucket to public read
☐ Set file size limit to 20MB
☐ Set allowed MIME types
☐ Write storage RLS migration (see Section 8)
☐ Install browser-image-compression: npm install browser-image-compression
☐ All DB columns storing images: use path format (not full URL)
☐ All <img> elements: include width, height, alt, loading attributes
☐ Delete handlers: remove storage objects before deleting DB rows
```
