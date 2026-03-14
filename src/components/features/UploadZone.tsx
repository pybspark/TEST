'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient, formatFileSize } from '@/lib/supabase'
import { toast } from 'sonner'

interface UploadItem {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
}

interface UploadZoneProps {
  onUploadComplete?: () => void
  accept?: Record<string, string[]>
  bucket?: string
  fileType?: 'photo' | 'video' | 'file'
}

export default function UploadZone({
  onUploadComplete,
  accept,
  bucket = 'family-files',
  fileType = 'file',
}: UploadZoneProps) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems = acceptedFiles.map((file) => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: true,
  })

  async function uploadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return toast.error('로그인이 필요합니다')

    setUploading(true)
    const pending = items.filter((i) => i.status === 'pending')

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i]
      const ext = item.file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      setItems((prev) =>
        prev.map((x) => x.file === item.file ? { ...x, status: 'uploading', progress: 30 } : x)
      )

      const { error: storageError } = await supabase.storage
        .from(bucket)
        .upload(path, item.file, { upsert: false })

      if (storageError) {
        setItems((prev) =>
          prev.map((x) => x.file === item.file ? { ...x, status: 'error' } : x)
        )
        continue
      }

      // DB에 파일 정보 저장
      await supabase.from('files').insert({
        owner_id: user.id,
        name: item.file.name,
        storage_path: path,
        file_type: fileType,
        mime_type: item.file.type,
        size_bytes: item.file.size,
      })

      setItems((prev) =>
        prev.map((x) => x.file === item.file ? { ...x, status: 'done', progress: 100 } : x)
      )
    }

    setUploading(false)
    toast.success('업로드 완료!')
    onUploadComplete?.()
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">
          {isDragActive ? '여기에 놓으세요!' : '파일을 드래그하거나 클릭해서 선택'}
        </p>
        <p className="text-xs text-gray-400 mt-1">여러 파일 동시 업로드 가능</p>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg p-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{item.file.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(item.file.size)}</p>
              </div>
              {item.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
              {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              {item.status === 'uploading' && (
                <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
              {item.status === 'pending' && (
                <button
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {items.some((i) => i.status === 'pending') && (
            <button
              onClick={uploadAll}
              disabled={uploading}
              className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors disabled:opacity-60"
            >
              {uploading ? '업로드 중...' : `${items.filter((i) => i.status === 'pending').length}개 업로드`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
