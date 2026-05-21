import { createBrowserSupabaseClient } from '#/services/supabase/client'
import type { SignInCredentials, SignUpCredentials } from '../types'

// Each function creates its own client instance.
// The Supabase client is stateless — session state lives in localStorage,
// shared across all instances via the same storage key.

export async function signIn({ email, password }: SignInCredentials) {
  const supabase = createBrowserSupabaseClient()
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUp({ email, password }: SignUpCredentials) {
  const supabase = createBrowserSupabaseClient()
  return supabase.auth.signUp({ email, password })
}

export async function signOut() {
  const supabase = createBrowserSupabaseClient()
  return supabase.auth.signOut()
}

// getUser() hits the Supabase server — authoritative but slower.
// Use for security-sensitive checks (e.g. before a write operation).
export async function getCurrentUser() {
  const supabase = createBrowserSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return null
  return user
}

// getSession() reads from localStorage — fast but unvalidated.
// Safe for UI decisions (show/hide nav items, redirect checks).
// Do NOT use for server-side authorization.
export async function getSession() {
  const supabase = createBrowserSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function refreshSession() {
  const supabase = createBrowserSupabaseClient()
  const { data: { session }, error } = await supabase.auth.refreshSession()
  if (error) return null
  return session
}
