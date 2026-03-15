import { createServerSupabase } from '@/lib/supabase-server'
import { Image, FileText, Video, StickyNote, Upload } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: recentFiles } = await supabase
    .from('files').select('*')
    .eq('owner_id', user!.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(12)

  const photos = recentFiles?.filter((f) => f.file_type === 'photo') || []
  const videos = recentFiles?.filter((f) => f.file_type === 'video') || []
  const files  = recentFiles?.filter((f) => f.file_type === 'file') || []
  const { count: noteCount } = await supabase
    .from('notes').select('*', { count: 'exact', head: true })
    .eq('owner_id', user!.id)

  const stats = [
    { label: '사진', count: photos.length, icon: Image, href: '/dashboard/photos', color: 'bg-blue-50 text-brand-600' },
    { label: '영상', count: videos.length, icon: Video, href: '/dashboard/videos', color: 'bg-purple-50 text-purple-600' },
    { label: '파일', count: files.length, icon: FileText, href: '/dashboard/files', color: 'bg-green-50 text-green-600' },
    { label: '메모', count: noteCount || 0, icon: StickyNote, href: '/dashboard/notes', color: 'bg-yellow-50 text-yellow-600' },
  ]

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  function getPublicUrl(path: string) {
    return `${supabaseUrl}/storage/v1/object/public/family-files/${path}`
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">내 클라우드</h1>
          <p className="text-sm text-gray-500 mt-0.5">모든 파일을 한 눈에 확인하세요</p>
        </div>
        <Link href="/dashboard/photos" className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors">
          <Upload className="w-4 h-4" />업로드
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map(({ label, count, icon: Icon, href, color }) => (
          <Link key={label} href={href} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all">
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>
      <h2 className="text-sm font-semibold text-gray-700 mb-3">최근 업로드</h2>
      {(!recentFiles || recentFiles.length === 0) ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">아직 업로드된 파일이 없어요</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {recentFiles.map((file) => {
            const isPhoto = file.file_type === 'photo'
            const isVideo = file.file_type === 'video'
            const url = getPublicUrl(file.storage_path)
            const href = `/dashboard/${isPhoto ? 'photos' : isVideo ? 'videos' : 'files'}`
            return (
              <Link key={file.id} href={href} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100 hover:border-gray-300 transition-all">
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
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                  <p className="text-white text-xs truncate">{file.name}</p>
                  <p className="text-white/70 text-xs">{formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ko })}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}