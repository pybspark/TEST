'use client'

import { useEffect, useState } from 'react'
import { getSignedFileUrl } from '@/lib/supabase'

export function useSignedFileUrl(bucket: string, path: string, expiresIn = 300) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSignedFileUrl(bucket, path, expiresIn).then((signed) => {
      if (!cancelled && signed) setUrl(signed)
      if (!cancelled) setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [bucket, path, expiresIn])

  return { url, loading }
}
