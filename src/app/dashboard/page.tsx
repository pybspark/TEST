import { createServerSupabase } from '@/lib/supabase-server'
import { Image, FileText, Video, StickyNote, Upload } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: recentFiles } = await supabase
    .from('files')
    .select('*')
    .eq('owner_id', user!.id)
    .or('is_secure.eq.false,is_secure.is.null')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(18)

  const photos = recentFiles?.filter((f) => f.file_type === 'photo') || []
  const videos = recentFiles?.filter((f) => f.file_type === 'video') || []
  const files  = recentFiles?.filter((f) => f.file_type === 'file') || []
  const { count: noteCount, data: recentNotes } = await supabase
    .from('notes')
    .select('id, title, updated_at', { count: 'exact' })
    .eq('owner_id', user!.id)
    .or('is_secure.eq.false,is_secure.is.null')
    .order('updated_at', { ascending: false })
    .limit(5)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  function getPublicUrl(path: string) {
    return `${supabaseUrl}/storage/v1/object/public/family-files/${path}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">
      <div className="px-4 pt-6 pb-10 max-w-5xl mx-auto space-y-6">
        {/* 상단 요약/사진 영역 */}
        <div className="grid gap-4 md:grid-cols-3 md:auto-rows-[minmax(0,1fr)]">
          {/* 요약 카드 */}
          <div className="md:col-span-1 rounded-2xl bg-white/80 backdrop-blur border border-white/70 shadow-[0_18px_45px_rgba(15,23,42,0.06)] p-4 flex flex-col justify-between">
            <div className="mb-3">
              <p className="text-[11px] font-medium text-brand-600 mb-1 tracking-wide uppercase">
                BIN CLOUD · Dashboard
              </p>
              <p className="text-sm text-gray-500">모든 파일을 한 눈에 확인하세요.</p>
            </div>
            <div className="mt-1 space-y-1.5 text-xs text-gray-600">
              <p className="flex items-center justify-between">
                <span>사진</span>
                <span className="font-medium text-gray-800">{photos.length}장</span>
              </p>
              <p className="flex items-center justify-between">
                <span>영상</span>
                <span className="font-medium text-gray-800">{videos.length}개</span>
              </p>
              <p className="flex items-center justify-between">
                <span>파일</span>
                <span className="font-medium text-gray-800">{files.length}개</span>
              </p>
              <p className="flex items-center justify-between">
                <span>메모</span>
                <span className="font-medium text-gray-800">{noteCount || 0}개</span>
              </p>
            </div>
            <div className="mt-4 flex">
              <Link
                href="/dashboard/files?upload=1"
                className="inline-flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-medium shadow-sm hover:bg-gray-800 transition-colors"
              >
                <Upload className="w-4 h-4" />
                새 파일 업로드
              </Link>
            </div>
          </div>

          {/* 사진 카드 - 최근 사진 썸네일 4개 (가로 배열) */}
          <Link
            href="/dashboard/photos"
            className="relative overflow-hidden rounded-2xl bg-white/85 backdrop-blur border border-white/70 shadow-[0_14px_40px_rgba(15,23,42,0.06)] p-4 flex flex-col gap-3 group md:col-span-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-600 flex items-center justify-center shadow-sm">
                  <Image className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">사진</p>
                  <p className="text-[11px] text-gray-500">{photos.length}장의 사진</p>
                </div>
              </div>
            </div>
            <div className="mt-1">
              {photos.length === 0 ? (
                <div className="h-24 rounded-2xl bg-blue-50 flex items-center justify-center text-[11px] text-blue-700">
                  아직 사진이 없어요
                </div>
              ) : (
                <div className="flex gap-2">
                  {photos.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="flex-1 rounded-2xl overflow-hidden bg-blue-50 aspect-square"
                    >
                      <img
                        src={getPublicUrl(p.storage_path)}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  {photos.length < 4 &&
                    Array.from({ length: 4 - photos.length }).map((_, idx) => (
                      <div
                        key={`empty-${idx}`}
                        className="flex-1 rounded-2xl bg-blue-50/60 aspect-square"
                      />
                    ))}
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* 두 번째 줄: 파일 카드 단독 배치 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/dashboard/files"
            className="relative overflow-hidden rounded-2xl bg-white/85 backdrop-blur border border-white/70 shadow-[0_14px_40px_rgba(15,23,42,0.06)] p-4 flex flex-col justify-between group md:col-span-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shadow-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">파일</p>
                  <p className="text-[11px] text-gray-500">{files.length}개의 문서</p>
                </div>
              </div>
            </div>
            <div className="h-24 rounded-xl bg-white/70 px-3 py-2 overflow-y-auto border border-gray-100">
              {files.length === 0 ? (
                <p className="text-[11px] text-gray-600 mt-1">아직 문서가 없어요</p>
              ) : (
                <ul className="space-y-1.5 pr-1">
                  {files.slice(0, 4).map((f) => {
                    const ext = (f.name.split('.').pop() || '').toLowerCase()
                    const isPdf = ext === 'pdf'
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)
                    const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)

                    const iconBg =
                      isPdf ? 'bg-red-50 text-red-600' :
                      isVideo ? 'bg-purple-50 text-purple-600' :
                      isImage ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-100 text-gray-700'

                    const typeLabel = ext ? ext.toUpperCase() : 'FILE'

                    const Icon =
                      isImage ? Image :
                      isVideo ? Video :
                      FileText

                    return (
                      <li key={f.id} className="flex items-center gap-2 text-[11px] text-gray-900">
                        <div className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center text-[10px] flex-shrink-0 ${iconBg}`}>
                          <Icon className="w-3.5 h-3.5 mb-0.5" />
                          <span className="leading-none">{typeLabel}</span>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <span className="truncate">{f.name}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Link>
        </div>

        <h2 className="text-sm font-semibold text-gray-800">최근 업로드</h2>
      {(!recentFiles || recentFiles.length === 0) ? (
        <div className="bg-white/80 backdrop-blur rounded-2xl border border-dashed border-gray-200 p-10 text-center shadow-sm">
          <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">아직 업로드된 파일이 없어요</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {recentFiles.map((file) => {
            const isPhoto = file.file_type === 'photo'
            const isVideo = file.file_type === 'video'
            const url = getPublicUrl(file.storage_path)
            const href = `/dashboard/${isPhoto ? 'photos' : isVideo ? 'videos' : 'files'}`
            return (
              <Link
                key={file.id}
                href={href}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 hover:border-brand-200 hover:shadow-md transition-all"
              >
                {isPhoto ? (
                  <img src={url} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : isVideo ? (
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white/70" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-green-50 flex flex-col items-center justify-center gap-1">
                    <FileText className="w-6 h-6 text-green-600" />
                    <span className="text-xs font-medium text-green-600">{file.name.split('.').pop()?.toUpperCase()}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-white text-xs truncate">{file.name}</p>
                  <p className="text-white/70 text-[11px]">
                    {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ko })}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}