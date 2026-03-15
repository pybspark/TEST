import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Image, Video, FileText } from 'lucide-react'
import AdminSubscriberList from './AdminSubscriberList'

// ⚠️ 여기에 본인 이메일 입력
const ADMIN_EMAIL = 'pybspark@gmail.com'

export default async function AdminPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  // 관리자 아닌 사람 접근 차단
  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  // 전체 유저 목록
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // 전체 파일
  const { data: allFiles } = await supabase
    .from('files')
    .select('*, profiles(name, email)')
    .order('created_at', { ascending: false })
    .limit(50)

  // 전체 메모
  const { data: allNotes } = await supabase
    .from('notes')
    .select('*, profiles(name, email)')
    .order('created_at', { ascending: false })
    .limit(20)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
          <span className="text-red-500 text-lg">👑</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">관리자 페이지</h1>
          <p className="text-sm text-gray-500">전체 가입자 및 업로드 현황</p>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{profiles?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">전체 가입자</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{allFiles?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">전체 파일</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{allNotes?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">전체 메모</p>
        </div>
      </div>

      {/* 가입자 목록 */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">가입자 목록</h2>
      <AdminSubscriberList
        profiles={profiles || []}
        allFiles={allFiles || []}
        allNotes={allNotes || []}
      />

      {/* 최근 업로드 전체 */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">최근 업로드 전체</h2>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-8">
        {allFiles?.map((file) => {
          const Icon = file.file_type === 'photo' ? Image : file.file_type === 'video' ? Video : FileText
          const iconBg = file.file_type === 'photo' ? 'bg-blue-50 text-brand-600' :
                         file.file_type === 'video' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'
          const isPhoto = file.file_type === 'photo'
          const url = `${supabaseUrl}/storage/v1/object/public/family-files/${file.storage_path}`
          return (
            <div key={file.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50">
              {isPhoto ? (
                <img src={url} alt={file.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{file.profiles?.name || file.profiles?.email}</p>
              </div>
              <p className="text-xs text-gray-400 flex-shrink-0">
                {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ko })}
              </p>
            </div>
          )
        })}
      </div>

      {/* 최근 메모 전체 */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">최근 메모 전체</h2>
      <div className="space-y-2">
        {allNotes?.map((note) => (
          <div key={note.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-800">{note.title || '제목 없음'}</p>
              <p className="text-xs text-gray-400">{note.profiles?.name}</p>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}