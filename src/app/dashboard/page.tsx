import { createServerSupabase } from '@/lib/supabase-server'
import { Image, FileText, Video, StickyNote, Upload } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  // 최근 파일 5개
  const { data: recentFiles } = await supabase
    .from('files')
    .select('*')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(8)

  // 타입별 개수
  const photos = recentFiles?.filter((f) => f.file_type === 'photo') || []
  const videos = recentFiles?.filter((f) => f.file_type === 'video') || []
  const files  = recentFiles?.filter((f) => f.file_type === 'file') || []

  // 메모 개수
  const { count: noteCount } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user!.id)

  const stats = [
    { label: '사진', count: photos.length, icon: Image, href: '/dashboard/photos', color: 'bg-blue-50 text-brand-600' },
    { label: '영상', count: videos.length, icon: Video, href: '/dashboard/videos', color: 'bg-purple-50 text-purple-600' },
    { label: '파일', count: files.length, icon: FileText, href: '/dashboard/files', color: 'bg-green-50 text-green-600' },
    { label: '메모', count: noteCount || 0, icon: StickyNote, href: '/dashboard/notes', color: 'bg-yellow-50 text-yellow-600' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">내 클라우드</h1>
          <p className="text-sm text-gray-500 mt-0.5">모든 파일을 한 눈에 확인하세요</p>
        </div>
        <Link
          href="/dashboard/photos"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <Upload className="w-4 h-4" />
          업로드
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map(({ label, count, icon: Icon, href, color }) => (
          <Link
            key={label}
            href={href}
            className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all"
          >
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* 최근 항목 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">최근 업로드</h2>
        {(!recentFiles || recentFiles.length === 0) ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">아직 업로드된 파일이 없어요</p>
            <p className="text-xs text-gray-300 mt-1">사진, 파일, 영상을 업로드해보세요</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentFiles.map((file) => {
              const Icon = file.file_type === 'photo' ? Image : file.file_type === 'video' ? Video : FileText
              const iconBg = file.file_type === 'photo' ? 'bg-blue-50 text-brand-600' :
                             file.file_type === 'video' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'
              return (
                <div key={file.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-gray-200 transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{file.name}</p>
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">
                    {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ko })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}