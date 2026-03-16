'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Image, Video, FileText } from 'lucide-react'

const STORAGE_KEY = 'admin_showRecentUploads'

type FileRow = {
  id: string
  name: string
  file_type: string
  storage_path: string
  created_at: string
  profiles?: { name?: string; email?: string } | { name?: string; email?: string }[]
}

export default function AdminRecentUploads({
  allFiles,
  supabaseUrl,
}: {
  allFiles: FileRow[]
  supabaseUrl: string
}) {
  const [showList, setShowList] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      setShowList(saved !== 'false')
    } catch {}
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      window.localStorage.setItem(STORAGE_KEY, showList ? 'true' : 'false')
    } catch {}
  }, [mounted, showList])

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">최근 업로드 전체</h2>
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="text-[11px] px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          {showList ? '리스트 숨기기' : '리스트 보기'}
        </button>
      </div>
      {showList ? (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {allFiles?.map((file) => {
            const Icon = file.file_type === 'photo' ? Image : file.file_type === 'video' ? Video : FileText
            const iconBg =
              file.file_type === 'photo'
                ? 'bg-blue-50 text-brand-600'
                : file.file_type === 'video'
                  ? 'bg-purple-50 text-purple-600'
                  : 'bg-green-50 text-green-600'
            const isPhoto = file.file_type === 'photo'
            const url = `${supabaseUrl}/storage/v1/object/public/family-files/${file.storage_path}`
            const profile = Array.isArray(file.profiles) ? file.profiles[0] : file.profiles
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50"
              >
                {isPhoto ? (
                  <img src={url} alt={file.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{profile?.name || profile?.email}</p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ko })}
                </p>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 py-4 px-3 bg-gray-50 rounded-2xl border border-gray-100">
          최근 업로드 리스트가 숨겨져 있어요.
        </p>
      )}
    </section>
  )
}
