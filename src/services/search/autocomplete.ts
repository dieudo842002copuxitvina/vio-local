// ---------------------------------------------------------------------------
// Autocomplete service for VIO LOCAL — products, storefronts, geo, services.
//
// Architecture:
//   DB layer  — `search_autocomplete` materialized view (pg_trgm + unaccent)
//   RPC       — autocomplete_search() PostgreSQL function (single round-trip)
//   Service   — searchAutocomplete() wraps RPC, builds URLs, groups results
//   Hook      — useAutocomplete() debounces, caches, cancels in-flight reqs
//
// Vietnamese language:
//   All normalization (unaccent + lower) happens in PostgreSQL.
//   Callers pass raw user input — no client-side stripping needed.
//   "ca phe" will match "cà phê", "Bm Thuot" will fuzzy-match "Buôn Ma Thuột".
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutocompleteEntityType =
  | 'province'
  | 'district'
  | 'storefront'
  | 'product'
  | 'service'

export interface AutocompleteResult {
  entityType:  AutocompleteEntityType
  entityId:    string
  displayText: string
  subtitle:    string | null
  slug:        string
  url:         string          // ready-to-use href — callers don't build URLs
  matchPrefix: boolean         // true = user's text is a prefix (bold hint for UI)
}

/** Results grouped by entity type for section-based mobile dropdowns. */
export interface GroupedAutocompleteResults {
  provinces:   AutocompleteResult[]
  districts:   AutocompleteResult[]
  storefronts: AutocompleteResult[]
  products:    AutocompleteResult[]
  services:    AutocompleteResult[]
  /** Total count across all groups — useful for "no results" detection. */
  total:       number
}

export interface AutocompleteOptions {
  /** Scope results to this province (geo entities always returned regardless). */
  provinceId?:  number
  /** Max results per entity type. Default 3 → up to 15 rows total. */
  limitEach?:   number
}

// ---------------------------------------------------------------------------
// Raw row returned by the autocomplete_search RPC function
// ---------------------------------------------------------------------------

interface RpcRow {
  entity_type:   string
  entity_id:     string
  display_text:  string
  subtitle:      string | null
  slug:          string
  province_slug: string | null
  match_prefix:  boolean
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Builds the canonical URL for an autocomplete result.
 * province_slug is required for district URLs — it must be in the RPC row.
 */
function buildEntityUrl(row: RpcRow): string {
  switch (row.entity_type) {
    case 'province':
      return `/${row.slug}`
    case 'district':
      // District pages live under their province: /[province]/[district]
      return row.province_slug
        ? `/${row.province_slug}/${row.slug}`
        : `/${row.slug}`  // fallback — should not happen if view is correct
    case 'storefront':
      return `/ho-kinh-doanh/${row.slug}`
    case 'product':
      return `/san-pham/${row.slug}`
    case 'service':
      return `/dich-vu/${row.slug}`
    default:
      return '/'
  }
}

// ---------------------------------------------------------------------------
// Result mapper
// ---------------------------------------------------------------------------

function mapRow(row: RpcRow): AutocompleteResult {
  return {
    entityType:  row.entity_type as AutocompleteEntityType,
    entityId:    row.entity_id,
    displayText: row.display_text,
    subtitle:    row.subtitle,
    slug:        row.slug,
    url:         buildEntityUrl(row),
    matchPrefix: row.match_prefix,
  }
}

function groupResults(rows: RpcRow[]): GroupedAutocompleteResults {
  const groups: GroupedAutocompleteResults = {
    provinces:   [],
    districts:   [],
    storefronts: [],
    products:    [],
    services:    [],
    total:       0,
  }

  for (const row of rows) {
    const result = mapRow(row)
    switch (row.entity_type) {
      case 'province':   groups.provinces.push(result);   break
      case 'district':   groups.districts.push(result);   break
      case 'storefront': groups.storefronts.push(result); break
      case 'product':    groups.products.push(result);    break
      case 'service':    groups.services.push(result);    break
    }
    groups.total++
  }

  return groups
}

// ---------------------------------------------------------------------------
// Empty result constant — avoids re-allocating on every empty response
// ---------------------------------------------------------------------------

const EMPTY_RESULTS: GroupedAutocompleteResults = {
  provinces:   [],
  districts:   [],
  storefronts: [],
  products:    [],
  services:    [],
  total:       0,
}

// ---------------------------------------------------------------------------
// Core service function
// ---------------------------------------------------------------------------

/**
 * Runs the autocomplete RPC and returns grouped results.
 * Designed for use in both the useAutocomplete hook and
 * server-side loaders (prefetch for SEO landing pages).
 *
 * @throws on Supabase RPC error — caller should catch or use the hook.
 */
export async function searchAutocomplete(
  supabase:  SupabaseClient,
  query:     string,
  options:   AutocompleteOptions = {},
): Promise<GroupedAutocompleteResults> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return EMPTY_RESULTS

  const { data, error } = await supabase.rpc('autocomplete_search', {
    p_query:       trimmed,
    p_province_id: options.provinceId ?? null,
    p_limit_each:  options.limitEach  ?? 3,
  })

  if (error) throw error
  if (!data || data.length === 0) return EMPTY_RESULTS

  return groupResults(data as RpcRow[])
}

// ---------------------------------------------------------------------------
// Session-scoped in-memory cache
// ---------------------------------------------------------------------------
// Simple Map with a fixed ceiling. Old entries are evicted when the map grows
// past MAX_CACHE_SIZE (LRU-ish: delete the first/oldest entry).
// TTL is intentionally absent — autocomplete results are stable for a session;
// if the materialized view refreshes, next keystroke will start a new query.

const MAX_CACHE_SIZE = 50
const cache = new Map<string, GroupedAutocompleteResults>()

function cacheKey(query: string, provinceId?: number): string {
  return `${query.trim().toLowerCase()}:${provinceId ?? 'all'}`
}

function cacheGet(key: string): GroupedAutocompleteResults | undefined {
  return cache.get(key)
}

function cacheSet(key: string, value: GroupedAutocompleteResults): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // evict oldest entry
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, value)
}

// ---------------------------------------------------------------------------
// useAutocomplete — React hook
// ---------------------------------------------------------------------------

export interface UseAutocompleteOptions extends AutocompleteOptions {
  /** Debounce delay in ms. Default 200 — fast enough for mobile typing cadence. */
  debounceMs?:  number
  /**
   * Minimum character count before firing. Default 2.
   * Prevents firing on single-char Vietnamese particles ("ở", "ở", "và").
   */
  minChars?:    number
  /** Supabase client. Pass the browser client — this hook is client-only. */
  supabase:     SupabaseClient
}

export interface UseAutocompleteReturn {
  /** Current query string (controlled by setQuery). */
  query:      string
  /** Call on input onChange — drives debounce + fetch. */
  setQuery:   (q: string) => void
  /** Grouped results. Empty groups when query is below minChars. */
  results:    GroupedAutocompleteResults
  /** True while a fetch is in flight. Use to show a spinner or skeleton. */
  isLoading:  boolean
  /** Clear query and results — call on Escape or result selection. */
  clear:      () => void
}

export function useAutocomplete({
  supabase,
  provinceId,
  limitEach  = 3,
  debounceMs = 200,
  minChars   = 2,
}: UseAutocompleteOptions): UseAutocompleteReturn {
  const [query,     setQueryState] = useState('')
  const [results,   setResults]    = useState<GroupedAutocompleteResults>(EMPTY_RESULTS)
  const [isLoading, setIsLoading]  = useState(false)

  // Refs that survive renders without triggering them
  const debounceTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortCtrlRef   = useRef<AbortController | null>(null)

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()

    if (trimmed.length < minChars) {
      setResults(EMPTY_RESULTS)
      setIsLoading(false)
      return
    }

    // Check session cache before hitting the network
    const key     = cacheKey(trimmed, provinceId)
    const cached  = cacheGet(key)
    if (cached) {
      setResults(cached)
      setIsLoading(false)
      return
    }

    // Cancel any in-flight request from a previous keystroke
    abortCtrlRef.current?.abort()
    abortCtrlRef.current = new AbortController()

    setIsLoading(true)

    try {
      const data = await searchAutocomplete(supabase, trimmed, { provinceId, limitEach })
      // Only update state if this request wasn't superseded (abort check)
      if (!abortCtrlRef.current.signal.aborted) {
        cacheSet(key, data)
        setResults(data)
      }
    } catch (err) {
      // Ignore abort errors — a newer request superseded this one
      if (err instanceof Error && err.name === 'AbortError') return
      // Surface real errors to the console; don't crash the input field
      console.error('[autocomplete] search error:', err)
      setResults(EMPTY_RESULTS)
    } finally {
      if (!abortCtrlRef.current?.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [supabase, provinceId, limitEach, minChars])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)

    // Clear any pending debounce timer
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    if (q.trim().length < minChars) {
      abortCtrlRef.current?.abort()
      setResults(EMPTY_RESULTS)
      setIsLoading(false)
      return
    }

    setIsLoading(true)  // show spinner immediately — before debounce fires
    debounceTimer.current = setTimeout(() => runSearch(q), debounceMs)
  }, [runSearch, debounceMs, minChars])

  const clear = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    abortCtrlRef.current?.abort()
    setQueryState('')
    setResults(EMPTY_RESULTS)
    setIsLoading(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      abortCtrlRef.current?.abort()
    }
  }, [])

  return { query, setQuery, results, isLoading, clear }
}
