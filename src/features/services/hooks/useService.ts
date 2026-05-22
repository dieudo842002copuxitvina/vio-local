import { useState, useEffect } from 'react'
import { getServiceBySlug, getServiceImages } from '../services/services'
import type { Service, ServiceImage } from '../types'

export function useService(slug: string) {
  const [service, setService] = useState<Service | null>(null)
  const [images, setImages] = useState<ServiceImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getServiceBySlug(slug)
      .then(async s => {
        if (cancelled) return
        setService(s)
        if (s) {
          const imgs = await getServiceImages(s.id)
          if (!cancelled) setImages(imgs)
        }
        setLoading(false)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [slug])

  return { service, images, loading, error }
}
