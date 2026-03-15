'use client'
import { useState, useEffect } from 'react'
import { createClient, getFileUrl, formatFileSize } from '@/lib/supabase'
import UploadZone from '@/components/features/UploadZone'
import { Upload, Video, Play, X, Trash2, Share2, Pencil } from 'lucide-react'
import { useMyGroups } from '@/hooks/useMyGroups'
import ShareGroupDropdown from '@/components/ui/ShareGroupDropdown'
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
  group_id: string | null
  profiles?: { name: string | null }
}

export default function VideosPage() {
  const [videos, setVideos] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const supabase = createClient()
  const { groups } = useMyGroups()

  async function fetchVideos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('files')
      .select('*, profiles(name)')
      .eq('owner_id', user.id)
      .eq('file_type', 'video')
      .or('is_secure.eq.false,is_secure.is.null')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
    setVideos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchVideos() }, [])

  async function deleteVideo(id: string, path: string) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('files').update({ is_deleted: true, deleted_at: now }).eq('id', id)
    if (error) {
      if (error.message?.includes('column') || error.message?.includes('is_deleted') || error.message?.includes('deleted_at')) {
        await supabase.storage.from('family-files').remove([path])
        const { error: delErr } = await supabase.from('files').delete().eq('id', id)
        if (delErr) return toast.error('삭제에 실패했어요')
        toast.success('삭제되었습니다')
        setPlaying(null)
        fetchVideos()
        return
      }
      return toast.error('삭제에 실패했어요')
    }
    toast.success('휴지통으로 이동했어요')
    setPlaying(null)
    fetchVideos()
  }

  async function setShareGroup(id: string, groupId: string | null) {
    await supabase.from('files').update({ is_shared: !!groupId, group_id: groupId }).eq('id', id)
    toast.success(groupId ? '해당 그룹에 공유됨' : '공유 해제됨')
    fetchVideos()
  }

  async function renameVideo(id: string, newName: string) {
    const { error } = await supabase.from('files').update({ name: newName }).eq('id', id)
    if (error) return toast.error('이름 변경 실패')
    toast.success('이름이 변경되었습니다')
    setEditingName(false)
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
            className="bg-black rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={getFileUrl('family-files', playingVideo.storage_path)}
              controls
              autoPlay
              className="w-full max-h-[70vh]"
            />
            <div className="bg-gray-900 p-4 flex flex-col gap-2 overflow-y-auto">
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Share2 className={`w-3 h-3 flex-shrink-0 ${playingVideo.is_shared ? 'text-brand-400' : 'text-gray-500'}`} />
                {playingVideo.is_shared && playingVideo.group_id ? (
                  <span className="text-brand-300">{groups.find((g) => g.id === playingVideo.group_id)?.name || '그룹'}에 공유됨</span>
                ) : (
                  <span className="text-gray-500">공유 안 함</span>
                )}
              </p>
              <div className="flex items-center justify-between flex-wrap gap-2">
                {editingName ? (
                  <div className="flex gap-1 flex-1 min-w-0">
                    <input type="text" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && renameVideo(playingVideo.id, editNameValue.trim())} className="flex-1 px-3 py-1.5 border border-gray-600 bg-gray-800 text-white rounded-lg text-sm min-w-0" autoFocus />
                    <button type="button" onClick={() => renameVideo(playingVideo.id, editNameValue.trim())} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm shrink-0">저장</button>
                    <button type="button" onClick={() => { setEditingName(false); setEditNameValue(playingVideo.name) }} className="px-3 py-1.5 text-gray-400 rounded-lg text-sm shrink-0">취소</button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white truncate flex-1 min-w-0">{playingVideo.name}</p>
                    <button type="button" onClick={() => { setEditNameValue(playingVideo.name); setEditingName(true) }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700" title="이름 변경"><Pencil className="w-4 h-4" /></button>
                  </>
                )}
                <div className="flex gap-2 ml-4">
                <ShareGroupDropdown
                  isShared={playingVideo.is_shared}
                  sharedGroupId={playingVideo.group_id}
                  groupName={playingVideo.group_id ? groups.find((g) => g.id === playingVideo.group_id)?.name : null}
                  groups={groups}
                  onSelect={(groupId) => setShareGroup(playingVideo.id, groupId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    playingVideo.is_shared ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                />
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
        </div>
      )}
    </div>
  )
}
