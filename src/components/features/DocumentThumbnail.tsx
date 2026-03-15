'use client'

import { useEffect, useRef, useState } from 'react'
import { getSignedFileUrl } from '@/lib/supabase'

const PDF_LOAD_TIMEOUT_MS = 8000

type Props = {
  /** 공개 버킷일 때 직접 URL */
  url?: string
  /** 비공개 버킷일 때 서명 URL로 불러옴 (보안 권장) */
  bucket?: string
  storagePath?: string
  mimeType: string
  fallback: React.ReactNode
  className?: string
}

export default function DocumentThumbnail({ url: urlProp, bucket, storagePath, mimeType, fallback, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    if (!mimeType?.toLowerCase().includes('pdf')) {
      setStatus('error')
      return
    }

    let cancelled = false
    const timeoutId = setTimeout(() => {
      setStatus((s) => (s === 'loading' ? 'error' : s))
    }, PDF_LOAD_TIMEOUT_MS)

    async function loadPdf() {
      let pdfUrl = urlProp
      if (!pdfUrl && bucket && storagePath) {
        const signed = await getSignedFileUrl(bucket, storagePath, 60)
        if (cancelled || !signed) {
          if (!cancelled) setStatus('error')
          return
        }
        pdfUrl = signed
      }
      if (!pdfUrl) {
        setStatus('error')
        return
      }

      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise
        if (cancelled) return
        const page = await pdf.getPage(1)
        if (cancelled) return

        const canvas = canvasRef.current
        if (!canvas) return

        const baseViewport = page.getViewport({ scale: 1 })
        const maxW = 280
        const scale = maxW / baseViewport.width
        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height

        const renderTask = page.render({
          canvasContext: canvas.getContext('2d')!,
          viewport,
        })
        await (renderTask.promise ?? Promise.resolve())

        if (!cancelled) setStatus('done')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    loadPdf()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [urlProp, bucket, storagePath, mimeType])

  if (!mimeType?.toLowerCase().includes('pdf')) {
    return <div className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 ${className}`}>{fallback}</div>
  }

  if (status === 'error') {
    return <div className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 ${className}`}>{fallback}</div>
  }

  if (status === 'loading') {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 ${className}`}>
        {fallback}
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full object-contain bg-white ${className}`}
      style={{ maxHeight: '100%' }}
    />
  )
}
