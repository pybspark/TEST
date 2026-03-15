'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, LockOpen, Shield, FolderLock, Upload, FileText, StickyNote, Trash2, Download, Plus, Pin, X, Save, Image, Video, FolderPlus, FolderOpen, ChevronRight } from 'lucide-react'
import { createClient, getFileUrl, formatFileSize } from '@/lib/supabase'
import UploadZone from '@/components/features/UploadZone'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'

const SECURE_UNLOCK_KEY = 'secureFolderUnlocked'

const NOTE_COLORS: Record<string, { bg: string; border: string }> = {
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200' },
  green: { bg: 'bg-green-50', border: 'border-green-200' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200' },
}

interface SecureFile {
  id: string
  name: string
  storage_path: string
  size_bytes: number
  mime_type: string
  created_at: string
  file_type?: string
  folder_id?: string | null
}

interface SecureFolder {
  id: string
  name: string
  created_at: string
}

interface SecureNote {
  id: string
  title: string
  content: string
  color: string
  pinned: boolean
  updated_at: string
}

export default function SecureFolderPage() {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'files' | 'photos' | 'videos' | 'notes'>('files')
  const [secureFiles, setSecureFiles] = useState<SecureFile[]>([])
  const [secureNotes, setSecureNotes] = useState<SecureNote[]>([])
  const [secureFolders, setSecureFolders] = useState<SecureFolder[]>([])
  const [selectedFileFolderId, setSelectedFileFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [editingNote, setEditingNote] = useState<SecureNote | null>(null)
  const [isNewNote, setIsNewNote] = useState(false)
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const supabase = createClient()

  const DRAG_FILE_KEY = 'application/x-secure-file-id'

  useEffect(() => {
    fetch('/api/secure/status')
      .then((r) => r.ok ? r.json() : { hasPin: false })
      .then((data) => setHasPin(Boolean(data?.hasPin)))
      .catch(() => setHasPin(false))
  }, [])

  // 다른 메뉴로 갔다 오면 자동 잠금: 페이지를 떠날 때 잠금 해제 상태 제거
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') sessionStorage.removeItem(SECURE_UNLOCK_KEY)
    }
  }, [])

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4 || pin.length > 12) {
      toast.error('비밀번호는 4~12자로 설정해주세요')
      return
    }
    if (pin !== confirmPin) {
      toast.error('두 비밀번호가 일치하지 않아요')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/secure/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '설정 실패')
        return
      }
      toast.success('2차 비밀번호가 설정되었어요')
      setHasPin(true)
      setPin('')
      setConfirmPin('')
      setUnlocked(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim()) {
      toast.error('비밀번호를 입력해주세요')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/secure/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast.error('비밀번호가 맞지 않아요')
        setPin('')
        return
      }
      setUnlocked(true)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  function handleLock() {
    setUnlocked(false)
    setPin('')
    setConfirmPin('')
    toast.success('보안 폴더가 잠겼어요')
  }

  const fetchSecureFiles = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setFilesLoading(true)
    const selectCols = 'id, name, storage_path, size_bytes, mime_type, created_at, file_type, folder_id'
    const { data, error } = await supabase
      .from('files')
      .select(selectCols)
      .eq('owner_id', user.id)
      .eq('is_secure', true)
      .order('created_at', { ascending: false })
    if (error && (error.message?.includes('folder_id') || error.message?.includes('column'))) {
      const { data: dataWithoutFolder } = await supabase
        .from('files')
        .select('id, name, storage_path, size_bytes, mime_type, created_at, file_type')
        .eq('owner_id', user.id)
        .eq('is_secure', true)
        .order('created_at', { ascending: false })
      setSecureFiles((dataWithoutFolder || []).map((f) => ({ ...f, folder_id: null })))
      if (error.message?.includes('folder_id')) toast.info('폴더 기능을 쓰려면 Supabase에서 add_secure_folders.sql을 실행해주세요.')
    } else if (error) {
      toast.error('파일 목록을 불러오지 못했어요. is_secure 컬럼이 있으면 add_is_secure.sql을 실행해주세요.')
      setSecureFiles([])
    } else {
      setSecureFiles(data || [])
    }
    setFilesLoading(false)
  }, [supabase])

  const fetchSecureFolders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('secure_folders')
      .select('id, name, created_at')
      .eq('owner_id', user.id)
      .order('name')
    setSecureFolders(data || [])
  }, [supabase])

  const fetchSecureNotes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setNotesLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('id, title, content, color, pinned, updated_at')
      .eq('owner_id', user.id)
      .eq('is_secure', true)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    setSecureNotes(data || [])
    setNotesLoading(false)
  }, [supabase])

  useEffect(() => {
    if (unlocked) {
      fetchSecureFiles()
      fetchSecureNotes()
      fetchSecureFolders()
    }
  }, [unlocked, fetchSecureFiles, fetchSecureNotes, fetchSecureFolders])

  async function deleteSecureFile(id: string, path: string) {
    await supabase.storage.from('family-files').remove([path])
    await supabase.from('files').delete().eq('id', id)
    toast.success('삭제되었습니다')
    fetchSecureFiles()
  }

  async function createFolder() {
    const name = newFolderName.trim()
    if (!name) return toast.error('폴더 이름을 입력하세요')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('secure_folders').insert({ owner_id: user.id, name })
    if (error) {
      toast.error(error.message || '폴더 생성 실패')
      return
    }
    toast.success('폴더가 생성되었어요')
    setNewFolderName('')
    setShowNewFolder(false)
    fetchSecureFolders()
  }

  async function moveFileToFolder(fileId: string, folderId: string | null) {
    const { error } = await supabase.from('files').update({ folder_id: folderId }).eq('id', fileId)
    if (error) return toast.error('이동 실패')
    toast.success('이동했어요')
    fetchSecureFiles()
  }

  async function deleteFolder(folderId: string) {
    await supabase.from('files').update({ folder_id: null }).eq('folder_id', folderId)
    await supabase.from('secure_folders').delete().eq('id', folderId)
    toast.success('폴더를 삭제했어요. 안의 파일은 폴더 없음으로 옮겨졌어요')
    if (selectedFileFolderId === folderId) setSelectedFileFolderId(null)
    fetchSecureFolders()
    fetchSecureFiles()
  }

  async function saveSecureNote() {
    if (!editingNote) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (isNewNote) {
      await supabase.from('notes').insert({
        owner_id: user.id,
        title: editingNote.title || '제목 없음',
        content: editingNote.content,
        color: editingNote.color,
        pinned: editingNote.pinned,
        is_shared: false,
        group_id: null,
        is_secure: true,
      })
      toast.success('메모가 저장되었습니다')
    } else {
      await supabase.from('notes').update({
        title: editingNote.title || '제목 없음',
        content: editingNote.content,
        color: editingNote.color,
        pinned: editingNote.pinned,
        updated_at: new Date().toISOString(),
      }).eq('id', editingNote.id)
      toast.success('저장되었습니다')
    }
    setEditingNote(null)
    setIsNewNote(false)
    fetchSecureNotes()
  }

  async function deleteSecureNote(id: string) {
    await supabase.from('notes').delete().eq('id', id)
    toast.success('삭제되었습니다')
    setEditingNote(null)
    fetchSecureNotes()
  }

  function getFileIcon(mime: string) {
    if (mime?.includes('pdf')) return '📄'
    if (mime?.includes('word') || mime?.includes('document')) return '📝'
    if (mime?.includes('sheet') || mime?.includes('excel')) return '📊'
    return '📁'
  }

  const secureByType = {
    files: secureFiles.filter((f) => f.file_type === 'file'),
    photos: secureFiles.filter((f) => f.file_type === 'photo'),
    videos: secureFiles.filter((f) => f.file_type === 'video'),
  }

  const currentFolder = selectedFileFolderId ? secureFolders.find((f) => f.id === selectedFileFolderId) : null
  const filesInCurrentFolder = secureByType.files.filter((f) => (f.folder_id ?? null) === selectedFileFolderId)
  const rootFiles = secureByType.files.filter((f) => !f.folder_id)

  if (hasPin === null) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 잠금 해제된 상태: 보안 폴더 내용 (파일 + 메모)
  if (unlocked) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">보안 폴더</h1>
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm" aria-hidden>
                  <Lock className="w-5 h-5" strokeWidth={2.2} />
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">나만의 보안 공간</p>
            </div>
          </div>
          <button
            onClick={handleLock}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <Lock className="w-4 h-4" />
            잠그기
          </button>
        </div>

        {/* 탭: 파일 / 사진 / 동영상 / 메모 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => setTab('files')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'files' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <FileText className="w-4 h-4" /> 파일 ({secureByType.files.length})
          </button>
          <button onClick={() => setTab('photos')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'photos' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <Image className="w-4 h-4" /> 사진 ({secureByType.photos.length})
          </button>
          <button onClick={() => setTab('videos')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'videos' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <Video className="w-4 h-4" /> 동영상 ({secureByType.videos.length})
          </button>
          <button onClick={() => setTab('notes')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'notes' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <StickyNote className="w-4 h-4" /> 메모 ({secureNotes.length})
          </button>
        </div>

        {/* 파일 탭: 하위 폴더 + 문서·일반 파일 */}
        {tab === 'files' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              {selectedFileFolderId ? (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId('root') }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fileId = e.dataTransfer.getData(DRAG_FILE_KEY)
                      if (fileId) { moveFileToFolder(fileId, null); toast.success('폴더에서 빼냈어요') }
                      setDragOverFolderId(null)
                      setDraggedFileId(null)
                    }}
                    className={`inline-flex items-center rounded-lg px-2 py-1 -ml-1 transition-colors ${dragOverFolderId === 'root' ? 'bg-brand-100 text-brand-700' : ''}`}
                  >
                    <button type="button" onClick={() => setSelectedFileFolderId(null)} className="text-gray-500 hover:text-gray-800">전체</button>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-800">{currentFolder?.name}</span>
                  <button onClick={() => currentFolder && deleteFolder(currentFolder.id)} className="text-red-500 hover:text-red-600 text-xs ml-2">폴더 삭제</button>
                </div>
              ) : (
                <span className="text-sm text-gray-500">폴더를 만들고 파일을 분류해 보관하세요</span>
              )}
              <div className="flex gap-2">
                {!selectedFileFolderId && (
                  <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                    <FolderPlus className="w-4 h-4" /> 새 폴더
                  </button>
                )}
                <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
                  <Upload className="w-4 h-4" /> 파일 올리기
                </button>
              </div>
            </div>

            {showNewFolder && (
              <div className="mb-4 p-4 bg-white border border-gray-100 rounded-2xl flex gap-2">
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="폴더 이름 (예: 계약서, 프로젝트, 업무)" className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm" onKeyDown={(e) => e.key === 'Enter' && createFolder()} />
                <button onClick={createFolder} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium">만들기</button>
                <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm">취소</button>
              </div>
            )}

            {showUpload && (
              <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
                <UploadZone bucket="family-files" fileType="file" isSecure={true} folderId={selectedFileFolderId} onUploadComplete={() => { fetchSecureFiles(); setShowUpload(false) }} />
              </div>
            )}

            {filesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />)}</div>
            ) : (
              <>
                {!selectedFileFolderId && secureFolders.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">폴더</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {secureFolders.map((folder) => {
                        const count = secureByType.files.filter((f) => f.folder_id === folder.id).length
                        const isDropTarget = dragOverFolderId === folder.id
                        return (
                          <div
                            key={folder.id}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all group ${isDropTarget ? 'border-brand-400 bg-brand-50 shadow-md' : 'border-gray-100 bg-white hover:shadow-md'}`}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(folder.id) }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => {
                              e.preventDefault()
                              const fileId = e.dataTransfer.getData(DRAG_FILE_KEY)
                              if (fileId) { moveFileToFolder(fileId, folder.id); toast.success('폴더로 옮겼어요') }
                              setDragOverFolderId(null)
                              setDraggedFileId(null)
                            }}
                          >
                            <button onClick={() => setSelectedFileFolderId(folder.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"><FolderOpen className="w-6 h-6 text-amber-600" /></div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-800 truncate">{folder.name}</p>
                                <p className="text-xs text-gray-400">{count}개 파일</p>
                              </div>
                            </button>
                            <button onClick={() => deleteFolder(folder.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100"> <Trash2 className="w-4 h-4" /> </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {!selectedFileFolderId && rootFiles.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 mt-1">
                    <span className="text-xs text-gray-400">폴더에 안 넣은 파일</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">드래그해서 폴더에 넣거나, 카드에 마우스를 올려 이동할 수 있어요</span>
                  </div>
                )}
                {(selectedFileFolderId ? filesInCurrentFolder : rootFiles).length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{selectedFileFolderId ? '이 폴더에 파일이 없어요' : '문서·일반 파일이 없어요'}</p>
                    <p className="text-xs text-gray-400 mt-1">파일 올리기로 워드, 엑셀, PDF 등을 추가하세요</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {(selectedFileFolderId ? filesInCurrentFolder : rootFiles).map((f) => (
                      <div
                        key={f.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData(DRAG_FILE_KEY, f.id); e.dataTransfer.effectAllowed = 'move'; setDraggedFileId(f.id) }}
                        onDragEnd={() => { setDraggedFileId(null); setDragOverFolderId(null) }}
                        className={`bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all flex flex-col group cursor-grab active:cursor-grabbing ${draggedFileId === f.id ? 'opacity-50' : ''}`}
                      >
                        <div className="aspect-square min-h-[140px] bg-gray-50 flex items-center justify-center relative">
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50"><span className="text-5xl">{getFileIcon(f.mime_type)}</span></div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-end gap-1 p-2 opacity-0 group-hover:opacity-100">
                            <select className="text-xs rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-600" value="" onChange={(e) => { const v = e.target.value; moveFileToFolder(f.id, v || null); e.target.value = '' }} title="폴더로 이동">
                              <option value="">이동...</option>
                              <option value="">📁 폴더 없음</option>
                              {secureFolders.map((fd) => <option key={fd.id} value={fd.id}>📁 {fd.name}</option>)}
                            </select>
                            <a href={getFileUrl('family-files', f.storage_path)} download={f.name} className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow"><Download className="w-4 h-4" /></a>
                            <button onClick={() => deleteSecureFile(f.id, f.storage_path)} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white shadow"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <div className="p-3 min-w-0"><p className="text-sm font-medium text-gray-800 truncate" title={f.name}>{f.name}</p><p className="text-xs text-gray-400 mt-0.5">{formatFileSize(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 사진 탭 */}
        {tab === 'photos' && (
          <>
            <div className="flex justify-end mb-3">
              <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
                <Upload className="w-4 h-4" /> 파일 올리기
              </button>
            </div>
            {showUpload && (
              <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
                <UploadZone bucket="family-files" fileType="file" isSecure={true} onUploadComplete={() => { fetchSecureFiles(); setShowUpload(false) }} />
              </div>
            )}
            {filesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />)}</div>
            ) : secureByType.photos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <Image className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">사진이 없어요</p>
                <p className="text-xs text-gray-400 mt-1">파일 올리기로 이미지를 추가하세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {secureByType.photos.map((f) => (
                  <div key={f.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                    <div className="aspect-square min-h-[140px] bg-gray-50 flex items-center justify-center relative group">
                      <img src={getFileUrl('family-files', f.storage_path)} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-end gap-1 p-2 opacity-0 group-hover:opacity-100">
                        <a href={getFileUrl('family-files', f.storage_path)} download={f.name} className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow"><Download className="w-4 h-4" /></a>
                        <button onClick={() => deleteSecureFile(f.id, f.storage_path)} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white shadow"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="p-3 min-w-0"><p className="text-sm font-medium text-gray-800 truncate" title={f.name}>{f.name}</p><p className="text-xs text-gray-400 mt-0.5">{formatFileSize(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}</p></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 동영상 탭 */}
        {tab === 'videos' && (
          <>
            <div className="flex justify-end mb-3">
              <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
                <Upload className="w-4 h-4" /> 파일 올리기
              </button>
            </div>
            {showUpload && (
              <div className="mb-6 bg-white border border-gray-100 rounded-2xl p-4">
                <UploadZone bucket="family-files" fileType="file" isSecure={true} onUploadComplete={() => { fetchSecureFiles(); setShowUpload(false) }} />
              </div>
            )}
            {filesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="aspect-video bg-gray-100 rounded-2xl animate-pulse" />)}</div>
            ) : secureByType.videos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <Video className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">동영상이 없어요</p>
                <p className="text-xs text-gray-400 mt-1">파일 올리기로 영상을 추가하세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {secureByType.videos.map((f) => (
                  <div key={f.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                    <div className="aspect-video min-h-[120px] bg-gray-900 flex items-center justify-center relative group">
                      <video src={getFileUrl('family-files', f.storage_path)} preload="metadata" className="w-full h-full object-cover" muted playsInline />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-end gap-1 p-2 opacity-0 group-hover:opacity-100">
                        <a href={getFileUrl('family-files', f.storage_path)} download={f.name} className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow"><Download className="w-4 h-4" /></a>
                        <button onClick={() => deleteSecureFile(f.id, f.storage_path)} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white shadow"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="p-3 min-w-0"><p className="text-sm font-medium text-gray-800 truncate" title={f.name}>{f.name}</p><p className="text-xs text-gray-400 mt-0.5">{formatFileSize(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ko })}</p></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'notes' && (
          <>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => { setEditingNote({ id: '', title: '', content: '', color: 'yellow', pinned: false, updated_at: '' }); setIsNewNote(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
              >
                <Plus className="w-4 h-4" />
                새 메모
              </button>
            </div>
            {notesLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : secureNotes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <StickyNote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">보안 폴더 메모가 없어요</p>
                <p className="text-xs text-gray-400 mt-1">위에서 새 메모로 추가하세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {secureNotes.map((note) => {
                  const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow
                  return (
                    <div
                      key={note.id}
                      onClick={() => { setEditingNote(note); setIsNewNote(false) }}
                      className={`${c.bg} ${c.border} border-2 rounded-2xl p-5 min-h-[180px] cursor-pointer hover:shadow-md transition-all relative flex flex-col`}
                    >
                      {note.pinned && <Pin className="w-4 h-4 text-gray-500 absolute top-4 right-4" />}
                      <p className="font-semibold text-gray-800 mb-2 line-clamp-1 text-base">{note.title || '제목 없음'}</p>
                      <p className="text-sm text-gray-600 line-clamp-5 whitespace-pre-wrap flex-1">{note.content || <span className="text-gray-400">내용 없음</span>}</p>
                      <p className="text-xs text-gray-400 mt-3">{formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ko })}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* 메모 편집 모달 */}
        {editingNote && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setEditingNote(null); setIsNewNote(false) }}>
            <div className={`${NOTE_COLORS[editingNote.color]?.bg || 'bg-yellow-50'} rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden`} onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-2 px-4 pt-4">
                {Object.entries(NOTE_COLORS).map(([key, val]) => (
                  <button key={key} onClick={() => setEditingNote({ ...editingNote, color: key })} className={`w-6 h-6 rounded-full ${val.bg} ${val.border} border-2 ${editingNote.color === key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`} />
                ))}
                <div className="flex-1" />
                {!isNewNote && (
                  <button onClick={() => setEditingNote({ ...editingNote, pinned: !editingNote.pinned })} className="p-1.5 rounded-lg hover:bg-black/10">
                    <Pin className={`w-4 h-4 ${editingNote.pinned ? 'text-gray-700' : 'text-gray-400'}`} />
                  </button>
                )}
              </div>
              <div className="p-4 space-y-2">
                <input type="text" placeholder="제목" value={editingNote.title} onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })} className="w-full bg-transparent text-lg font-semibold text-gray-800 placeholder-gray-400 outline-none" />
                <textarea placeholder="메모 내용..." value={editingNote.content} onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })} rows={8} className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none resize-none" autoFocus />
              </div>
              <div className="flex items-center justify-between px-4 pb-4 gap-2">
                {!isNewNote && (
                  <button onClick={() => deleteSecureNote(editingNote.id)} className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-100 rounded-xl text-sm">
                    <Trash2 className="w-3.5 h-3.5" /> 삭제
                  </button>
                )}
                <div className="flex-1" />
                <button onClick={() => { setEditingNote(null); setIsNewNote(false) }} className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:bg-black/10 rounded-xl text-sm">
                  <X className="w-3.5 h-3.5" /> 취소
                </button>
                <button onClick={saveSecureNote} className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900">
                  <Save className="w-3.5 h-3.5" /> 저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 2차 비밀번호 미설정: 설정 화면
  if (!hasPin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-brand-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">보안 폴더</h1>
        <p className="text-sm text-gray-500 mb-8">2차 비밀번호를 설정하면 이 폴더에 들어갈 수 있어요</p>
        <form onSubmit={handleSetPin} className="w-full max-w-xs space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">2차 비밀번호 (4~12자)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              autoComplete="new-password"
              maxLength={12}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="다시 입력"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              autoComplete="new-password"
              maxLength={12}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? '설정 중...' : '2차 비밀번호 설정'}
          </button>
        </form>
      </div>
    )
  }

  // 2차 비밀번호 입력 화면
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-gray-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">보안 폴더</h1>
      <p className="text-sm text-gray-500 mb-8">2차 비밀번호를 입력하세요</p>
      <form onSubmit={handleVerify} className="w-full max-w-xs space-y-4">
        <div>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="2차 비밀번호"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-center"
            autoComplete="current-password"
            maxLength={12}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <LockOpen className="w-4 h-4" />
          {loading ? '확인 중...' : '열기'}
        </button>
      </form>
    </div>
  )
}
