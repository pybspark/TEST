'use client'
import { useState, useEffect } from 'react'
import { createClient, getFileUrl, formatFileSize } from '@/lib/supabase'
import UploadZone from '@/components/features/UploadZone'
import { Upload, FileText, Trash2, Download, Share2, Search } from 'lucide-react'
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
  mime_type: string
  created_at: string
  is_shared: boolean
  group_id: string | null
}

function getFileIcon(mime: string) {
  if (mime?.includes('pdf')) return '📄'
  if (mime?.includes('word') || mime?.includes('document')) return '📝'
  if (mime?.includes('sheet') || mime?.includes('excel')) return '📊'
  if (mime?.includes('zip') || mime?.includes('rar')) return '🗜️'
  return '📁'
}

function getIconBg(mime: string) {
  if (mime?.includes('pdf')) return 'bg-red-50 text-red-500'
  if (mime?.includes('word')) return 'bg-blue-50 text-brand-600'
  if (mime?.includes('sheet') || mime?.includes('excel')) return 'bg-green-50 text-green-600'
  return 'bg-gray-50 text-gray-500'
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [query, setQuery] = useState('')
  const supabase = createClient()
  const { groups } = useMyGroups()

  async function fetchFiles() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('owner_id', user.id)
      .eq('file_type', 'file')
      .order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchFiles() }, [])

  async function deleteFile(id: string, path: string) {
    await supabase.storage.from('family-files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    toast.success('삭제되었습니다')
    fetchFiles()
  }

  async function setShareGroup(id: string, groupId: string | null) {
    await supabase.from('files').update({ is_shared: !!groupId, group_id: groupId }).eq('id', id)
    toast.success(groupId ? '해당 그룹에 공유됨' : '공유 해제됨')
    fetchFiles()
  }

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">파일</h1>
          <p className="text-sm text-gray-500 mt-0.5">{files.length}개의 파일</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <Upload className="w-4 h-4" />
          파일 추가
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
          <UploadZone
            bucket="family-files"
            fileType="file"
            onUploadComplete={() => { fetchFiles(); setShowUpload(false) }}
          />
        </div>
      )}

      {/* 검색 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="파일 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{query ? '검색 결과가 없어요' : '파일을 업로드해보세요'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* 헤더 */}
          <div className="grid grid-cols-[1fr_80px_100px_80px] gap-4 px-4 py-2.5 border-b border-gray-100 text-xs font-medium text-gray-400">
            <span>파일명</span>
            <span>크기</span>
            <span>날짜</span>
            <span className="text-right">액션</span>
          </div>
          {filtered.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-[1fr_80px_100px_80px] gap-4 items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors file-row"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${getIconBg(file.mime_type)}`}>
                  {getFileIcon(file.mime_type)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{file.name}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">{formatFileSize(file.size_bytes)}</span>
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ko })}
              </span>
              <div className="flex items-center justify-end gap-1">
                <ShareGroupDropdown
                  isShared={file.is_shared}
                  sharedGroupId={file.group_id}
                  groupName={file.group_id ? groups.find((g) => g.id === file.group_id)?.name : null}
                  groups={groups}
                  onSelect={(groupId) => setShareGroup(file.id, groupId)}
                  className={`p-1.5 rounded-lg transition-colors ${file.is_shared ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}
                />
                <a
                  href={getFileUrl('family-files', file.storage_path)}
                  download={file.name}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => deleteFile(file.id, file.storage_path)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
