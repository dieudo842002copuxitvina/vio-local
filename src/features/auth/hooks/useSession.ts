import { useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createBrowserSupabaseClient } from '#/services/supabase/client'

interface UseSessionResult {
  session: Session | null
  user: User | null
  loading: boolean
}

export function useSession(): UseSessionResult {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Seed initial state from localStorage — no network call
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Stay in sync with auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  return {
    session,
    user: session?.user ?? null,
    loading,
  }
}
