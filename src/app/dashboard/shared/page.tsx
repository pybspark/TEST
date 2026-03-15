'use client'

import { useState, useEffect } from 'react'
import { createClient, getFileUrl } from '@/lib/supabase'
import { useMyGroups } from '@/hooks/useMyGroups'
import Link from 'next/link'
import { Image, FileText, Video, StickyNote, Share2, Download, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface SharedFile {
  id: string
  name: string
  storage_path: string
  file_type: string
  created_at: string
  group_id: string | null
  profiles?: { name: string | null }
}

interface SharedNote {
  id: string
  title: string
  created_at: string
  group_id: string | null
  profiles?: { name: string | null }
}

export default function SharedPage() {
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([])
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<SharedFile | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<SharedFile | null>(null)
  const supabase = createClient()
  const { groups, loading: groupsLoading } = useMyGroups()

  useEffect(() => {
    async function fetchShared() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || groups.length === 0) {
        setLoading(false)
        return
      }
      const groupIds = groups.map((g) => g.id)
      const { data: files } = await supabase
        .from('files')
        .select('id, name, storage_path, file_type, created_at, group_id, profiles(name)')
        .eq('is_shared', true)
        .eq('is_deleted', false)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
      const { data: notes } = await supabase
        .from('notes')
        .select('id, title, created_at, group_id, profiles(name)')
        .eq('is_shared', true)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
      setSharedFiles((files || []) as unknown as SharedFile[])
      setSharedNotes((notes || []) as unknown as SharedNote[])
      setLoading(false)
    }
    if (!groupsLoading) fetchShared()
  }, [groupsLoading, groups.length])

  const photos = sharedFiles.filter((f) => f.file_type === 'photo')
  const videos = sharedFiles.filter((f) => f.file_type === 'video')
  const files = sharedFiles.filter((f) => f.file_type === 'file')

  if (groupsLoading || loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">공유 폴더</h1>
        <p className="text-sm text-gray-500 mb-6">그룹에 공유된 사진, 영상, 파일, 메모를 한곳에서 볼 수 있어요</p>
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Share2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">그룹에 속해 있지 않아요</p>
          <p className="text-sm text-gray-400 mt-1">초대 코드로 그룹에 가입하면 여기서 공유된 항목을 볼 수 있어요</p>
        </div>
      </div>
    )
  }

  const sections = [
    { label: '사진', icon: Image, items: photos, href: '/dashboard/photos', color: 'bg-blue-50 text-brand-600' },
    { label: '영상', icon: Video, items: videos, href: '/dashboard/videos', color: 'bg-purple-50 text-purple-600' },
    { label: '파일', icon: FileText, items: files, href: '/dashboard/files', color: 'bg-green-50 text-green-600' },
    { label: '메모', icon: StickyNote, items: sharedNotes, href: '/dashboard/notes', color: 'bg-amber-50 text-amber-600' },
  ]

  const totalCount = photos.length + videos.length + files.length + sharedNotes.length

  // 그룹별로 고정 색상 부여 (같은 그룹은 항상 같은 색)
  const GROUP_COLORS = [
    { bg: 'bg-blue-100', text: 'text-blue-800' },
    { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    { bg: 'bg-amber-100', text: 'text-amber-800' },
    { bg: 'bg-rose-100', text: 'text-rose-800' },
    { bg: 'bg-violet-100', text: 'text-violet-800' },
    { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  ]

  function getGroupName(groupId: string | null) {
    if (!groupId) return null
    return groups.find((g) => g.id === groupId)?.name || '그룹'
  }

  function getGroupColor(groupId: string | null) {
    if (!groupId) return GROUP_COLORS[0]
    const idx = groups.findIndex((g) => g.id === groupId)
    return GROUP_COLORS[idx % GROUP_COLORS.length]
  }

  function SharedByLabel({ item }: { item: { group_id: string | null; profiles?: { name: string | null } } }) {
    const groupName = getGroupName(item.group_id)
    const who = item.profiles?.name || '알 수 없음'
    const color = getGroupColor(item.group_id)
    if (!groupName) return null
    return (
      <span className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${color.bg} ${color.text}`}>
          {groupName}
        </span>
        <span className="text-gray-400">·</span>
        <span>{who}님이 공유함</span>
      </span>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">공유 폴더</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          그룹에 공유된 항목 {totalCount > 0 && `총 ${totalCount}개`}
        </p>
      </div>

      {totalCount === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Share2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">아직 공유된 항목이 없어요</p>
          <p className="text-sm text-gray-400 mt-1">사진, 파일, 메모에서 그룹 공유를 설정하면 여기에 모여요</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map(({ label, icon: Icon, items, href, color }) => (
            <section key={label}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">{label}</h2>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">공유된 {label}이 없어요</p>
              ) : label === '사진' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {photos.slice(0, 12).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPhoto(p)}
                      className="text-left group"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100 group-hover:border-brand-300 transition-all cursor-pointer">
                        <img
                          src={getFileUrl('family-files', p.storage_path)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        <SharedByLabel item={p} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : label === '영상' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {videos.slice(0, 9).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVideo(v)}
                      className="text-left bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all"
                    >
                      <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <Video className="w-10 h-10 text-white/60" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-gray-800 truncate">{v.name}</p>
                        <SharedByLabel item={v} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : label === '메모' ? (
                <ul className="space-y-1">
                  {(items as SharedNote[]).slice(0, 10).map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/dashboard/notes?noteId=${n.id}`}
                        className="block py-2 px-3 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-800 truncate text-sm">{n.title || '제목 없음'}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ko })}
                          </span>
                        </div>
                        <SharedByLabel item={n} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-1">
                  {(items as SharedFile[]).slice(0, 10).map((f) => (
                    <li key={f.id} className="py-2 px-3 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-800 truncate text-sm">{f.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}
                          </span>
                        </div>
                        <SharedByLabel item={f} />
                      </div>
                      <a
                        href={getFileUrl('family-files', f.storage_path)}
                        download={f.name}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg shrink-0"
                      >
                        <Download className="w-3 h-3" />
                        다운로드
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {/* 사진 상세 모달 (공유됨 전용: 다운로드·닫기만) */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-visible max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex-1 min-h-[40vh] flex items-center justify-center bg-gray-50 overflow-hidden">
              <img
                src={getFileUrl('family-files', selectedPhoto.storage_path)}
                alt=""
                className="max-w-full max-h-[70vh] w-auto h-auto object-contain"
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-brand-500" />
                <span className="font-medium text-brand-600">
                  {selectedPhoto.profiles?.name || '알 수 없음'}님이 공유함
                </span>
                {getGroupName(selectedPhoto.group_id) && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${getGroupColor(selectedPhoto.group_id).bg} ${getGroupColor(selectedPhoto.group_id).text}`}>
                      {getGroupName(selectedPhoto.group_id)}
                    </span>
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <a
                  href={getFileUrl('family-files', selectedPhoto.storage_path)}
                  download={`사진-${selectedPhoto.id.slice(0, 8)}.jpg`}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  다운로드
                </a>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 영상 상세 모달 (공유됨 전용: 다운로드·닫기만) */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-black rounded-2xl overflow-hidden max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={getFileUrl('family-files', selectedVideo.storage_path)}
              controls
              autoPlay
              className="w-full max-h-[70vh]"
            />
            <div className="bg-gray-900 p-4">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                <Share2 className="w-3 h-3 text-brand-400" />
                <span className="text-brand-300">{selectedVideo.profiles?.name || '알 수 없음'}님이 공유함</span>
                {getGroupName(selectedVideo.group_id) && (
                  <>
                    <span className="text-gray-500">·</span>
                    <span className={getGroupColor(selectedVideo.group_id).text}>{getGroupName(selectedVideo.group_id)}</span>
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <a
                  href={getFileUrl('family-files', selectedVideo.storage_path)}
                  download={selectedVideo.name}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-700 text-gray-200 rounded-xl text-sm font-medium hover:bg-gray-600 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  다운로드
                </a>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="flex items-center justify-center p-2 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-colors"
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
