'use client'
import { useState, useEffect } from 'react'
import { createClient, getFileUrl } from '@/lib/supabase'
import UploadZone from '@/components/features/UploadZone'
import { Upload, X, Download, Trash2, Share2, ZoomIn } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

interface FileRecord {
  id: string
  name: string
  storage_path: string
  size_bytes: number
  created_at: string
  is_shared: boolean
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const supabase = createClient()

  async function fetchPhotos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('owner_id', user.id)
      .eq('file_type', 'photo')
      .order('created_at', { ascending: false })
    setPhotos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchPhotos() }, [])

  async function deletePhoto(id: string, path: string) {
    await supabase.storage.from('family-files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    toast.success('삭제되었습니다')
    setSelected(null)
    fetchPhotos()
  }

  async function toggleShare(id: string, current: boolean) {
    await supabase.from('files').update({ is_shared: !current }).eq('id', id)
    toast.success(current ? '공유 해제됨' : '가족과 공유됨')
    fetchPhotos()
  }

  const selectedPhoto = photos.find((p) => p.id === selected)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">사진</h1>
          <p className="text-sm text-gray-500 mt-0.5">{photos.length}장의 사진</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <Upload className="w-4 h-4" />
          사진 추가
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
          <UploadZone
            bucket="family-files"
            fileType="photo"
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'] }}
            onUploadComplete={() => { fetchPhotos(); setShowUpload(false) }}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Upload className="w-5 h-5 text-brand-600" />
          </div>
          <p className="text-sm text-gray-500">사진을 업로드해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {photos.map((photo) => {
            const url = getFileUrl('family-files', photo.storage_path)
            return (
              <div
                key={photo.id}
                onClick={() => setSelected(photo.id)}
                className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer relative group"
              >
                <img
                  src={url}
                  alt={photo.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {photo.is_shared && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center">
                    <Share2 className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 사진 상세 모달 */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex-1 min-h-0">
              <img
                src={getFileUrl('family-files', selectedPhoto.storage_path)}
                alt={selectedPhoto.name}
                className="w-full max-h-[60vh] object-contain bg-gray-50"
              />
            </div>
            <div className="p-4 border-t border-gray-100">
              <p className="font-medium text-gray-900 text-sm truncate mb-3">{selectedPhoto.name}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleShare(selectedPhoto.id, selectedPhoto.is_shared)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors ${
                    selectedPhoto.is_shared
                      ? 'bg-brand-50 text-brand-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {selectedPhoto.is_shared ? '공유 중' : '가족 공유'}
                </button>
                <a
                  href={getFileUrl('family-files', selectedPhoto.storage_path)}
                  download={selectedPhoto.name}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  다운로드
                </a>
                <button
                  onClick={() => deletePhoto(selectedPhoto.id, selectedPhoto.storage_path)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
