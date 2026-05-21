import { getWebRequest } from '@tanstack/react-start/server'
import { createServerSupabaseClient } from '#/services/supabase/client'
import type { User } from '../types'

// ---------------------------------------------------------------------------
// Server-side session utilities
// Call these inside createServerFn handlers, never in browser code.
//
// How token delivery works:
//   The browser client must include the Supabase access token in the
//   Authorization header when invoking a server function:
//
//     const { data: { session } } = await supabase.auth.getSession()
//     // TanStack Start reads request headers automatically in getWebRequest()
//     // Wire up via a fetch wrapper or TanStack Start middleware (see AUTH_ARCHITECTURE.md)
// ---------------------------------------------------------------------------

/**
 * Extract and verify the authenticated user from the current server request.
 * Returns null if the request is unauthenticated or the token is invalid/expired.
 */
export async function getServerUser(): Promise<User | null> {
  const request = getWebRequest()
  if (!request) return null

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  // getUser() validates the token against Supabase — authoritative, not cached
  const supabase = createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  return user as User
}

/**
 * Like getServerUser, but throws if unauthenticated.
 * Use inside server functions that require a logged-in user.
 *
 * @throws 'UNAUTHENTICATED' if no valid session
 */
export async function requireServerUser(): Promise<User> {
  const user = await getServerUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  return user
}
