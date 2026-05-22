# Autocomplete Architecture — VIO LOCAL

## Overview

Keystroke-level search across five entity types (provinces, districts, storefronts, products, services) using only PostgreSQL. No Elasticsearch, no Algolia, no vector database, no AI.

The system has three layers:

```
User keystroke
    ↓
useAutocomplete hook      debounce 200ms · AbortController · session cache
    ↓
searchAutocomplete()      single Supabase RPC call
    ↓
autocomplete_search()     PostgreSQL function → search_autocomplete view
    ↓
pg_trgm + unaccent        GIN-indexed trigram match on normalized text
```

---

## Why pg_trgm, not tsvector

PostgreSQL's full-text search (`tsvector` / `tsquery`) requires a language configuration to tokenize words. There is no built-in `vietnamese` text search config. A generic config would break on Vietnamese compound words and diacritical variations.

`pg_trgm` is the right primitive:

| Requirement | tsvector | pg_trgm |
|---|---|---|
| Prefix match ("cà ph..." → "cà phê") | ✗ stem-only | ✓ |
| Typo tolerance ("bm thot" → "Buôn Ma Thuột") | ✗ | ✓ similarity() |
| Vietnamese word boundaries | ✗ no vn config | ✓ (trigrams are language-agnostic) |
| GIN indexed ILIKE | ✗ | ✓ `gin_trgm_ops` |
| Single extension, no external dependency | ✓ | ✓ |

---

## Vietnamese Language Strategy

Vietnamese users frequently type **without diacritics** on mobile ("cafe", "da lat", "dak lak"). The system must match both forms.

**Solution: `unaccent()` applied to stored text AND to the query.**

```sql
-- Stored:  unaccent(lower('Đà Lạt'))  → 'da lat'
-- Query:   unaccent(lower('Da Lat'))   → 'da lat'  ← match ✓
-- Query:   unaccent(lower('Đà Lạt'))   → 'da lat'  ← match ✓
-- Query:   unaccent(lower('da l'))     → 'da l'    ← prefix match ✓
```

The `search_normalized` column in the materialized view stores pre-computed `unaccent(lower(text))`. The search function applies the same normalization to `p_query` before comparing. No client-side processing is needed.

---

## Materialized View: `search_autocomplete`

A single denormalized table aggregating all five entity types.

| Column | Type | Description |
|---|---|---|
| `entity_type` | text | `'province'`, `'district'`, `'storefront'`, `'product'`, `'service'` |
| `entity_id` | text | UUID or integer cast to text |
| `display_text` | text | Primary label shown in dropdown |
| `subtitle` | text | Secondary label (location, category) |
| `slug` | text | Entity's own slug for URL building |
| `province_id` | smallint | For geographic scoping filter |
| `province_slug` | text | Province slug (needed for district URLs `/[province]/[district]`) |
| `district_id` | integer | Nullable — null for provinces |
| `rank_boost` | smallint | Verified/featured priority signal |
| `search_normalized` | text | `unaccent(lower(display_text))` — the match target |

### Visibility rules (baked into the view definition)

| Entity | Filter |
|---|---|
| Provinces | always included |
| Districts | always included |
| Storefronts | `is_public = true` |
| Products | `is_available = true` AND storefront `is_public = true` |
| Services | `is_available = true` AND storefront `is_public = true` |

Draft storefronts and unavailable listings never appear in autocomplete. No RLS evaluation needed at query time.

### Rank boost values

| State | rank_boost |
|---|---|
| Province / district (geo) | 5 / 4 |
| Verified storefront | 3 |
| Featured product | 2 |
| All others | 1 |

---

## Indexes

```sql
-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY (no table lock)
CREATE UNIQUE INDEX idx_search_ac_pk    ON search_autocomplete(entity_type, entity_id);

-- Hot index — every query hits this
CREATE INDEX idx_search_ac_trgm         ON search_autocomplete
  USING GIN (search_normalized gin_trgm_ops);

-- Geographic scoping — province filter on storefront/product/service results
CREATE INDEX idx_search_ac_province     ON search_autocomplete(province_id)
  WHERE province_id IS NOT NULL;

-- Entity type filter — when the caller restricts to specific types
CREATE INDEX idx_search_ac_type         ON search_autocomplete(entity_type);

-- Rank sort support — boosting within a result set
CREATE INDEX idx_search_ac_rank         ON search_autocomplete(entity_type, rank_boost DESC);
```

The GIN trigram index is the only index that matters for performance. The others are narrow filters applied after trigram pre-selection.

---

## RPC Function: `autocomplete_search()`

```sql
autocomplete_search(
  p_query       text,
  p_province_id smallint  default null,
  p_limit_each  int       default 3
)
returns table (entity_type, entity_id, display_text, subtitle, slug, province_slug, match_prefix)
```

### Internal pipeline

1. **Normalize**: `unaccent(lower(trim(p_query)))` — produces the raw match string
2. **Escape wildcards**: `%` and `_` in user input escaped before passing to `LIKE`
3. **Match condition** (any of):
   - `search_normalized LIKE 'query%'` — prefix match (highest quality)
   - `search_normalized LIKE '%query%'` — contains match
   - `similarity(search_normalized, query) > 0.3` — trigram fuzzy (only if `length(query) >= 3`)
4. **Per-type cap**: `ROW_NUMBER() PARTITION BY entity_type` → keep `<= p_limit_each`
5. **Order**: entity type priority → match tier → rank_boost → alphabetical

### Geographic scoping rule

```
province_id IS NULL (no filter)   → all results
province_id = 66                  → storefronts/products/services in province 66
                                    + ALL provinces and districts regardless
```

Provinces and districts always pass the geo filter. A user in Đắk Lắk typing "Hà N" should still see Hà Nội as a navigation option.

---

## API call pattern

```typescript
// Server-side (SSR route loader) — no geographic scope
const results = await searchAutocomplete(supabase, query)

// Client-side with province scope (user is browsing Đắk Lắk)
const results = await searchAutocomplete(supabase, query, { provinceId: 66 })

// Restrict to storefronts + geo only (custom search modal)
const { data } = await supabase.rpc('autocomplete_search', {
  p_query:       query,
  p_province_id: 66,
  p_limit_each:  5,
})
```

---

## Client Hook: `useAutocomplete`

```tsx
const { query, setQuery, results, isLoading, clear } = useAutocomplete({
  supabase,          // browser Supabase client
  provinceId: 66,    // optional geographic scope
  limitEach:  3,     // max per type (default)
  debounceMs: 200,   // keystroke debounce
  minChars:   2,     // don't fire for single chars
})

// In the input:
<input
  value={query}
  onChange={e => setQuery(e.target.value)}
  onKeyDown={e => e.key === 'Escape' && clear()}
/>

// In the dropdown:
{results.provinces.map(r => <ResultRow key={r.entityId} result={r} />)}
{results.storefronts.map(r => <ResultRow key={r.entityId} result={r} />)}
// etc.
```

### Debounce and cancellation

```
Keystroke 1  →  timer starts (200ms)
Keystroke 2  →  timer reset (200ms from now)
Keystroke 3  →  timer reset (200ms from now)
     200ms later → fetch fires with current query
Keystroke 4 (while fetch is in flight) → AbortController.abort() on prev fetch
                                       → new fetch starts
```

`isLoading` is set to `true` **immediately** on `setQuery` (before debounce fires). This avoids the spinner appearing 200ms late — the UI feels responsive from the first keystroke.

### Session cache

- Scope: JavaScript module-level `Map` — survives component re-mounts, cleared on page navigation
- Key: `${normalized_query}:${provinceId | 'all'}`
- Ceiling: 50 entries (LRU eviction — oldest entry removed when full)
- No TTL: autocomplete results are stable within a session; the materialized view refreshes every 5 minutes, but users won't notice stale autocomplete for the duration of their session

---

## Result grouping

The hook returns results pre-grouped by entity type. The UI renders sections:

```
📍 Tỉnh / Thành phố       ← provinces (max 3)
📍 Quận / Huyện            ← districts (max 3)
🏪 Hộ kinh doanh           ← storefronts (max 3)
📦 Sản phẩm                ← products (max 3)
🔧 Dịch vụ                 ← services (max 3)
```

Sections with 0 results are not rendered. On mobile, 2–3 results per section is the right density — more would require scrolling inside the dropdown.

### `matchPrefix` hint

Each result carries a `matchPrefix: boolean` flag. When `true`, the matching portion of `displayText` starts at position 0. This is a hint for the UI to **bold the matched prefix**:

```tsx
// If matchPrefix=true and query="bm thu", display "**Buôn Ma Thuột**"
// If matchPrefix=false (contains match), display "Cà phê **Buôn** Hồ"
```

---

## URL strategy per entity type

| Entity type | URL pattern | Example |
|---|---|---|
| `province` | `/:slug` | `/dak-lak` |
| `district` | `/:province_slug/:slug` | `/dak-lak/buon-ma-thuot` |
| `storefront` | `/ho-kinh-doanh/:slug` | `/ho-kinh-doanh/ca-phe-buon-me` |
| `product` | `/san-pham/:slug` | `/san-pham/ca-phe-robusta-dak-lak` |
| `service` | `/dich-vu/:slug` | `/dich-vu/sua-xe-may-buon-ma-thuot` |

`province_slug` is stored in the materialized view specifically because district URLs require it — the district's own `slug` alone is not enough to build the URL.

---

## Refresh strategy

The `search_autocomplete` view is refreshed on the same 5-minute pg_cron schedule as `district_discovery_summary`:

```sql
SELECT cron.schedule(
  'refresh-search-autocomplete',
  '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.search_autocomplete'
);
```

`CONCURRENTLY` requires the unique index on `(entity_type, entity_id)`. It refreshes the view without holding a lock, so live queries continue uninterrupted.

**Implication**: a new storefront appears in autocomplete within 5 minutes of being published. This is acceptable for Phase 1. If sub-minute freshness is ever required, add a `pg_notify` trigger that fires a Supabase Edge Function to call `REFRESH MATERIALIZED VIEW` on demand.

---

## Performance targets

| Metric | Target | How achieved |
|---|---|---|
| Query latency (p50) | < 50ms | GIN trigram index pre-filters the view |
| Query latency (p95) | < 120ms | Geographic scoping narrows result set |
| Cache hit rate | > 60% | Session cache + debounce reduces unique queries |
| Network payload | < 5KB | Max 15 rows × ~300 bytes each |
| View refresh time | < 2s | `CONCURRENTLY`, no lock, runs during low traffic |

---

## Security

- `search_autocomplete` view only contains `is_public = true` / `is_available = true` rows. Draft content is never in the index regardless of RLS.
- `GRANT SELECT ON search_autocomplete TO anon, authenticated` — correct. No private data in the view.
- `autocomplete_search()` is `LANGUAGE sql STABLE PARALLEL SAFE` — no side effects, safe for concurrent execution.
- Wildcard injection: user input is escaped inside the function before being used in `LIKE` patterns. Callers pass raw strings safely.

---

## Anti-patterns to avoid

| Anti-pattern | Why | Alternative |
|---|---|---|
| `ILIKE '%query%'` directly on `storefronts.business_name` (no index) | Full table scan on every keystroke | Use `search_autocomplete` view with GIN index |
| Elasticsearch / Typesense / Algolia | Overkill, separate infrastructure, sync complexity | pg_trgm covers all Phase 1 needs |
| Vector / semantic search | Wrong problem — autocomplete needs exact/prefix/fuzzy, not semantic similarity | pg_trgm |
| `tsvector` with default config | Breaks on Vietnamese word boundaries | pg_trgm + unaccent |
| Debounce > 300ms | Feels laggy on mobile | 200ms is the mobile sweet spot |
| Debounce < 100ms | Too many requests, DB pressure | 200ms |
| Firing on 1 char | Returns too many results, no meaningful signal | `minChars = 2` |
| Fetching all entity types when only geo is needed | Wastes DB time | Pass `p_types` filter to RPC |
| Pre-generating static suggestion lists per province | Stale, storage waste, no fuzzy | Always query live |
| Client-side unaccent (stripping diacritics in JS before sending) | Loses the original query, user sees stripped text in UI | Strip only in DB, on search_normalized column |
