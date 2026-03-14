'use client'
import { useState, useEffect } from 'react'
import { createClient, getFileUrl, formatFileSize } from '@/lib/supabase'
import UploadZone from '@/components/features/UploadZone'
import { Upload, Video, Play, X, Trash2, Share2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'

interface FileRecord {
  id: string
  name: string
  storage_path: string
  size_bytes: number
  created_at: string
  is_shared: boolean
}

export default function VideosPage() {
  const [videos, setVideos] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const supabase = createClient()

  async function fetchVideos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('owner_id', user.id)
      .eq('file_type', 'video')
      .order('created_at', { ascending: false })
    setVideos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchVideos() }, [])

  async function deleteVideo(id: string, path: string) {
    await supabase.storage.from('family-files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    toast.success('삭제되었습니다')
    setPlaying(null)
    fetchVideos()
  }

  async function toggleShare(id: string, current: boolean) {
    await supabase.from('files').update({ is_shared: !current }).eq('id', id)
    toast.success(current ? '공유 해제됨' : '가족과 공유됨')
    fetchVideos()
  }

  const playingVideo = videos.find((v) => v.id === playing)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">영상</h1>
          <p className="text-sm text-gray-500 mt-0.5">{videos.length}개의 영상</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <Upload className="w-4 h-4" />
          영상 추가
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
          <UploadZone
            bucket="family-files"
            fileType="video"
            accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] }}
            onUploadComplete={() => { fetchVideos(); setShowUpload(false) }}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-video bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <Video className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">영상을 업로드해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => setPlaying(video.id)}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:border-gray-200 hover:shadow-sm transition-all group"
            >
              {/* 썸네일 플레이스홀더 */}
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <Play className="w-5 h-5 text-white ml-0.5" />
                </div>
                {video.is_shared && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center">
                    <Share2 className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-800 truncate">{video.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">{formatFileSize(video.size_bytes)}</span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(video.created_at), { addSuffix: true, locale: ko })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 영상 플레이어 모달 */}
      {playingVideo && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="bg-black rounded-2xl overflow-hidden max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={getFileUrl('family-files', playingVideo.storage_path)}
              controls
              autoPlay
              className="w-full max-h-[70vh]"
            />
            <div className="bg-gray-900 p-4 flex items-center justify-between">
              <p className="text-sm font-medium text-white truncate flex-1">{playingVideo.name}</p>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => toggleShare(playingVideo.id, playingVideo.is_shared)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    playingVideo.is_shared ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Share2 className="w-3 h-3" />
                  {playingVideo.is_shared ? '공유 중' : '가족 공유'}
                </button>
                <button
                  onClick={() => deleteVideo(playingVideo.id, playingVideo.storage_path)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 text-red-400 rounded-lg text-xs font-medium hover:bg-red-900 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  삭제
                </button>
                <button
                  onClick={() => setPlaying(null)}
                  className="p-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
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
