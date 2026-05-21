import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Internal helpers — validate at call-time so misconfiguration surfaces early
// ---------------------------------------------------------------------------

function requirePublicVar(key: string): string {
  const value = import.meta.env[key] as string | undefined
  if (!value) throw new Error(`[supabase] Missing public env var: ${key}`)
  return value
}

function requireServerVar(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`[supabase] Missing server env var: ${key}`)
  return value
}

// ---------------------------------------------------------------------------
// Exported factories — call these where you need a client, not at module scope
// ---------------------------------------------------------------------------

/**
 * Browser-safe client.
 * Uses the publishable (anon) key; safe to include in client bundles.
 * Suitable for: components, hooks, client-side loaders.
 *
 * Required env vars:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  return createClient(
    requirePublicVar('VITE_SUPABASE_URL'),
    requirePublicVar('VITE_SUPABASE_PUBLISHABLE_KEY'),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  )
}

/**
 * Server-only privileged client.
 * Uses the service role key — NEVER import this in browser-side code.
 * Create a fresh instance per server function call; do not share across requests.
 * Suitable for: server functions (createServerFn), API routes, background jobs.
 *
 * Required env vars (no VITE_ prefix — never bundled to the client):
 *   SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */
export function createServerSupabaseClient(): SupabaseClient {
  return createClient(
    requireServerVar('SUPABASE_URL'),
    requireServerVar('SUPABASE_SECRET_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}
