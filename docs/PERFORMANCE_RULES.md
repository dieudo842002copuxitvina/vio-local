# Performance Rules — VIO LOCAL

Hard rules for protecting performance and scalability of a hyperlocal commerce platform
serving low-end Android devices on 3G connections in rural Vietnam.

Related docs:
- [`THIN_PAGE_RULES.md`](THIN_PAGE_RULES.md) — SEO content gates
- [`DISCOVERY_ENGINE.md`](DISCOVERY_ENGINE.md) — query patterns for discovery pages
- [`IMAGE_SYSTEM.md`](IMAGE_SYSTEM.md) — storage paths and srcset strategy
- [`OPENGRAPH_ARCHITECTURE.md`](OPENGRAPH_ARCHITECTURE.md) — OG image transforms

---

## Target Device Profile

Every performance decision is made against this baseline:

```
Device:     Entry-level Android (2 GB RAM, Snapdragon 400-class)
Browser:    Chrome for Android (latest)
Connection: 3G — 1.5 Mbps down, 750 Kbps up, ~150 ms RTT
Screen:     360–390 px wide
Location:   Rural Vietnam — higher latency to Ho Chi Minh City edge nodes
```

"Feels fast on desktop" does not mean it is fast. Test on throttled 3G with CPU
4× slowdown in Chrome DevTools before declaring a page done.

---

## Performance Budgets

Concrete limits. These are not aspirational — they are gates.

| Metric | Budget | Tool |
|---|---|---|
| First JS chunk (gzipped) | ≤ 120 KB | `vite-bundle-visualizer` |
| Total JS — first load (gzipped) | ≤ 250 KB | Lighthouse |
| Per-route lazy chunk (gzipped) | ≤ 50 KB | `vite-bundle-visualizer` |
| CSS total (gzipped, purged) | ≤ 30 KB | Lighthouse |
| Supabase queries per page load | ≤ 5 parallel | Code review |
| P95 query time — hot-path queries | ≤ 100 ms | Supabase dashboard |
| LCP — mobile 3G | < 2.5 s | Lighthouse |
| CLS | < 0.1 | Lighthouse |
| INP | < 200 ms | Lighthouse |
| Total image weight — discovery pages | ≤ 200 KB | Lighthouse |
| Total image weight — detail pages | ≤ 400 KB | Lighthouse |

---

## 1. Query Rules

### 1.1 Select only what you render

```typescript
// ❌ Fetches 20+ columns including ones never read
const { data } = await supabase.from('storefronts').select('*')

// ✅ Explicit column list — exactly what the StorefrontCard renders
const { data } = await supabase
  .from('storefronts')
  .select('id, slug, name, avatar_url, district_id, is_verified, phone')
```

**Wide tables that must never use `select('*')` in loaders:**
`storefronts`, `profiles`, `products`, `services`, `land_listings`

### 1.2 Parallel queries — always

```typescript
// ❌ Sequential — adds latency of each query
const storefront = await supabase.from('storefronts').select(...)...
const products   = await supabase.from('products').select(...)...
const nearby     = await supabase.from('storefronts').select(...)...

// ✅ Parallel — total time = slowest query, not sum of all
const [storefront, products, nearby] = await Promise.all([
  supabase.from('storefronts').select(...),
  supabase.from('products').select(...),
  supabase.from('storefronts').select(...),
])
```

Every route loader with more than one query must use `Promise.all()`.

### 1.3 `count: 'exact'` only when pagination renders

```typescript
// ❌ Counts every row even when you don't show page numbers
const { data, count } = await supabase
  .from('storefronts')
  .select('id, name', { count: 'exact' })

// ✅ Omit count for infinite scroll or section previews
const { data } = await supabase
  .from('storefronts')
  .select('id, name')
  .limit(20)

// ✅ Include count only for numbered pagination UI
const { data, count } = await supabase
  .from('storefronts')
  .select('id, name', { count: 'exact' })
  .range(from, to)
```

`count: 'exact'` appends a full `COUNT(*)` subquery. It is expensive on large tables.

### 1.4 `maybeSingle()` over `single()`

```typescript
// ❌ Throws a 406 error if the row doesn't exist
const { data } = await supabase.from('storefronts').eq('slug', slug).single()

// ✅ Returns null — handle in loader with throw notFound()
const { data } = await supabase.from('storefronts').eq('slug', slug).maybeSingle()
if (!data) throw notFound()
```

`single()` raises an error to PostgREST if zero rows are returned. `maybeSingle()`
returns null. 404 routes are not errors — they are expected states.

### 1.5 No N+1 queries

```typescript
// ❌ N+1 — 1 query for storefronts, then N queries for their districts
const storefronts = await fetchStorefronts(provinceId)
for (const sf of storefronts) {
  sf.district = await fetchDistrict(sf.district_id)   // N round trips
}

// ✅ JOIN — one query
const { data } = await supabase
  .from('storefronts')
  .select('*, districts(id, name, slug)')
  .eq('province_id', provinceId)
```

If you find yourself calling Supabase inside a `.map()` or `for` loop, stop.
Use a JOIN, a `.in()` filter, or an RPC that handles the aggregation server-side.

### 1.6 Always set `.limit()`

```typescript
// ❌ Unbounded — returns ALL storefronts if province has 10,000
const { data } = await supabase.from('storefronts').eq('province_id', id)

// ✅ Bounded — explicit page size
const { data } = await supabase
  .from('storefronts')
  .eq('province_id', id)
  .limit(20)
```

Unbounded queries are a reliability risk. They are also a data-leak risk if RLS
has a logic error. Always limit, even for queries that "should" return few rows.

### 1.7 Cursor pagination over offset at scale

```typescript
// ❌ Offset pagination degrades at high pages (page 500 = OFFSET 10000)
.range(pageIndex * 20, (pageIndex + 1) * 20 - 1)

// ✅ Cursor pagination using created_at (or id) — constant cost
.lt('created_at', cursor)   // cursor = last item's created_at
.order('created_at', { ascending: false })
.limit(20)
```

Use offset pagination only for discovery pages where page numbers are shown
in the UI (page 2, page 3). Use cursor pagination for infinite scroll.

### 1.8 RPC for GROUP BY and window functions

PostgREST cannot express `GROUP BY ... HAVING COUNT(*) >= N` or window functions.
Never emulate them with application-layer loops. Use a named SQL function:

```sql
-- In a migration file
create or replace function public.get_province_storefront_counts()
returns table(province_id smallint, province_slug text, total bigint)
language sql stable parallel safe as $$
  select province_id, provinces.slug, count(*) as total
  from storefronts
  join provinces on provinces.id = storefronts.province_id
  where is_public = true
  group by storefronts.province_id, provinces.slug
  having count(*) >= 1
$$;
```

```typescript
// In the route loader
const { data } = await supabase.rpc('get_province_storefront_counts')
```

See `supabase/migrations/20260522000002_sitemap_helpers.sql` for the pattern.

---

## 2. Image Rules

### 2.1 Always use Supabase Transform — no raw URLs

```typescript
// ❌ Sends the full-resolution upload (potentially 5–10 MB) to the browser
<img src={`${supabaseUrl}/storage/v1/object/public/media/${path}`} />

// ✅ Transform API resizes server-side before sending
<img src={`${supabaseUrl}/storage/v1/render/image/public/media/${path}?width=360&height=240&resize=cover&format=webp`} />
```

Use `buildOgImageUrl()` for OG images. Build a matching `buildThumbnailUrl(path, w, h)`
helper for component-level images — never inline the URL construction.

### 2.2 Responsive `srcset` — three sizes minimum

```tsx
// ✅ srcset lets the browser pick the right size for the device
<img
  src={buildThumbnailUrl(path, 360, 240)}
  srcSet={`
    ${buildThumbnailUrl(path, 360, 240)} 360w,
    ${buildThumbnailUrl(path, 750, 500)} 750w,
    ${buildThumbnailUrl(path, 1200, 800)} 1200w
  `}
  sizes="(max-width: 640px) 360px, (max-width: 1024px) 750px, 1200px"
  width={360}
  height={240}
  alt="Mô tả ảnh"
/>
```

On a 360px mobile screen, the browser downloads 360w — not 1200w.
Without `srcset`, every user downloads the largest image.

### 2.3 Explicit `width` and `height` on every `<img>`

```tsx
// ❌ CLS — layout shifts when image loads because browser doesn't know size
<img src={url} alt="..." />

// ✅ Browser reserves space immediately; zero CLS
<img src={url} width={360} height={240} alt="..." />
```

CLS is a Core Web Vitals ranking signal. One image without dimensions can push
CLS above 0.1. This rule has no exceptions.

### 2.4 LCP image: `fetchpriority="high"`, no `loading="lazy"`

```tsx
// The first visible image on the page — storefront cover, product hero, etc.
<img
  src={heroImageUrl}
  fetchPriority="high"   // browser fetches this before other resources
  loading="eager"        // do not defer this one
  width={750}
  height={500}
  alt="..."
/>
```

Every discovery page and detail page has exactly one LCP image. All other images
use `loading="lazy"`. Do not mark multiple images as `fetchPriority="high"` — the
signal loses meaning when applied to everything.

### 2.5 `loading="lazy"` for below-fold images

```tsx
// Everything after the first card row on discovery pages
<img loading="lazy" src={...} width={360} height={240} alt="..." />
```

On a mobile discovery page with 20 cards, only the top 3–4 cards are above the fold.
Eager-loading all 20 images wastes 3G bandwidth on images the user may never see.

### 2.6 No image URL construction outside `src/services/`

Image URL construction — including Transform parameters — belongs in a single
service file, not scattered across components:

```
src/services/storage/images.ts   ← all image URL builders live here
  buildThumbnailUrl(path, w, h)
  buildAvatarUrl(path, size)
  buildOgImageUrl(path)          ← re-exported from src/services/seo/og.ts
```

If a component is constructing a Supabase Storage URL inline, move it to `images.ts`.

---

## 3. Component Rules

### 3.1 Strip devtools in production

`src/routes/__root.tsx` currently imports and renders devtools unconditionally.
This ships devtools code to production users:

```tsx
// ❌ Current state — devtools in production bundle
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

// ✅ Development-only
const TanStackDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import('@tanstack/react-devtools').then(m => ({ default: m.TanStackDevtools }))
    )
  : () => null
```

This is a launch-blocking issue — devtools packages are large.

### 3.2 No `useState` for URL-encodable state

```tsx
// ❌ Filter state in component — breaks back button, not shareable
const [landType, setLandType] = useState<LandType | null>(null)

// ✅ Filter state in URL — shareable, back-button compatible, SSR-friendly
const { landType } = Route.useSearch()
// URL: /dat-nong-nghiep/dong-nai?landType=an_trai
```

Filters, sort order, active tab, and page number belong in the URL via TanStack
Router's `validateSearch` / `search` API. Not `useState`. Not `useContext`.

### 3.3 No anonymous closures in JSX for stable handlers

```tsx
// ❌ New function created on every render — defeats React reconciliation on lists
{storefronts.map(sf => (
  <StorefrontCard
    key={sf.id}
    onSave={() => handleSave(sf.id)}   // ← new function every render
  />
))}

// ✅ Pass the id as a prop; let the component bind internally
{storefronts.map(sf => (
  <StorefrontCard
    key={sf.id}
    id={sf.id}
    onSave={handleSave}                // ← stable reference
  />
))}
```

### 3.4 No data-fetching in providers

```tsx
// ❌ Wraps the tree in a provider that runs a Supabase query
export function StorefrontsProvider({ children }) {
  const [storefronts, setStorefronts] = useState([])
  useEffect(() => { supabase.from('storefronts').select(...) }, [])
  return <StorefrontsContext.Provider value={storefronts}>{children}</StorefrontsContext.Provider>
}

// ✅ Data from the route loader; no provider needed
export const Route = createFileRoute('/dong-nai')({
  loader: ({ context }) => getProvinceStorefronts(context.supabase, provinceId),
  component: ProvincePage,
})
function ProvincePage() {
  const { storefronts } = Route.useLoaderData()
  // ...
}
```

### 3.5 Lazy-load heavy components

```tsx
// Components that should never be in the main bundle:
const InquiryModal   = React.lazy(() => import('../components/InquiryModal'))
const SavedItemsMenu = React.lazy(() => import('../components/SavedItemsMenu'))
const ImageGallery   = React.lazy(() => import('../components/ImageGallery'))

// Wrap in Suspense at the call site
<Suspense fallback={null}>
  {showInquiry && <InquiryModal />}
</Suspense>
```

Modal dialogs, multi-step forms, and heavy galleries are never shown on first paint.
They must be lazy-loaded. If they are in the main bundle, every page pays their cost.

### 3.6 `key` must be a stable entity ID

```tsx
// ❌ Re-mounts the entire component on every render
key={Math.random()}

// ❌ Wrong on reorder/filter — index is not stable
key={index}

// ✅ DB primary key — stable across renders, sorts, and filters
key={storefront.id}
```

---

## 4. Caching Rules

### 4.1 HTTP cache headers per page type

Set in TanStack Start server functions / API handlers:

```typescript
// Discovery pages — province, district, category × geo
'Cache-Control: public, s-maxage=300, stale-while-revalidate=3600'

// Entity detail pages — storefront, product, service, land listing
'Cache-Control: public, s-maxage=60, stale-while-revalidate=600'

// Content pages — /nong-san/:crop/:province, /mua-vu/:season
'Cache-Control: public, s-maxage=300, stale-while-revalidate=3600'

// Authenticated pages — dashboard, owner management, saved items
'Cache-Control: private, no-store'

// Sitemap files (already in SITEMAP_CACHE_CONTROL constant)
'Cache-Control: public, max-age=3600, s-maxage=3600'
```

`s-maxage` is the Vercel Edge cache TTL. `stale-while-revalidate` serves stale
content while refreshing in the background — users never wait for a cold cache miss.

### 4.2 Never refresh a materialized view in the request path

```typescript
// ❌ Blocks the request for the full refresh duration
await supabase.rpc('refresh_discovery_summary')   // DO NOT do this in a route loader

// ✅ Refresh runs on a schedule via pg_cron — request path never touches it
-- In the migration:
select cron.schedule('refresh-discovery-summary', '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.district_discovery_summary');
```

Materialized view refresh blocks concurrent reads on non-concurrent refreshes.
`CONCURRENTLY` prevents blocking but still uses DB resources. Never in request path.

### 4.3 Province and district lists — module-level cache

```typescript
// src/services/geo/cache.ts

let provinceCache: Province[] | null = null

export async function getCachedProvinces(supabase: SupabaseClient): Promise<Province[]> {
  if (provinceCache) return provinceCache
  const { data } = await supabase
    .from('provinces')
    .select('id, slug, name, name_full')
    .order('name')
  provinceCache = data ?? []
  return provinceCache
}
```

Provinces change once per decade (government admin reform). Districts change once
per several years. Querying them on every request is wasteful. Module-level cache
with a null-guard is sufficient — the cache lives for the duration of a server
process lifecycle.

**Do not apply module-level caching to business data.** Storefronts, products, and
land listings change frequently. Only geographic reference data is appropriate here.

### 4.4 TanStack Router `staleTime` per route type

```typescript
// Discovery pages — province/district lists change infrequently
export const Route = createFileRoute('/$provinceSlug')({
  loader: ...,
  staleTime: 5 * 60 * 1000,   // 5 minutes before client-side refetch
})

// Storefront detail — owner can update; fresher cache
export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
  loader: ...,
  staleTime: 30 * 1000,        // 30 seconds
})

// Owner dashboard — always fresh
export const Route = createFileRoute('/dashboard')({
  loader: ...,
  staleTime: 0,                // refetch on every focus
})
```

Never use the default `staleTime` (0) for public-facing discovery pages — it causes
a refetch on every tab focus, generating unnecessary Supabase read load.

---

## 5. Route-Loading Rules

### 5.1 All page data in the route loader

```typescript
// ❌ useEffect data fetch — shows loading spinner on every navigation
function StorefrontPage() {
  const [storefront, setStorefront] = useState(null)
  useEffect(() => {
    supabase.from('storefronts').eq('slug', slug).maybeSingle()
      .then(({ data }) => setStorefront(data))
  }, [slug])
  if (!storefront) return <Spinner />
  return <StorefrontDetail storefront={storefront} />
}

// ✅ Loader — data available on first paint, no spinner
export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
  loader: async ({ params, context }) => {
    const storefront = await getStorefrontBySlug(context.supabase, params.slug)
    if (!storefront) throw notFound()
    return { storefront }
  },
  component: StorefrontPage,
})
```

### 5.2 Fail fast — validate before querying

```typescript
// ✅ Check param format before hitting the DB
export const Route = createFileRoute('/dat-nong-nghiep/$slug')({
  loader: async ({ params, context }) => {
    // Slug must be non-empty and match slug format
    if (!params.slug || !/^[a-z0-9-]+$/.test(params.slug)) throw notFound()

    // Now hit the DB
    const result = await resolveSegment(context.supabase, params.slug)
    if (!result) throw notFound()
    return result
  },
})
```

A slug with invalid characters cannot match anything in the DB. Rejecting it before
the query saves a round trip and prevents potential injection via unexpected characters.

### 5.3 `defer()` for non-critical sections

```typescript
export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
  loader: async ({ params, context }) => {
    // Critical: storefront data — blocks render until ready
    const storefront = await getStorefrontBySlug(context.supabase, params.slug)
    if (!storefront) throw notFound()

    // Non-critical: nearby storefronts — deferred, renders after main content
    const nearbyPromise = getNearbyStorefronts(context.supabase, storefront)

    return {
      storefront,
      nearby: defer(nearbyPromise),   // component renders immediately; nearby fills in
    }
  },
})
```

Use `defer()` for sections below the fold or secondary content (nearby, related items,
recent reviews). Never defer the primary content the LCP image is part of.

### 5.4 Route files call services — no inline DB queries

```typescript
// ❌ Route file contains Supabase query inline
export const Route = createFileRoute('/dong-nai')({
  loader: async ({ context }) => {
    const { data } = await context.supabase   // ← DB logic in route file
      .from('storefronts')
      .select('id, name, slug, avatar_url')
      .eq('province_id', 75)
      .eq('is_public', true)
      .limit(20)
    return { storefronts: data }
  },
})

// ✅ Route file calls a service function
export const Route = createFileRoute('/dong-nai')({
  loader: async ({ context }) => {
    const province = await getProvinceBySlug(context.supabase, 'dong-nai')
    if (!province) throw notFound()
    const page = await getProvinceStorefronts(context.supabase, province.id, 0)
    return { province, page }
  },
})
```

Service functions are testable. Inline DB queries in route files are not.

### 5.5 Error boundaries on every route

```typescript
export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
  loader: ...,
  component: StorefrontPage,
  errorComponent: StorefrontError,   // ← required; never omit
  notFoundComponent: StorefrontNotFound,
})

function StorefrontError({ error }: { error: unknown }) {
  // Log to error tracking; show friendly message to user
  return <ErrorMessage message="Không thể tải trang. Vui lòng thử lại." />
}
```

---

## 6. Bundle Size Rules

### 6.1 No `moment.js` — native `Intl.DateTimeFormat`

```typescript
// ❌ moment.js is 300+ KB minified
import moment from 'moment'
const formatted = moment(date).format('DD/MM/YYYY')

// ✅ Native — zero bundle cost, Vietnamese locale built in
const formatted = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric'
}).format(new Date(date))
```

### 6.2 No `lodash` — native array/object methods

```typescript
// ❌ Imports entire lodash even with tree-shaking attempts
import _ from 'lodash'
_.groupBy(items, 'province_id')

// ✅ Native
const grouped = items.reduce((acc, item) => {
  ;(acc[item.province_id] ??= []).push(item)
  return acc
}, {} as Record<number, typeof items>)
```

### 6.3 Named icon imports only

```typescript
// ❌ Imports entire Lucide library (~600 icons, large bundle)
import * as Icons from 'lucide-react'
const Icon = Icons[iconName]

// ✅ Named import — Vite tree-shakes unused icons
import { MapPin, Phone, Store, Clock } from 'lucide-react'
```

Never import icons dynamically from a string (`Icons[iconName]`) — this defeats
tree-shaking and imports the entire library.

### 6.4 Devtools stripped — production gate required

`src/routes/__root.tsx` currently ships devtools to production. Fix before launch:

```tsx
// src/routes/__root.tsx
const DevTools = import.meta.env.DEV
  ? React.lazy(() =>
      import('@tanstack/react-devtools').then(m => ({
        default: m.TanStackDevtools,
      }))
    )
  : () => null

const RouterDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import('@tanstack/react-router-devtools').then(m => ({
        default: m.TanStackRouterDevtoolsPanel,
      }))
    )
  : () => null
```

### 6.5 No inline Supabase client construction

```typescript
// ❌ Creates a new client on every render; also bundles credentials into component
function StorefrontPage() {
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
  // ...
}

// ✅ Factory from src/lib/supabase/ — singleton, passed via router context
const supabase = createBrowserClient()   // called once at app init
```

### 6.6 No dynamic Tailwind class strings

```tsx
// ❌ Defeats Tailwind's content scanner — class not in bundle
<div className={`bg-${color}-500`} />

// ✅ Full class names always present for scanner to find
const COLOR_CLASSES: Record<string, string> = {
  green:  'bg-green-500',
  orange: 'bg-orange-500',
  red:    'bg-red-500',
}
<div className={COLOR_CLASSES[color]} />
```

### 6.7 Measure before merging large dependencies

Before adding any new package with bundled JS ≥ 20 KB:

```bash
# Run after build
npx vite-bundle-visualizer
```

Check that the new dependency doesn't push a chunk past its budget. If it does,
either find a smaller alternative or lazy-load the feature using it.

---

## 7. SEO Rendering Rules

### 7.1 All meta tags in the route `head` config — not `useEffect`

```tsx
// ❌ Crawler sees the SSR response; useEffect runs after — meta not seen
function StorefrontPage() {
  useEffect(() => {
    document.title = storefront.name   // Crawler never sees this
  }, [storefront])
}

// ✅ head config runs on the server; meta present in SSR response
export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
  head: ({ loaderData }) => ({
    meta: ogToHeadMeta(buildStorefrontOg(loaderData.storefront)),
  }),
})
```

### 7.2 Fix `lang="en"` in `__root.tsx` before launch

`src/routes/__root.tsx` currently sets `<html lang="en">`. This tells Google the
content is English. VIO LOCAL is Vietnamese. Fix before launch:

```tsx
// src/routes/__root.tsx
<html lang="vi" suppressHydrationWarning>
```

Google uses the `lang` attribute for language classification. This is a launch-blocking SEO issue.

### 7.3 Canonical URL set in every route

```typescript
// Every route loader must return a canonical URL
export const Route = createFileRoute('/ho-kinh-doanh/$slug')({
  head: ({ loaderData }) => ({
    meta: [
      ...ogToHeadMeta(loaderData.og),
      { tagName: 'link', rel: 'canonical', href: loaderData.canonical },
    ],
  }),
})
```

Never omit canonical. Routes without canonical are vulnerable to duplicate URL
penalties when crawlers discover them via multiple paths (trailing slash,
query parameters, UTM variants).

### 7.4 JSON-LD in `<head>` — sanitized, not interpolated

```tsx
// ❌ User-controlled strings interpolated directly — XSS risk
const jsonLd = `{"@type":"LocalBusiness","name":"${storefront.name}"}`

// ✅ JSON.stringify escapes all special characters
const jsonLd = JSON.stringify(buildLocalBusinessSchema(storefront))

// In head config:
{ tagName: 'script', type: 'application/ld+json', children: jsonLd }
```

### 7.5 `robots` meta set server-side, not in component

```typescript
// robots directives are business logic — they live in the loader
export const Route = createFileRoute('/$provinceSlug/$districtSlug')({
  loader: async ({ params, context }) => {
    const { total } = await getDistrictStorefronts(...)
    const decision  = resolvePageDecision('district', total, pageIndex, canonicalUrl)
    if (decision.state === 'not-found') throw notFound()
    return { ..., robots: decision.robots }
  },
  head: ({ loaderData }) => ({
    meta: [{ name: 'robots', content: loaderData.robots }],
  }),
})
```

### 7.6 Core Web Vitals — enforce the three signals

| Signal | Target | Primary cause on VIO LOCAL | Fix |
|---|---|---|---|
| LCP | < 2.5 s | Hero image loading late | `fetchpriority="high"` on first image + srcset |
| CLS | < 0.1 | Images without `width`/`height` | Explicit dimensions on every `<img>` |
| INP | < 200 ms | JS blocking main thread | Lazy-load heavy components; avoid synchronous JSON.parse in components |

---

## 8. Database Rules

### 8.1 `EXPLAIN ANALYZE` before every new query

Run on a linked Supabase instance with representative data before merging any new
query pattern. The query plan on an empty DB is meaningless.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, slug, name, avatar_url
FROM storefronts
WHERE province_id = 75
  AND is_public   = true
ORDER BY is_verified DESC, created_at DESC
LIMIT 20;
```

Look for: `Seq Scan` on large tables (should be `Index Scan`), high `actual rows`
vs `estimated rows` divergence (stale statistics — run `ANALYZE`), and nested loop
joins that fan out to large row counts.

### 8.2 Index every FK column

PostgreSQL does not auto-index FK columns. Every `REFERENCES` in a migration needs
a corresponding `CREATE INDEX`:

```sql
-- ❌ FK without index — full table scan on every join
foreign key (storefront_id) references storefronts(id)

-- ✅ Index the FK
foreign key (storefront_id) references storefronts(id),
...
create index if not exists idx_products_storefront
  on public.products(storefront_id);
```

### 8.3 Partial indexes for RLS-filtered queries

If your RLS USING clause filters on a column, the index must also be partial:

```sql
-- RLS policy filters is_public = true
-- ❌ Full index — scans all rows including private ones
create index idx_storefronts_province
  on storefronts(province_id, created_at desc);

-- ✅ Partial index — only public rows in the index
create index idx_storefronts_province
  on storefronts(province_id, is_verified desc, created_at desc)
  where is_public = true;
```

This is the difference between an index scan of 10,000 rows and 200 rows on a
province with mostly private/draft storefronts.

### 8.4 `SECURITY DEFINER` with `SET search_path` — no exceptions

All SECURITY DEFINER functions in this codebase already use `SET search_path = public`.
Never add a new SECURITY DEFINER function without it:

```sql
-- ❌ Vulnerable to search_path injection
create function public.my_function() returns void
security definer
language plpgsql as $$ ... $$;

-- ✅ Locked search path
create function public.my_function() returns void
security definer
set search_path = public
language plpgsql as $$ ... $$;
```

### 8.5 `NOT NULL DEFAULT false` on boolean columns

```sql
-- ❌ NULL is a possible value — RLS USING (is_public = true) misses NULL rows
is_public boolean

-- ✅ No NULL ambiguity
is_public boolean not null default false
```

NULL boolean in a RLS USING clause evaluates to NULL (not true, not false).
The row becomes invisible to all policies. Always `NOT NULL DEFAULT` on booleans.

### 8.6 Trigger scope — row-level, not statement-level for UPDATEs

```sql
-- ❌ Statement-level UPDATE trigger runs once per statement but
--    can UPDATE the entire target table — catastrophic at scale
create trigger ...
  after insert on land_listings
  for each statement                -- ← not row-level
  execute function ...;

-- ✅ Row-level — fires once per affected row, updates exactly one row
create trigger ...
  after insert on land_listings
  for each row
  execute function ...;
```

All triggers in this codebase are `FOR EACH ROW`. Never use `FOR EACH STATEMENT`
for triggers that UPDATE another table.

---

## 9. AI-Safe Coding Rules

AI code assistants (including Claude) consistently generate anti-patterns for this
codebase. Before accepting AI-generated code, verify each item on this checklist.

### Pre-accept checklist

```
[ ] No select('*') on storefronts, products, services, profiles, land_listings
[ ] No sequential awaits for independent queries — must be Promise.all()
[ ] No useEffect(() => { supabase.from(...) }) — data fetching belongs in loaders
[ ] Every Supabase query has .limit()
[ ] No single() — must be maybeSingle() with a null guard
[ ] No hardcoded env variable fallbacks (url ?? 'https://my-project.supabase.co')
[ ] No createClient() inside a component or route file
[ ] No VITE_ prefix on service-role key or secret variables
[ ] Every land_listings query includes moderation_status = 'approved' AND is_public = true
[ ] No <img> without explicit width and height
[ ] No inline dynamic Tailwind class strings (bg-${color}-500)
[ ] Devtools imports wrapped in import.meta.env.DEV guard
```

### Common AI failure modes — examples

**`select('*')` on every query:**
```typescript
// AI writes                              // Must be
.select('*')                              .select('id, slug, name, avatar_url')
```

**Sequential awaits:**
```typescript
// AI writes                              // Must be
const a = await supabase.from('a')...    const [a, b] = await Promise.all([
const b = await supabase.from('b')...      supabase.from('a')...,
                                           supabase.from('b')...,
                                         ])
```

**`single()` without null guard:**
```typescript
// AI writes                              // Must be
.eq('slug', slug).single()               .eq('slug', slug).maybeSingle()
                                          if (!data) throw notFound()
```

**Missing moderation gate on land listings:**
```typescript
// AI writes                              // Must be
supabase.from('land_listings')           supabase.from('land_listings')
  .eq('province_id', id)                   .eq('province_id', id)
                                           .eq('is_public', true)
                                           .eq('moderation_status', 'approved')
```

**Missing `.limit()`:**
```typescript
// AI writes                              // Must be
supabase.from('storefronts')             supabase.from('storefronts')
  .eq('province_id', id)                   .eq('province_id', id)
                                           .limit(20)
```

**Inline client construction:**
```typescript
// AI writes                              // Must be
const supabase = createClient(           // Use factory from src/lib/supabase/
  import.meta.env.VITE_SUPABASE_URL,     const supabase = createBrowserClient()
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**Hardcoded secret fallback:**
```typescript
// AI writes                              // Must be
const url = import.meta.env.VITE_SUPABASE_URL    const url = import.meta.env.VITE_SUPABASE_URL
  ?? 'https://abcdef.supabase.co'                if (!url) throw new Error('VITE_SUPABASE_URL not set')
```

### What AI gets right in this codebase

AI is reliable for:
- TypeScript interface definitions from DB schema
- Template string URL builders for storage paths
- Supabase RPC call wrappers (shape of RPC calls is well-typed)
- JSON-LD object structures (given the schema type)
- Error boundary component shells

Bias toward AI for these. Use human review for query construction, RLS policies,
trigger functions, and bundle composition.
