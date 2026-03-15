'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { createClient, formatFileSize } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Trash2, RotateCcw, FileText, Image, Video, Lock } from 'lucide-react'
import { toast } from 'sonner'

interface TrashFile {
  id: string
  name: string
  storage_path: string
  size_bytes: number
  mime_type: string
  created_at: string
  deleted_at: string | null
  file_type: 'file' | 'photo' | 'video' | null
  is_secure: boolean | null
}

function TrashRow({
  item,
  getTypeIcon,
  getTypeLabel,
  onRestore,
  onPermanentDelete,
}: {
  item: TrashFile
  getTypeIcon: (item: TrashFile) => ReactNode
  getTypeLabel: (item: TrashFile) => string
  onRestore: (id: string) => void
  onPermanentDelete: (item: TrashFile) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_80px_120px_120px_140px] gap-4 items-center px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
          {getTypeIcon(item)}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-800 truncate">{item.name}</p>
        </div>
      </div>
      <span className="text-xs text-gray-500 text-center">{getTypeLabel(item)}</span>
      <span className="text-xs text-gray-500 text-center">{formatFileSize(item.size_bytes)}</span>
      <span className="text-xs text-gray-500 text-center">
        {item.deleted_at ? formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true, locale: ko }) : '-'}
      </span>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onRestore(item.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
        >
          <RotateCcw className="w-3.5 h-3.5" /> 복원
        </button>
        <button
          type="button"
          onClick={() => onPermanentDelete(item)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashFile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const supabase = createClient()

  const secureItems = items.filter((f) => f.is_secure === true)
  const generalItems = items.filter((f) => !f.is_secure)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setLoading(true)
      setLoadFailed(false)
      const { data, error } = await supabase
        .from('files')
        .select('id, name, storage_path, size_bytes, mime_type, created_at, deleted_at, file_type, is_secure')
        .eq('owner_id', user.id)
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false })
      if (error) {
        if (error.message?.includes('column') || error.message?.includes('is_deleted')) {
          toast.info('휴지통 기능을 쓰려면 Supabase에서 add_deleted_flags.sql을 실행해주세요.')
        } else {
          toast.error('휴지통을 불러오지 못했어요')
        }
        setItems([])
        setLoadFailed(true)
      } else {
        setItems((data || []) as TrashFile[])
      }
      setLoading(false)
    })()
  }, [supabase])

  async function restoreFile(id: string) {
    const { error } = await supabase.from('files').update({ is_deleted: false, deleted_at: null }).eq('id', id)
    if (error) return toast.error('복원 실패')
    toast.success('복원했어요')
    setItems((prev) => prev.filter((f) => f.id !== id))
  }

  async function permanentlyDeleteFile(item: TrashFile) {
    if (!window.confirm('완전 삭제하면 다시 복구할 수 없어요. 정말 삭제할까요?')) return
    await supabase.storage.from('family-files').remove([item.storage_path])
    const { error } = await supabase.from('files').delete().eq('id', item.id)
    if (error) return toast.error('완전 삭제 실패')
    toast.success('영구 삭제되었어요')
    setItems((prev) => prev.filter((f) => f.id !== item.id))
  }

  function getTypeLabel(item: TrashFile) {
    if (item.file_type === 'photo') return '사진'
    if (item.file_type === 'video') return '영상'
    return '파일'
  }

  function getTypeIcon(item: TrashFile) {
    if (item.file_type === 'photo') return <Image className="w-4 h-4 text-blue-500" />
    if (item.file_type === 'video') return <Video className="w-4 h-4 text-purple-500" />
    return <FileText className="w-4 h-4 text-gray-500" />
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">휴지통</h1>
          <p className="text-sm text-gray-500 mt-0.5">삭제한 파일을 한동안 여기서 복원하거나 완전 삭제할 수 있어요</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <Trash2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">휴지통이 비어 있어요</p>
          <p className="text-xs text-gray-400 mt-1">
            {loadFailed ? '휴지통 기능을 사용하려면 Supabase에서 add_deleted_flags.sql을 실행해주세요.' : '보안 폴더와 일반 페이지에서 삭제한 파일이 각각 여기로 모여요'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 보안 폴더에서 삭제한 파일 */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Lock className="w-4 h-4 text-amber-500" />
              보안 폴더에서 삭제한 파일 ({secureItems.length}건)
            </h2>
            {secureItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-8 text-center">
                <p className="text-sm text-gray-400">보안 폴더에서 삭제한 파일이 없어요</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_120px_120px_140px] gap-4 px-4 py-2.5 border-b border-gray-100 text-xs font-medium text-gray-400">
                  <span>파일명</span>
                  <span className="text-center">구분</span>
                  <span className="text-center">크기</span>
                  <span className="text-center">삭제됨</span>
                  <span className="text-right">동작</span>
                </div>
                {secureItems.map((item) => (
                  <TrashRow key={item.id} item={item} getTypeIcon={getTypeIcon} getTypeLabel={getTypeLabel} onRestore={restoreFile} onPermanentDelete={permanentlyDeleteFile} />
                ))}
              </div>
            )}
          </section>

          {/* 일반에서 삭제한 파일 */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Trash2 className="w-4 h-4 text-gray-500" />
              일반에서 삭제한 파일 ({generalItems.length}건)
            </h2>
            {generalItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-8 text-center">
                <p className="text-sm text-gray-400">일반(사진·파일·영상)에서 삭제한 파일이 없어요</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_120px_120px_140px] gap-4 px-4 py-2.5 border-b border-gray-100 text-xs font-medium text-gray-400">
                  <span>파일명</span>
                  <span className="text-center">구분</span>
                  <span className="text-center">크기</span>
                  <span className="text-center">삭제됨</span>
                  <span className="text-right">동작</span>
                </div>
                {generalItems.map((item) => (
                  <TrashRow key={item.id} item={item} getTypeIcon={getTypeIcon} getTypeLabel={getTypeLabel} onRestore={restoreFile} onPermanentDelete={permanentlyDeleteFile} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

