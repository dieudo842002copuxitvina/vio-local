import { useState, useEffect } from 'react'
import { getStorefrontBySlug } from '../services/storefronts'
import type { Storefront } from '../types'

export function useStorefront(slug: string) {
  const [storefront, setStorefront] = useState<Storefront | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getStorefrontBySlug(slug)
      .then(data => {
        if (!cancelled) {
          setStorefront(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [slug])

  return { storefront, loading, error }
}
