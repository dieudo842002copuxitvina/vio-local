import { useState, useEffect } from 'react'
import { getProductBySlug, getProductImages } from '../services/products'
import type { Product, ProductImage } from '../types'

export function useProduct(slug: string) {
  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getProductBySlug(slug)
      .then(async p => {
        if (cancelled) return
        setProduct(p)
        if (p) {
          const imgs = await getProductImages(p.id)
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

  return { product, images, loading, error }
}
