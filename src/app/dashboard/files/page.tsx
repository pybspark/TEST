'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient, getFileUrl, formatFileSize } from '@/lib/supabase'
import UploadZone from '@/components/features/UploadZone'
import { Upload, FileText, Trash2, Download, Share2, Search, Pencil, FolderPlus, FolderOpen, ChevronRight } from 'lucide-react'
import { useMyGroups } from '@/hooks/useMyGroups'
import ShareGroupDropdown from '@/components/ui/ShareGroupDropdown'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'

interface FileFolder {
  id: string
  name: string
  created_at: string
}

interface FileRecord {
  id: string
  name: string
  storage_path: string
  size_bytes: number
  mime_type: string
  created_at: string
  is_shared: boolean
  group_id: string | null
  file_folder_id?: string | null
  profiles?: { name: string | null }
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
  const [fileFolders, setFileFolders] = useState<FileFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [query, setQuery] = useState('')
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const supabase = createClient()
  const { groups } = useMyGroups()

  const fetchFiles = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setLoading(true)
    const selectCols = 'id, name, storage_path, size_bytes, mime_type, created_at, is_shared, group_id, file_folder_id, profiles(name)'
    const { data, error } = await supabase
      .from('files')
      .select(selectCols)
      .eq('owner_id', user.id)
      .eq('file_type', 'file')
      .or('is_secure.eq.false,is_secure.is.null')
      .order('created_at', { ascending: false })
    if (error && (error.message?.includes('file_folder_id') || error.message?.includes('column'))) {
      const { data: dataWithoutFolder } = await supabase
        .from('files')
        .select('id, name, storage_path, size_bytes, mime_type, created_at, is_shared, group_id, profiles(name)')
        .eq('owner_id', user.id)
        .eq('file_type', 'file')
        .or('is_secure.eq.false,is_secure.is.null')
        .order('created_at', { ascending: false })
      setFiles(
        (dataWithoutFolder || []).map((f: Record<string, unknown>): FileRecord => ({
          id: f.id as string,
          name: f.name as string,
          storage_path: f.storage_path as string,
          size_bytes: f.size_bytes as number,
          mime_type: f.mime_type as string,
          created_at: f.created_at as string,
          is_shared: f.is_shared as boolean,
          group_id: f.group_id as string | null,
          file_folder_id: null,
          profiles: Array.isArray(f.profiles) ? (f.profiles[0] as { name: string | null }) : (f.profiles as { name: string | null } | undefined),
        })
      ))
      if (error.message?.includes('file_folder_id')) toast.info('파일 폴더 기능을 쓰려면 Supabase에서 add_file_folders.sql을 실행해주세요.')
    } else if (error) {
      setFiles([])
    } else {
      setFiles(
        (data || []).map((f: Record<string, unknown>): FileRecord => ({
          id: f.id as string,
          name: f.name as string,
          storage_path: f.storage_path as string,
          size_bytes: f.size_bytes as number,
          mime_type: f.mime_type as string,
          created_at: f.created_at as string,
          is_shared: f.is_shared as boolean,
          group_id: f.group_id as string | null,
          file_folder_id: (f.file_folder_id as string | null) ?? null,
          profiles: Array.isArray(f.profiles) ? (f.profiles[0] as { name: string | null }) ?? { name: null } : (f.profiles as { name: string | null } | undefined) ?? { name: null },
        }))
      )
    }
    setLoading(false)
  }, [supabase])

  const fetchFileFolders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('file_folders')
      .select('id, name, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
    setFileFolders(data || [])
  }, [supabase])

  useEffect(() => {
    fetchFiles()
    fetchFileFolders()
  }, [fetchFiles, fetchFileFolders])

  async function moveFileToFolder(fileId: string, folderId: string | null) {
    const { error } = await supabase.from('files').update({ file_folder_id: folderId }).eq('id', fileId)
    if (error) return toast.error('이동 실패')
    toast.success('이동했어요')
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, file_folder_id: folderId } : f)))
  }

  async function createFileFolder() {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('file_folders').insert({ owner_id: user.id, name: trimmed })
    if (error) return toast.error('폴더를 만들지 못했어요')
    toast.success('폴더가 만들어졌어요')
    setNewFolderName('')
    setShowNewFolder(false)
    fetchFileFolders()
  }

  async function renameFileFolder(folderId: string, newName: string) {
    const { error } = await supabase.from('file_folders').update({ name: newName }).eq('id', folderId)
    if (error) return toast.error('이름 변경 실패')
    toast.success('이름이 변경되었어요')
    setEditingFolderId(null)
    fetchFileFolders()
  }

  async function deleteFileFolder(folderId: string) {
    const res = await fetch('/api/files/delete-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data?.error || '폴더를 삭제하지 못했어요')
      return
    }
    toast.success('폴더를 삭제했어요. 안의 파일은 폴더 없음으로 옮겨졌어요')
    if (selectedFolderId === folderId) setSelectedFolderId(null)
    setFiles((prev) => prev.map((f) => (f.file_folder_id === folderId ? { ...f, file_folder_id: null } : f)))
    fetchFileFolders()
  }

  async function deleteFile(id: string, path: string) {
    await supabase.storage.from('family-files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    toast.success('삭제되었습니다')
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  async function setShareGroup(id: string, groupId: string | null) {
    await supabase.from('files').update({ is_shared: !!groupId, group_id: groupId }).eq('id', id)
    toast.success(groupId ? '해당 그룹에 공유됨' : '공유 해제됨')
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, is_shared: !!groupId, group_id: groupId } : f)))
  }

  async function renameFile(id: string, newName: string) {
    const { error } = await supabase.from('files').update({ name: newName }).eq('id', id)
    if (error) return toast.error('이름 변경 실패')
    toast.success('이름이 변경되었습니다')
    setEditingFileId(null)
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)))
  }

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  )
  const displayFiles = selectedFolderId
    ? filtered.filter((f) => (f.file_folder_id ?? null) === selectedFolderId)
    : filtered

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
            fileFolderId={selectedFolderId}
            onUploadComplete={() => { fetchFiles(); setShowUpload(false) }}
          />
        </div>
      )}

      {/* 폴더 영역 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        {selectedFolderId ? (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button type="button" onClick={() => setSelectedFolderId(null)} className="text-gray-500 hover:text-gray-800 flex items-center gap-1">
              <ChevronRight className="w-4 h-4 rotate-180 text-gray-400" />
              전체
            </button>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-800">{fileFolders.find((f) => f.id === selectedFolderId)?.name}</span>
            <button onClick={() => selectedFolderId && deleteFileFolder(selectedFolderId)} className="text-red-500 hover:text-red-600 text-xs ml-2">폴더 삭제</button>
          </div>
        ) : (
          <span className="text-sm text-gray-500">폴더를 만들고 파일을 분류해 보관하세요</span>
        )}
        <div className="flex gap-2">
          {!selectedFolderId && (
            <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              <FolderPlus className="w-4 h-4" /> 새 폴더
            </button>
          )}
        </div>
      </div>

      {showNewFolder && (
        <div className="mb-4 p-4 bg-white border border-gray-100 rounded-2xl flex gap-2">
          <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="폴더 이름 (예: 계약서, 업무, 참고자료)" className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm" onKeyDown={(e) => e.key === 'Enter' && createFileFolder()} />
          <button onClick={createFileFolder} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium">만들기</button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm">취소</button>
        </div>
      )}

      {!selectedFolderId && fileFolders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">폴더</h3>
          <div className="grid gap-3 min-w-0" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))' }}>
            {fileFolders.map((folder) => {
              const count = files.filter((f) => f.file_folder_id === folder.id).length
              return (
                <div
                  key={folder.id}
                  className="flex items-center gap-3 p-4 rounded-2xl border-2 border-gray-100 bg-white hover:shadow-md transition-all group min-w-0 w-full overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"><FolderOpen className="w-6 h-6 text-amber-600" /></div>
                    <div className="min-w-0 flex-1">
                      {editingFolderId === folder.id ? (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <input type="text" value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { renameFileFolder(folder.id, editingFolderName.trim()); setEditingFolderId(null) } if (e.key === 'Escape') setEditingFolderId(null) }} className="flex-1 px-2 py-0.5 border border-gray-200 rounded text-sm min-w-0" autoFocus />
                          <button type="button" onClick={() => { renameFileFolder(folder.id, editingFolderName.trim()); setEditingFolderId(null) }} className="text-xs text-brand-600 font-medium">저장</button>
                          <button type="button" onClick={() => setEditingFolderId(null)} className="text-xs text-gray-500">취소</button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-gray-800 whitespace-nowrap truncate" title={folder.name}>{folder.name}</p>
                          <p className="text-xs text-gray-400 whitespace-nowrap">{count}개 파일</p>
                        </>
                      )}
                    </div>
                  </button>
                  {editingFolderId !== folder.id && (
                    <button onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100" title="이름 변경"><Pencil className="w-4 h-4" /></button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); deleteFileFolder(folder.id) }} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>
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
      ) : displayFiles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{query ? '검색 결과가 없어요' : selectedFolderId ? '이 폴더에 파일이 없어요' : '파일을 업로드해보세요'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* 헤더 */}
          <div className="grid grid-cols-[1fr_70px_88px_140px] gap-4 px-4 py-2.5 border-b border-gray-100 text-xs font-medium text-gray-400">
            <span>파일명</span>
            <span className="text-left">크기</span>
            <span className="text-left">날짜</span>
            <span className="text-right">폴더 / 액션</span>
          </div>
          {displayFiles.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-[1fr_70px_88px_140px] gap-4 items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors file-row"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${getIconBg(file.mime_type)}`}>
                  {getFileIcon(file.mime_type)}
                </div>
                <div className="min-w-0">
                  {editingFileId === file.id ? (
                    <div className="flex gap-1 items-center">
                      <input type="text" value={editingFileName} onChange={(e) => setEditingFileName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') renameFile(file.id, editingFileName.trim()); if (e.key === 'Escape') setEditingFileId(null) }} className="flex-1 px-2 py-0.5 border border-gray-200 rounded text-sm min-w-0" autoFocus />
                      <button type="button" onClick={() => renameFile(file.id, editingFileName.trim())} className="text-xs text-brand-600 font-medium shrink-0">저장</button>
                      <button type="button" onClick={() => setEditingFileId(null)} className="text-xs text-gray-500 shrink-0">취소</button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800 truncate">{file.name}</p>
                  )}
                  <p className={`text-xs flex items-center gap-1 mt-0.5 ${file.is_shared ? 'text-brand-600' : 'text-gray-400'}`}>
                    <Share2 className="w-3 h-3 flex-shrink-0" />
                    {file.is_shared && file.group_id
                      ? `${groups.find((g) => g.id === file.group_id)?.name || '그룹'}에 공유됨`
                      : '공유 안 함'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-400 text-left">{formatFileSize(file.size_bytes)}</span>
              <span className="text-xs text-gray-400 text-left">
                {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ko })}
              </span>
              <div className="flex items-center justify-end gap-1">
                <select
                  className="text-xs rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-600"
                  value={file.file_folder_id ?? ''}
                  onChange={(e) => moveFileToFolder(file.id, e.target.value || null)}
                  title="폴더로 이동"
                >
                  <option value="">폴더 없음</option>
                  {fileFolders.map((fd) => <option key={fd.id} value={fd.id}>{fd.name}</option>)}
                </select>
                {editingFileId !== file.id && (
                  <button onClick={() => { setEditingFileId(file.id); setEditingFileName(file.name) }} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="이름 변경">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
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
